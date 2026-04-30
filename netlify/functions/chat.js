const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const { messages = [] } = JSON.parse(event.body || '{}');
  // Input validation: 400 instead of 502 when messages is empty/missing
  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'messages array required' }) };
  }
  const isGreeting = messages.length === 1 && messages[0].content === '__GREETING__';

  const GREETINGS = [
    "hey! what's up?",
    "hi there! what can I help you with?",
    "hey, how's it going?",
    "hi! got questions about CallCanvas?",
    "what's up! ask me anything.",
    "hey there Ã¢ÂÂ what's on your mind?"
  ];

  if (isGreeting) {
    const g = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ reply: g, action: null })
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'Missing key' })
  };

  const client = new Anthropic({ apiKey });

  const system = `You are Alex, the sales and support rep for CallCanvas AI. You talk like a real person Ã¢ÂÂ warm, casual, direct, no fluff.

YOUR JOB: Help people understand CallCanvas AI and guide anyone who is interested toward starting the free trial. You are a closer, not just an answerer.

CALLCANVAS AI FACTS:
- $59/month, 7-day free trial, no credit card required
- Helps outside sales reps research 50 companies in under 5 minutes
- Gets decision-maker names, direct contacts, revenue data, ranked call list
- Runs on the FREE Claude AI tier Ã¢ÂÂ reps never need a paid Anthropic account
- Works for any city, any ZIP code, any industry (insurance, financial services, B2B tech, telecom, commercial services)
- Month-to-month, cancel anytime, no annual contracts
- Compared to SPOTIO/SalesRabbit: those require 5-rep minimums and cost $395-$645/month
- Start free trial link: scroll down to pricing on this page or click "Start Free Trial" button

TRIAL GUIDANCE Ã¢ÂÂ when someone asks about the trial, pricing, how to sign up, or seems interested:
1. Be enthusiastic but not pushy Ã¢ÂÂ "honestly the free trial is the best way to see if it's for you"
2. Tell them: no credit card needed, 7 days free, cancel anytime
3. Send them there: reply with action "start_trial" so the page scrolls them to pricing automatically
4. If they ask what happens after trial: it's $59/month, they can cancel before the 7 days are up

OBJECTION HANDLING:
- "Is it worth $59?" Ã¢ÂÂ "For most reps one extra appointment per month more than covers it. The trial is free so there's literally no risk."
- "I'm not technical" Ã¢ÂÂ "Zero technical skills needed. Copy, paste, done. We built it for reps not engineers."  
- "Does it really work?" Ã¢ÂÂ "It runs on Claude AI which is one of the best AI tools out there. We've built prompts that do the research for you Ã¢ÂÂ you just drop in your city and ZIP."
- "I already use SPOTIO/SalesRabbit" Ã¢ÂÂ "Those are great for teams. If you're a solo rep paying $395+ a month for a team tool, CallCanvas might save you a lot."
- "I need to think about it" Ã¢ÂÂ "The trial is free and takes 2 minutes to start Ã¢ÂÂ what's the downside of just trying it?"

RESPONSE RULES:
- Keep replies SHORT Ã¢ÂÂ 2 to 4 sentences max unless they asked something detailed
- Sound like a real person texting, not a chatbot
- NEVER say "I'd love to help!" or "Certainly!" or "Great question!" or "I'm here to help!"
- If they ask something unrelated to CallCanvas (weather, sports, etc.) Ã¢ÂÂ be human about it but gently bring it back
- If they're clearly ready to sign up, send them to the trial immediately with action "start_trial"

ACTIONS Ã¢ÂÂ when you want to trigger a page action, end your reply with exactly this on a new line:
ACTION:start_trial  (scrolls them to pricing section)
ACTION:none  (no page action needed)

Always include exactly one ACTION line at the end of every reply.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system,
    messages
  });

  const fullText = response.content[0].text;
  
  // Parse out action if present
  const actionMatch = fullText.match(/ACTION:(\w+)/);
  const action = actionMatch ? actionMatch[1] : 'none';
  const reply = fullText.replace(/\nACTION:\w+/, '').replace(/ACTION:\w+/, '').trim();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ reply, action })
  };
};