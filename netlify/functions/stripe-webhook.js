const Stripe = require('stripe');
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, whSecret);
  } catch (err) {
    return { statusCode: 400, body: 'Webhook signature verification failed: ' + err.message };
  }

  const store = getStore('subscribers');

  try {
    const obj = stripeEvent.data.object;

    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const email = obj.customer_email || obj.customer_details?.email;
        const customerId = obj.customer;
        const subscriptionId = obj.subscription;
        if (email) {
          await store.setJSON(email.toLowerCase(), {
            email: email.toLowerCase(),
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: 'trialing',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const customer = await stripe.customers.retrieve(obj.customer);
        const email = customer.email?.toLowerCase();
        if (email) {
          const existing = await store.get(email, { type: 'json' }) || {};
          await store.setJSON(email, {
            ...existing,
            email,
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.id,
            status: obj.status,
            current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
            trial_end: obj.trial_end ? new Date(obj.trial_end * 1000).toISOString() : null,
            cancel_at_period_end: obj.cancel_at_period_end,
            updated_at: new Date().toISOString()
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const customer = await stripe.customers.retrieve(obj.customer);
        const email = customer.email?.toLowerCase();
        if (email) {
          const existing = await store.get(email, { type: 'json' }) || {};
          await store.setJSON(email, {
            ...existing,
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const customer = await stripe.customers.retrieve(obj.customer);
        const email = customer.email?.toLowerCase();
        if (email) {
          const existing = await store.get(email, { type: 'json' }) || {};
          await store.setJSON(email, {
            ...existing,
            status: 'past_due',
            updated_at: new Date().toISOString()
          });
        }
        break;
      }
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};