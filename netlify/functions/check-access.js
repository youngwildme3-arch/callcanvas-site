const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { email } = JSON.parse(event.body || '{}');
    if (!email) return { statusCode: 400, headers, body: JSON.stringify({ access: 'none', reason: 'no_email' }) };

    const store = getStore('subscribers');
    const record = await store.get(email.toLowerCase(), { type: 'json' });

    if (!record) return { statusCode: 200, headers, body: JSON.stringify({ access: 'none', reason: 'not_found' }) };

    const activeStatuses = ['active', 'trialing'];
    const hasAccess = activeStatuses.includes(record.status);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access: hasAccess ? record.status : 'none',
        status: record.status,
        trial_end: record.trial_end,
        current_period_end: record.current_period_end,
        cancel_at_period_end: record.cancel_at_period_end
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message, access: 'none' }) };
  }
};