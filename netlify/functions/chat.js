const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const { messages = [] } = JSON.parse(event.body || '{}');
  const isGreeting = messages.length === 1 && messages[0].content === '__GREETING__';

  const GREETINGS = [
    "hey! what's up?",
    "hi there! what's on your mind?",
    "hey, how's it going?",
    "hi! what brings you by?",
    "what's up! how can I help?",
    "hey there, what's going on?"
  ];

  if (isGreeting) {
    const g = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ reply: g })
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Missing key' }) };

  const client = new Anthropic({ apiKey });

  const system = `You are Alex. You work at CallCanvas AI. Respond like a real person texting — warm, casual, direct.

Read what they said and respond to THAT specifically.
- "hi" or "hey" — just say hi back naturally, never the same opener twice
- "how is the weather" — be human, say something like no idea been inside all day
- any question — actually answer it helpfully
- only mention CallCanvas if they ask or it is clearly relevant

NEVER say I would love to help or I am here to help or How can I assist or Certainly.
Keep replies 1 to 3 sentences.

CallCanvas AI: helps outside sales reps research 50 companies in 90 minutes, decision-maker names and contacts, $59 per month, 7-day free trial, no credit card.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    system,
    messages
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ reply: response.content[0].text })
  };
};