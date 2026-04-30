// producthunt-prep.js — generates Product Hunt launch assets on demand
const { getStore } = require('@netlify/blobs');

const PRODUCT_CONTEXT = "CallCanvas AI is a $59/month AI tool for outside sales reps (insurance, payroll, business phones, telecom, commercial services). Reps enter their territory (city or ZIP) and what they sell. Our AI returns a ranked call list of REAL LOCAL BUSINESSES with owner/decision-maker names, direct phone numbers, and personalized opening lines — in under 5 minutes. 7-day free trial, no credit card needed. It is NOT a call recording, transcript analysis, or call coaching tool. It is a TERRITORY RESEARCH / PROSPECTING tool. The audience is solo outside reps tired of spending 90 minutes every morning on research before they can start dialing.";

exports.handler = async () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: 'Missing key' };

  const userMsg = 'Generate complete Product Hunt launch assets for CallCanvas AI. Be accurate to the product context. Do not invent features. Output:\n1) TAGLINE (60 characters max)\n2) DESCRIPTION (260 characters max)\n3) FIRST COMMENT from the maker (~200 words, friendly)\n4) THREE LAUNCH-DAY COMMENTS responding to typical PH skeptics\n5) HASHTAGS (5-7 relevant ones)\n6) SUGGESTED LAUNCH DAY (Tuesday-Thursday recommended)\n\nPRODUCT CONTEXT:\n' + PRODUCT_CONTEXT;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: userMsg }]
    })
  });
  const data = await res.json();
  const assets = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();

  try {
    const store = getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
    await store.set('producthunt-assets', JSON.stringify({ generated: new Date().toISOString(), assets }));
  } catch (e) { console.error('blob set failed:', e.message); }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true, assets }) };
};
