const { schedule } = require('@netlify/functions');
const handler = async () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: 'Missing key' };
  const today = new Date().toISOString().split('T')[0];
  
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: 'Today is ' + today + '. Search Reddit for recent posts (last 48 hours) in r/sales, r/InsuranceProfessional, r/SalesReps, r/entrepreneur where people are complaining about: territory research, finding business owner contacts, SPOTIO being too expensive, pre-call research taking too long, or door-to-door sales prep. For each relevant post you find, write an authentic helpful Reddit reply from Evan Jones that: 1) acknowledges their pain, 2) gives 1-2 genuine tips for free, 3) mentions he built callcanvasai.com to solve exactly this. Format as: POST_URL: [url] SUBREDDIT: [name] REPLY: [text]. Find up to 5 opportunities.' }]
    })
  });
  const data = await res.json();
  const opportunities = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  
  try {
    await require('@netlify/blobs').getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT }).set('reddit-' + today, JSON.stringify({ date: today, opportunities }));
  } catch(e) {}
  return { statusCode: 200, body: JSON.stringify({ success: true, preview: opportunities.substring(0, 200) }) };
};
module.exports.handler = schedule('0 10 * * *', handler);