// territory-research.js - returns companies[] matching frontend schema
// Supports: bulk (count 1-50), single-company lookup (specificCompany), couponCode bypass

const { getStore } = require('@netlify/blobs');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

if (!ANTHROPIC_KEY) console.error('WARN: ANTHROPIC_API_KEY env var not set');

const FREE_PASS_COUPONS = ['EVAN-FULL-2026', 'BETA-TEST', 'DEBUG-5DAYS'];

function getSubscriberStore() {
  return getStore({
    name: 'subscribers',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_PAT
  });
}

async function userHasAccess(email, couponCode) {
  if (couponCode && FREE_PASS_COUPONS.includes(couponCode.toUpperCase())) return true;
  if (!email) return false;
  try {
    const store = getSubscriberStore();
    const rec = await store.get(email.toLowerCase(), { type: 'json' });
    if (!rec) return false;
    const ok = ['active', 'trialing'].includes(rec.status);
    return ok;
  } catch (e) {
    console.error('access check error:', e.message);
    return false;
  }
}

function buildBulkPrompt(city, state, product, count) {
  return `You are a B2B sales prospect researcher. Generate exactly ${count} real-feeling local business prospects in ${city}, ${state} who would buy: ${product}.

Return STRICT JSON only — no prose, no markdown fences. Schema:
{
  "companies": [
    {
      "rank": 1,
      "name": "Company name",
      "business_type": "What they do (5-8 words)",
      "owner": "Decision maker full name",
      "owner_title": "Their title (Owner / GM / Operations Mgr)",
      "address": "Street address, City, State ZIP",
      "phone": "(XXX) XXX-XXXX",
      "employees": "5-15",
      "revenue_est": "$1M-$5M",
      "why_prospect": "One sentence: why THIS business needs ${product}",
      "cold_open": "First sentence the rep should say on the call. Specific to this business. Plain talk, no fluff.",
      "talk_tracks": ["Quick value point 1", "Quick value point 2", "Quick value point 3"],
      "priority": "high|medium|low"
    }
  ]
}

Rules: realistic addresses for ${city} ${state}, plausible phone area codes, vary business types, prioritize fleet/multi-vehicle/multi-location operations for insurance/services products. Rank 1 = best prospect.`;
}

function buildSingleCompanyPrompt(companyName, city, state, product) {
  return `You are a B2B sales prospect researcher. Research this specific company:

Company: ${companyName}
Location: ${city}, ${state}
Product being sold to them: ${product}

Return STRICT JSON only — no prose, no markdown fences. Schema:
{
  "companies": [
    {
      "rank": 1,
      "name": "${companyName}",
      "business_type": "What they do (5-8 words)",
      "owner": "Most likely decision maker full name (use realistic placeholder if unknown)",
      "owner_title": "Their title",
      "address": "Best-guess street address, ${city}, ${state} ZIP",
      "phone": "(XXX) XXX-XXXX (realistic area code for ${city})",
      "employees": "5-15",
      "revenue_est": "$1M-$5M",
      "why_prospect": "One sentence: why THIS specific business needs ${product}",
      "cold_open": "First sentence the rep should say on the call. Specific to this business. Plain talk.",
      "talk_tracks": ["Specific value point 1", "Specific value point 2", "Specific value point 3"],
      "priority": "high|medium|low"
    }
  ]
}

Be realistic. If ${companyName} is a known business type, infer accurately. If you don't know specifics, use plausible values consistent with a business of this name in ${city}.`;
}

async function callClaude(prompt) {
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
    })
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error('Anthropic API error ' + r.status + ': ' + errText.substring(0, 200));
  }
  const data = await r.json();
  return data.content[0].text;
}

function tryParseJSON(text) {
  // Strip markdown fences if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
  // Find first { and last }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return JSON.parse(cleaned);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (!ANTHROPIC_KEY) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Server misconfigured' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const email = (body.email || '').trim().toLowerCase();
  const couponCode = (body.couponCode || '').trim();
  const city = (body.city || '').trim();
  const state = (body.state || 'IL').trim();
  const product = (body.product || '').trim();
  const specificCompany = (body.specificCompany || '').trim();
  let count = parseInt(body.count || 10, 10);
  if (isNaN(count) || count < 1) count = 10;
  if (count > 50) count = 50;

  // Input validation
  if (!city || !product) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'city and product required' }) };
  }

  // Auth check
  const hasAccess = await userHasAccess(email, couponCode);
  if (!hasAccess) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Access denied. Start a free trial to use this feature.' }) };
  }

  // Build prompt based on mode
  const prompt = specificCompany
    ? buildSingleCompanyPrompt(specificCompany, city, state, product)
    : buildBulkPrompt(city, state, product, count);

  let parsed;
  try {
    const responseText = await callClaude(prompt);
    parsed = tryParseJSON(responseText);
  } catch (e) {
    console.error('research generation failed:', e.message);
    return { statusCode: 502, headers: HEADERS, body: JSON.stringify({ error: 'Research generation failed. Please try again.' }) };
  }

  if (!parsed || !Array.isArray(parsed.companies) || parsed.companies.length === 0) {
    return { statusCode: 502, headers: HEADERS, body: JSON.stringify({ error: 'No results returned. Please try again.' }) };
  }

  // Add watermark
  const watermark = {
    licensed_to: email || ('coupon:' + couponCode) || 'unknown',
    generated_at: new Date().toISOString(),
    territory: city + ', ' + state,
    product: product,
    mode: specificCompany ? 'single_company' : 'bulk',
    count_returned: parsed.companies.length
  };

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      companies: parsed.companies,
      watermark: watermark,
      licensed_to: watermark.licensed_to
    })
  };
};
