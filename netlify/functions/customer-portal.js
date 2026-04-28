// customer-portal.js — creates Stripe Customer Portal session
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const SITE_URL = process.env.SITE_URL || 'https://callcanvasai.com';

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
  }
  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No subscription found for this email. Email support@callcanvasai.com if you need help.' }) };
    }
    const customer = customers.data[0];
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: SITE_URL + '/'
    });
    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Customer portal error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create portal session. Email support@callcanvasai.com', detail: err.message }) };
  }
};
