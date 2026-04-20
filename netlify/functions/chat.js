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

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-ant-api03-whoESRHVe7D2m9m3FOzrzZahXpw4hlyh86-CsbZYwNI6RWXRaHp3VBSpIIJV-rblec8_Wq-Wls7LS5776aRgaw-6KOoVgAA';
  const client = new Anthropic({ apiKey });

  const system = `You are Alex. You work at CallCanvas AI. Respond exactly like a real person texting — warm, casual, direct.

THE ONE RULE: Read what they said and respond to THAT specifically. Like a real human texting back.
- "hi" or "hey" → just say hi back naturally, different every time, never the same opener
- "how's the weather?" → something like "haha no idea, been inside all day — hope it's nice out for you!"
- any question → actually answer it fully and helpfully
- venting or chatting → go with it like a real friend would
- curious about CallCanvas → tell them about it

NEVER say "I'd love to help!" or "I'm here to help!" or "How can I assist you today?" or "Certainly!" or "Great question!"
Keep replies SHORT — 1 to 3 sentences max unless they asked for detail.

About CallCanvas AI (only if relevant): helps outside sales reps research 50 companies in 90 min, decision-maker names/contacts/revenue, $59/month, 7-day free trial no credit card.`;

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