const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';
const VALID_FREE_COUPONS = ['EVAN-FULL-2026', 'BETA-TEST'];

function buildPrompt(city, state, product, count) {
  return 'Generate exactly ' + count + ' real local businesses in ' + city + (state ? ', ' + state : '') + ' that would benefit from "' + product + '". Return ONLY a valid JSON array. NO prose, NO markdown fences, NO trailing commas, NO comments. Each item MUST have:\n' +
    '- name (real business name)\n' +
    '- address (real street address with city, state, zip)\n' +
    '- ownerOrDecisionMaker (best-guess first and last name)\n' +
    '- phone (with area code, format "(xxx) xxx-xxxx")\n' +
    '- whyTheyNeedIt (one sentence, specific to their operation)\n' +
    '- openingLine (personalized, under 30 words, uses owner first name)\n' +
    '- priorityScore (1-10 number)\n\n' +
    'Output format example: [{"name":"Acme Corp","address":"...","ownerOrDecisionMaker":"...","phone":"...","whyTheyNeedIt":"...","openingLine":"...","priorityScore":8}]';
}

async function callClaudeOnce(prompt, signal) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
    signal
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error('Anthropic API ' + r.status + ': ' + errText.substring(0, 150));
  }
  const j = await r.json();
  const text = j.content?.[0]?.text || '';
  // Extract JSON array — find first [ and last ]
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON array in response');
  const jsonStr = text.substring(start, end + 1);
  return JSON.parse(jsonStr);
}

// Retry once on parse failure (Claude occasionally returns malformed JSON under load)
async function callClaude(prompt, signal) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  try {
    return await callClaudeOnce(prompt, signal);
  } catch (e) {
    // Retry once with a stricter prompt suffix
    if (e.message.includes('JSON') || e.message.includes('No JSON')) {
      try {
        return await callClaudeOnce(prompt + '\n\nIMPORTANT: Return ONLY the JSON array, nothing else. No preamble. Start with [ and end with ].', signal);
      } catch (e2) {
        throw e2;
      }
    }
    throw e;
  }
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
  
  if (!city || !product) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'city and product are required' }) };
  }
  
  let access = null;
  if (couponCode && VALID_FREE_COUPONS.includes(couponCode.toUpperCase())) {
    access = { granted: true, via: 'coupon', code: couponCode.toUpperCase() };
  } else if (email) {
    try {
      const { getStore } = await import('@netlify/blobs');
      const store = getStore({ name: 'subscribers', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
      const sub = await store.get(email.toLowerCase(), { type: 'json' });
      if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
        access = { granted: true, via: 'subscription', email: email.toLowerCase() };
      }
    } catch (e) {}
  }
  
  if (!access || !access.granted) {
    return { statusCode: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Access denied. Active subscription or valid coupon required.' }) };
  }
  
  const CHUNK_SIZE = 10;
  const chunks = [];
  let remaining = count;
  while (remaining > 0) { const c = Math.min(remaining, CHUNK_SIZE); chunks.push(c); remaining -= c; }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 24000);
  
  try {
    // RESILIENT: Promise.allSettled — if one chunk fails, others still return
    const settled = await Promise.allSettled(chunks.map(chunkCount => callClaude(buildPrompt(city, state, product, chunkCount), controller.signal)));
    clearTimeout(timeoutId);
    
    const successful = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
    const failed = settled.filter(s => s.status === 'rejected');
    const prospects = successful.flat().slice(0, count);
    
    if (prospects.length === 0) {
      // All chunks failed — return error
      return { statusCode: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'AI generation failed. Please try again.', diagnostic: failed.map(f => f.reason?.message?.substring(0, 100)).slice(0, 2) }) };
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        prospects,
        partial: failed.length > 0 ? { failedChunks: failed.length, requestedCount: count, returnedCount: prospects.length } : undefined,
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
      body: JSON.stringify({ error: isAbort ? 'Generation timed out — try fewer prospects' : 'Generation failed: ' + err.message })
    };
  }
};
