exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  
  try {
    const data = JSON.parse(event.body);
    const { getStore } = require('@netlify/blobs');
    const store = getStore('affiliates');
    const id = 'aff-' + Date.now();
    await store.set(id, JSON.stringify({ ...data, id, code: data.name.toLowerCase().replace(/[^a-z0-9]/g,'').substring(0,10) + Math.random().toString(36).substring(2,6) }));
    console.log('[Affiliate Apply]', data.name, data.email);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true }) };
  } catch(e) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true }) };
  }
};