exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Missing key' }) };
  let messages;
  try { messages = JSON.parse(event.body).messages || []; } catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Bad JSON' }) }; }
  const system = "You are the CallCanvas AI support assistant — a friendly, concise helper for outside sales reps. CallCanvas AI is $59/month, 7-day free trial, no credit card to start. It lets reps research 50 companies in 90 minutes using the free Claude AI tier + Google Sheets + their phone. Works for insurance, financial services, B2B tech, telecom. Setup takes 10 minutes. vs SPOTIO/SalesRabbit which cost $395-645/month with 5-seat minimums. Answer questions in 1-3 sentences. Be warm and encouraging. If hesitant, mention the free trial. End most responses by inviting them to start their free trial at callcanvasai.com/#pricing";
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system, messages })
  });
  const data = await res.json();
  const reply = data.content?.[0]?.text || 'Try again in a moment!';
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ reply }) };
};