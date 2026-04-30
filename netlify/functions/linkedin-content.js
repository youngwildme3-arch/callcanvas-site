const { schedule } = require('@netlify/functions');
const handler = async () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: 'Missing key' };
  
  const today = new Date().toISOString().split('T')[0];
  const postTypes = [
    'A LinkedIn post revealing a shocking stat about outside sales reps wasting time on research, with a subtle CTA to callcanvasai.com',
    'A LinkedIn story post: "I watched a top insurance rep spend 3 hours researching before a field day. Here is what I learned..." â ends with callcanvasai.com',
    'A LinkedIn hook post: "What if you could walk into every sales call already knowing the owners name, revenue, and biggest pain point?" â CTA to callcanvasai.com',
    'A LinkedIn comparison post: SPOTIO costs $395/month minimum for teams. CallCanvas AI costs $59/month for one rep. Breakdown post with CTA to callcanvasai.com',
    'A LinkedIn post written as a day-in-the-life of an outside sales rep using CallCanvas AI â authentic, specific, ends with callcanvasai.com free trial',
    'A LinkedIn objection-crusher post: "3 reasons outside sales reps say they dont need territory research software (and why theyre wrong)" â CTA to callcanvasai.com',
    'A LinkedIn carousel-style post with 5 tips for researching territories faster â tip 5 mentions callcanvasai.com'
  ];
  const dayIdx = new Date().getDay();
  const postType = postTypes[dayIdx % postTypes.length];
  
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 600,
      messages: [{ role: 'user', content: 'Write this LinkedIn post for Evan Jones, founder of CallCanvas AI. Make it authentic, not salesy. Use line breaks for readability. Include 3-5 relevant hashtags at the end. Post type: ' + postType }]
    })
  });
  const data = await res.json();
  const post = data.content?.[0]?.text || '';
  
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
    await store.set('linkedin-' + today, JSON.stringify({ date: today, post, type: postType }));
    console.log('[LinkedIn] Post generated for ' + today);
  } catch(e) {}
  
  return { statusCode: 200, body: JSON.stringify({ success: true, date: today, preview: post.substring(0, 100) }) };
};
module.exports.handler = schedule('0 8 * * *', handler);