const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';
const VALID_FREE_COUPONS = ['EVAN-FULL-2026', 'BETA-TEST'];

function buildPrompt(city, state, product, count) {
  return 'Generate exactly ' + count + ' real local businesses in ' + city + (state ? ', ' + state : '') + ' that would benefit from "' + product + '". Return ONLY a valid JSON array (no prose, no markdown fences). Each item MUST have:\n' +
    '- name (real business name)\n' +
    '- address (real street address with city, state, zip)\n' +
    '- ownerOrDecisionMaker (best-guess first and last name)\n' +
    '- phone (with area code, format "(xxx) xxx-xxxx")\n' +
    '- whyTheyNeedIt (one sentence, specific to their operation)\n' +
    '- openingLine (personalized, under 30 words, uses owner first name)\n' +
    '- priorityScore (1-10 number)\n\n' +
    'Return as: [{ "name":"...", "address":"...", "ownerOrDecisionMaker":"...", "phone":"...", "whyTheyNeedIt":"...", "openingLine":"...", "priorityScore":8 }, ...]';
}

async function callClaude(prompt, signal) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error('Anthropic API ' + r.status + ': ' + errText.substring(0, 200));
  }
  const j = await r.json();
  const text = j.content?.[0]?.text || '';
  // Strip code fences if present
  const cleaned = text.replace(/^\s*\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`\s*$/, '').trim();
  // Find first [ to last ] (in case there's preamble)
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array in response');
  return JSON.parse(cleaned.substring(start, end + 1));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }
  
  const { city, state, product, count: requestedCount, couponCode, email } = body;
  const count = Math.min(Math.max(parseInt(requestedCount) || 20, 1), 50);
  
  // Validate input
  if (!city || !product) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'city and product are required' }) };
  }
  
  // Access check
  let access = null;
  if (couponCode && VALID_FREE_COUPONS.includes(couponCode.toUpperCase())) {
    access = { granted: true, via: 'coupon', code: couponCode.toUpperCase() };
  } else if (email) {
    // Check active subscription via blob
    try {
      const { getStore } = await import('@netlify/blobs');
      const store = getStore({ name: 'subscribers', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
      const sub = await store.get(email.toLowerCase(), { type: 'json' });
      if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
        access = { granted: true, via: 'subscription', email: email.toLowerCase() };
      }
    } catch (e) { /* subscriber check failed, fall through to deny */ }
  }
  
  if (!access || !access.granted) {
    return { statusCode: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Access denied. Active subscription or valid coupon required.' }) };
  }
  
  // PARALLEL CHUNKED GENERATION — split count into chunks of 10
  const CHUNK_SIZE = 10;
  const chunks = [];
  let remaining = count;
  while (remaining > 0) {
    const c = Math.min(remaining, CHUNK_SIZE);
    chunks.push(c);
    remaining -= c;
  }
  
  // 25-second budget for all chunks (Netlify hard timeout is 26s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  
  try {
    const results = await Promise.all(chunks.map(chunkCount => callClaude(buildPrompt(city, state, product, chunkCount), controller.signal)));
    clearTimeout(timeoutId);
    const prospects = results.flat().slice(0, count);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        prospects,
        __watermark: { licensedTo: access.email || access.code, generatedAt: new Date().toISOString(), city, state, product },
        __access: access
      })
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = err.name === 'AbortError';
    return {
      statusCode: isAbort ? 504 : 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: isAbort ? 'Generation timed out — try fewer prospects (count under 10)' : 'Generation failed: ' + err.message })
    };
  }
};
