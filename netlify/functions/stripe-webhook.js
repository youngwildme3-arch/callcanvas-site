// stripe-webhook.js — keeps 'subscribers' blob in sync with Stripe subscription status
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getStore } = require('@netlify/blobs');
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

async function upsertSubscriber(email, patch) {
  const store = getStore('subscribers');
  const key = email.trim().toLowerCase();
  let existing = {};
  try { existing = (await store.get(key, { type: 'json' })) || {}; } catch (e) {}
  const merged = { ...existing, ...patch, email: key, updated_at: Math.floor(Date.now() / 1000) };
  await store.setJSON(key, merged);
  return merged;
}

async function handleSubscriptionEvent(subscription) {
  let email = subscription.customer_email;
  if (!email && subscription.customer) {
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      email = customer.email;
    } catch (e) {}
  }
  if (!email) {
    console.warn('No email for subscription', subscription.id);
    return;
  }
  await upsertSubscriber(email, {
    stripe_customer_id: subscription.customer,
    subscription_id: subscription.id,
    status: subscription.status,
    current_period_end: subscription.current_period_end,
    trial_end: subscription.trial_end || null,
    canceled_at: subscription.canceled_at || null,
    cancel_at_period_end: !!subscription.cancel_at_period_end
  });
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  let stripeEvent;
  try {
    const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    stripeEvent = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid signature' }) };
  }
  console.log('Webhook event:', stripeEvent.type, stripeEvent.id);
  try {
    switch (stripeEvent.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(stripeEvent.data.object);
        break;
      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        let email = sub.customer_email;
        if (!email && sub.customer) {
          try {
            const customer = await stripe.customers.retrieve(sub.customer);
            email = customer.email;
          } catch (e) {}
        }
        if (email) {
          await upsertSubscriber(email, {
            status: 'canceled',
            subscription_id: sub.id,
            canceled_at: sub.canceled_at || Math.floor(Date.now() / 1000),
            current_period_end: sub.current_period_end
          });
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const inv = stripeEvent.data.object;
        if (inv.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(inv.subscription);
            await handleSubscriptionEvent(sub);
          } catch (e) { console.error('failed to fetch sub on payment_succeeded:', e.message); }
        }
        break;
      }
      case 'invoice.payment_failed': {
        const inv = stripeEvent.data.object;
        const email = inv.customer_email;
        if (email) {
          await upsertSubscriber(email, { status: 'past_due', last_failed_invoice: inv.id });
        }
        break;
      }
      case 'customer.subscription.trial_will_end': {
        await handleSubscriptionEvent(stripeEvent.data.object);
        break;
      }
      default:
        console.log('Unhandled event type:', stripeEvent.type);
    }
  } catch (e) {
    console.error('Handler error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
  return { statusCode: 200, headers, body: JSON.stringify({ received: true, event_id: stripeEvent.id }) };
};
