// linkedin-content.js — generates daily LinkedIn post for callcanvasai.com
const { getStore } = require('@netlify/blobs');

const PRODUCT_CONTEXT = "CallCanvas AI is a $59/month AI tool for outside sales reps (insurance, payroll, business phones, telecom, commercial services). Reps enter their territory (city or ZIP) and what they sell. Our AI returns a ranked call list of REAL LOCAL BUSINESSES with owner/decision-maker names, direct phone numbers, and personalized opening lines — in under 5 minutes. 7-day free trial, no credit card needed. It is NOT a call recording, transcript analysis, or call coaching tool. It is a TERRITORY RESEARCH / PROSPECTING tool. The audience is solo outside reps tired of spending 90 minutes every morning on research before they can start dialing.";

const POST_TYPES = [
  'A LinkedIn post revealing a stat about how much time outside sales reps waste on prospect research, with a soft CTA to callcanvasai.com',
  'A LinkedIn story post: "I watched a top insurance rep spend 90 minutes researching before a field day. Here is what I learned..." — ends naturally referencing callcanvasai.com',
  'A LinkedIn hook post: "What if you could walk into every sales call already knowing the owner name, business size, and biggest pain point?" — soft CTA to callcanvasai.com',
  'A LinkedIn comparison post: enterprise tools (ZoomInfo $15K/yr, Apollo $96/mo) vs CallCanvas AI $59/mo for solo reps. Honest breakdown with CTA',
  'A LinkedIn post written as a day-in-the-life of an outside sales rep using CallCanvas AI for territory research — authentic, specific to insurance/payroll/telecom rep workflow',
  'A LinkedIn objection-crusher post: "3 reasons outside sales reps think they do not need territory research software (and why they are wrong)" — CTA to callcanvasai.com',
  'A LinkedIn post with 5 specific tips for researching local territories faster — tip 5 mentions callcanvasai.com naturally'
];

const handler = async () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: 'Missing key' };

  const today = new Date().toISOString().slice(0, 10);
  const postType = POST_TYPES[Math.floor(Math.random() * POST_TYPES.length)];

  const userMsg = 'Write this LinkedIn post for Evan Jones, founder of CallCanvas AI. Authentic, not salesy. Use line breaks for readability. Include 3-5 relevant hashtags at the end. ABSOLUTELY DO NOT invent product features that do not exist (no call recording, no transcripts, no coaching). Stick strictly to what the product does.\n\nPRODUCT CONTEXT (everything you can say about the product):\n' + PRODUCT_CONTEXT + '\n\nPOST TYPE TO WRITE:\n' + postType;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: userMsg }]
    })
  });
  const data = await res.json();
  const post = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();

  try {
    const store = getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
    await store.set('linkedin-' + today, JSON.stringify({ date: today, post, type: postType }));
  } catch (e) { console.error('blob set failed:', e.message); }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, date: today, preview: post.substring(0, 100) }) };
};

exports.handler = handler;
