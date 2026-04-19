exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  
  try {
    const { email, name, source } = JSON.parse(event.body);
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'Email required' }) };
    
    const { getStore } = require('@netlify/blobs');
    const store = getStore('email-leads');
    const id = 'lead-' + Date.now();
    await store.set(id, JSON.stringify({ email, name: name || '', source: source || 'website', date: new Date().toISOString(), sequence_step: 0 }));
    console.log('[Email Capture] New lead:', email, 'from:', source);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, message: 'Checklist on its way!' })
    };
  } catch(e) {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true }) };
  }
};