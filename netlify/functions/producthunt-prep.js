exports.handler = async (event) => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: 'Missing key' };
  
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1500,
      messages: [{ role: 'user', content: 'Generate complete Product Hunt launch assets for CallCanvas AI: A $59/month AI territory intelligence tool for outside sales reps. Runs on free Claude AI. Research 50 companies in 90 minutes. No team minimums (vs SPOTIO at $395+/month). Generate: 1) TAGLINE (60 chars max), 2) DESCRIPTION (260 chars), 3) FIRST COMMENT (authentic founder story, 300 words), 4) MAKER COMMENT RESPONSES for 5 common PH questions, 5) LAUNCH DAY CHECKLIST. Format clearly.' }]
    })
  });
  const data = await res.json();
  const assets = data.content?.[0]?.text || '';
  
  try {
    await require('@netlify/blobs').getStore('growth-logs').set('producthunt-assets', JSON.stringify({ generated: new Date().toISOString(), assets }));
  } catch(e) {}
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true, assets }) };
};