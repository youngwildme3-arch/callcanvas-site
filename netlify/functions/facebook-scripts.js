// facebook-scripts.js — generates daily Facebook group comment scripts
const { getStore } = require('@netlify/blobs');

const PRODUCT_CONTEXT = "CallCanvas AI is a $59/month AI tool for outside sales reps (insurance, payroll, business phones, telecom, commercial services). Reps enter their territory (city or ZIP) and what they sell. Our AI returns a ranked call list of REAL LOCAL BUSINESSES with owner/decision-maker names, direct phone numbers, and personalized opening lines — in under 5 minutes. 7-day free trial, no credit card needed. It is NOT a call recording, transcript analysis, or call coaching tool. It is a TERRITORY RESEARCH / PROSPECTING tool. The audience is solo outside reps tired of spending 90 minutes every morning on research before they can start dialing.";

const handler = async () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: 'Missing key' };

  const today = new Date().toISOString().slice(0, 10);

  const userMsg = 'Generate 5 ready-to-use Facebook group comment scripts for an outside sales rep founder (Evan, founder of CallCanvas AI) to reply with in groups like Insurance Professionals Network, Outside Sales Reps Community, B2B Sales Tips.\n\nEACH SCRIPT should respond to a typical question. For each, output:\n- The hypothetical post it answers\n- The reply (3-6 sentences, friendly, helpful, mentions CallCanvas only when natural)\n\nABSOLUTELY DO NOT invent product features. No call recordings. No transcripts. No coaching.\n\nPRODUCT CONTEXT:\n' + PRODUCT_CONTEXT;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: userMsg }]
    })
  });
  const data = await res.json();
  const scripts = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();

  try {
    const store = getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
    await store.set('facebook-' + today, JSON.stringify({ date: today, scripts }));
  } catch (e) { console.error('blob set failed:', e.message); }

  return { statusCode: 200, body: JSON.stringify({ success: true, preview: scripts.substring(0, 200) }) };
};

exports.handler = handler;
