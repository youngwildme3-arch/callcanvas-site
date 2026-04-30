const { schedule } = require('@netlify/functions');
const handler = async () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: 'Missing key' };
  
  async function claude(prompt, tokens) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5-20250929', max_tokens: tokens || 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }] })
    });
    const d = await r.json();
    return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  }
  
  const today = new Date().toISOString().split('T')[0];
  console.log('[GrowthEngine] Starting daily run ' + today);
  
  const eval_ = await claude('Today is ' + today + '. For callcanvasai.com (outside sales territory AI tool, $59/month): 1) Search Reddit r/sales and r/InsuranceProfessional for top complaints about territory research tools this week. 2) Search for SPOTIO complaints 2026. 3) Find the single best blog keyword to target today for outside sales AI tools. 4) Identify one new traffic channel to test. Respond with: REDDIT_TOPIC: [topic] COMPETITOR_PAIN: [pain] TODAY_KEYWORD: [keyword] NEW_CHANNEL: [channel]', 1200);
  
  console.log('[GrowthEngine] Evaluation:', eval_);
  
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
    await store.set('latest-' + today, JSON.stringify({ date: today, evaluation: eval_ }));
  } catch(e) { console.log('Blob error:', e.message); }
  
  return { statusCode: 200, body: JSON.stringify({ success: true, date: today }) };
};
module.exports.handler = schedule('0 7 * * *', handler);