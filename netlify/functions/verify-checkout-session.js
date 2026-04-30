// verify-checkout-session.js — looks up a Stripe Checkout Session, returns the customer email
// Used by /welcome.html after a successful Stripe redirect to identify who just signed up
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}

  const sessionId = body.sessionId || body.session_id;
  if (!sessionId || typeof sessionId !== 'string' || !(sessionId.startsWith('cs_') || sessionId === 'test')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid Stripe checkout session ID required' }) };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['customer'] });
    const email = session.customer_email
      || (session.customer_details && session.customer_details.email)
      || (session.customer && session.customer.email);

    if (!email) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No email on this checkout session' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({
      email,
      sessionStatus: session.status,
      paymentStatus: session.payment_status,
      customerId: typeof session.customer === 'string' ? session.customer : (session.customer && session.customer.id)
    }) };
  } catch (e) {
    console.error('verify-checkout-session error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not verify checkout session: ' + e.message }) };
  }
};
