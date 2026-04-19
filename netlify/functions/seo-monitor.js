const { schedule } = require('@netlify/functions');
const handler = async () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: 'Missing key' };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: 'Search for callcanvasai.com and check if it appears in Google results. Then search for SPOTIO alternative 2026 and note if callcanvasai.com ranks. Then find 3 new low-competition keywords for outside sales tools. Report findings.' }]
    })
  });
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  console.log('[SEO Monitor Weekly]', text);
  return { statusCode: 200, body: text };
};
module.exports.handler = schedule('0 8 * * 1', handler);