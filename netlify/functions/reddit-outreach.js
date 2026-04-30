// reddit-outreach.js — generates daily Reddit comment templates for outreach
const { getStore } = require('@netlify/blobs');

const PRODUCT_CONTEXT = "CallCanvas AI is a $59/month AI tool for outside sales reps (insurance, payroll, business phones, telecom, commercial services). Reps enter their territory (city or ZIP) and what they sell. Our AI returns a ranked call list of REAL LOCAL BUSINESSES with owner/decision-maker names, direct phone numbers, and personalized opening lines — in under 5 minutes. 7-day free trial, no credit card needed. It is NOT a call recording, transcript analysis, or call coaching tool. It is a TERRITORY RESEARCH / PROSPECTING tool. The audience is solo outside reps tired of spending 90 minutes every morning on research before they can start dialing.";

const handler = async () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: 'Missing key' };

  const today = new Date().toISOString().slice(0, 10);

  const userMsg = 'Generate 4 ready-to-use Reddit comment templates for an outside sales rep founder (Evan, founder of CallCanvas AI) to reply with in subreddits like r/sales, r/InsuranceProfessional, r/SalesReps, and r/EntrepreneurRideAlong.\n\nEACH TEMPLATE should respond to a typical question or complaint that comes up regularly in those subreddits. Common scenarios:\n1. Someone complains about how much time prospect research takes\n2. Someone asks for help finding good local prospects\n3. Someone is frustrated with expensive enterprise tools (ZoomInfo, Outreach)\n4. Someone asks for AI tools that actually help solo reps (not teams)\n\nFor each template, output:\n- The hypothetical Reddit post title it answers\n- The reply (4-8 sentences, helpful first, mentions CallCanvas only if natural)\n\nABSOLUTELY DO NOT invent product features that do not exist. No call recordings. No transcripts. No coaching.\n\nPRODUCT CONTEXT:\n' + PRODUCT_CONTEXT;

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
  const opportunities = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();

  try {
    const store = getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
    await store.set('reddit-' + today, JSON.stringify({ date: today, opportunities }));
  } catch (e) { console.error('blob set failed:', e.message); }

  return { statusCode: 200, body: JSON.stringify({ success: true, preview: opportunities.substring(0, 200) }) };
};

exports.handler = handler;
