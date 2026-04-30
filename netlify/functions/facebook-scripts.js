const { schedule } = require('@netlify/functions');
const handler = async () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: 'Missing key' };
  const today = new Date().toISOString().split('T')[0];
  
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 800,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: 'Today is ' + today + '. Generate 5 authentic Facebook group comment scripts for Evan Jones to post in outside sales Facebook groups (Insurance Agents Network, Outside Sales Professionals, Field Sales Nation, Insurance Sales Professionals, B2B Sales Community). Each comment should: 1) respond to common complaints about territory research, 2) mention a specific pain point, 3) naturally mention callcanvasai.com as a tool he built to solve it. Make them sound human, not robotic. Also search for any trending discussions in sales communities today that Evan could join. Format as: GROUP: [group name] COMMENT: [comment text]' }]
    })
  });
  const data = await res.json();
  const scripts = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  
  try {
    const { getStore } = require('@netlify/blobs');
    await getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT }).set('facebook-' + today, JSON.stringify({ date: today, scripts }));
  } catch(e) {}
  return { statusCode: 200, body: JSON.stringify({ success: true, preview: scripts.substring(0, 150) }) };
};
module.exports.handler = schedule('0 9 * * *', handler);