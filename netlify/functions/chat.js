const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SITE_URL = process.env.SITE_URL || 'https://callcanvasai.com';

async function checkSiteHealth() {
  try {
    const start = Date.now();
    const res = await fetch(SITE_URL, { method: 'HEAD' });
    const ms = Date.now() - start;
    return { ok: res.ok, status: res.status, ms };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function webSearch(query) {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    const data = await res.json();
    const results = [];
    if (data.Abstract) results.push(data.Abstract);
    if (data.RelatedTopics) {
      data.RelatedTopics.slice(0, 3).forEach(t => { if (t.Text) results.push(t.Text); });
    }
    return results.join(' ') || null;
  } catch (e) {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const { messages = [] } = JSON.parse(event.body || '{}');
  const lastMsg = messages[messages.length - 1]?.content || '';
  const lowerMsg = lastMsg.toLowerCase();

  // Detect site issue questions
  const isSiteIssue = /not working|broken|down|error|load|slow|glitch|blank|white screen|won't open|can't access|404|502|503|crash|freeze|bug/i.test(lastMsg);

  // Detect research questions (things Alex shouldn't make up)
  const isResearchQ = /what is|who is|how does|explain|tell me about|what are|difference between|compare|best way to|how to|when did|why does/i.test(lastMsg) && !/callcanvas|price|trial|cost|signup/i.test(lastMsg);

  let extraContext = '';

  if (isSiteIssue) {
    const health = await checkSiteHealth();
    if (health.ok) {
      extraContext = `SITE STATUS CHECK: callcanvasai.com is UP and responding in ${health.ms}ms. The issue is likely on the user's end.`;
    } else {
      extraContext = `SITE STATUS CHECK: callcanvasai.com appears to be DOWN or unreachable (error: ${health.error || health.status}). This is a real issue.`;
    }
  }

  if (isResearchQ && !extraContext) {
    const searchResult = await webSearch(lastMsg);
    if (searchResult) {
      extraContext = `WEB SEARCH RESULT for "${lastMsg}": ${searchResult.substring(0, 600)}`;
    }
  }

  const system = `You are Alex, a friendly assistant for CallCanvas AI. You help outside sales reps figure out if CallCanvas is right for them — and you help with any question they have, even if it's not about CallCanvas.

PERSONALITY:
- Conversational and natural — like texting a knowledgeable friend
- Curious first: ask questions before pitching anything
- Short responses — 1-3 sentences unless they need detail
- Use casual language: "yeah", "totally", "honestly", "that makes sense"
- Never repeat the same opener twice
- React specifically to what they say — don't ignore their words

WHAT YOU CAN DO:
1. Answer questions about CallCanvas AI (pricing, features, who it's for)
2. Answer general questions — you have web search available, use it to give accurate answers
3. Help with site issues — you can check if callcanvasai.com is actually up or down right now
4. Have a real conversation — don't just sell

WHAT CALLCANVAS DOES:
- Researches 50 companies in 90 minutes before a sales rep leaves the driveway
- Pulls decision-maker names, direct contacts, revenue data, ranked call list
- Built for outside sales reps in insurance, financial services, B2B tech, telecom, commercial services
- $59/month, 7-day free trial, no credit card, cancel anytime
- Works on free tools — no extra software needed

HANDLING SITE ISSUES:
If someone reports the site not loading, glitching, or behaving oddly:
- Check the live site status data provided in your context
- If the site is UP: the issue is likely their browser cache, VPN, or internet — give specific fixes
- If the site is DOWN: be honest, acknowledge it, tell them to try the backup URL: https://coruscating-squirrel-b8563f.netlify.app
- Common fixes to suggest: clear browser cache (Ctrl+Shift+Delete), try incognito mode, try a different browser, disable VPN, try mobile data instead of WiFi

HANDLING GENERAL QUESTIONS:
- Use the web search result provided in your context if available
- Be honest if you're not sure — "I'm not 100% sure but..." is fine
- Keep answers short and direct

APPROACH:
1. First message: ask what they do or what brought them here — don't pitch immediately  
2. Listen and respond specifically to what they said
3. Only bring up CallCanvas when relevant
4. If they ask price: $59/month, free trial, no credit card
5. If they're not a fit, say so

NEVER:
- Introduce yourself as "Alex, an AI assistant" every single message
- Give a pitch as the first response
- Say "Certainly!" or "Absolutely!" or "Great question!"
- Give responses longer than 4 sentences unless they asked for detail
- Make up facts — use the search result or say you're not sure

${extraContext ? '\nCONTEXT FOR THIS RESPONSE:\n' + extraContext : ''}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    system,
    messages
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
    body: JSON.stringify({ reply: response.content[0].text })
  };
};