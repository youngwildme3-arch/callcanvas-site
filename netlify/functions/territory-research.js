const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  const { city, state, industry, product } = JSON.parse(event.body || '{}');
  if (!city || !industry) return { statusCode: 400, headers, body: JSON.stringify({ error: 'City and industry required' }) };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a territory research engine for outside sales reps. Research real local businesses in ${city}, ${state || 'IL'} for a rep selling ${product || industry}.

Research 20 real companies. For each find: real business name, street address, phone number, owner or GM name, employee count, why they need ${product || industry}, personalized cold call opening line, 3 talk track points, priority score 1-10.

Return ONLY valid JSON:
{
  "city": "${city}",
  "state": "${state || 'IL'}",
  "industry": "${industry}",
  "generated_at": "${new Date().toISOString()}",
  "companies": [
    {
      "rank": 1,
      "priority": 9,
      "name": "Business Name",
      "address": "123 Main St, ${city} IL",
      "phone": "(630) 555-1234",
      "owner": "Owner Name",
      "owner_title": "Owner",
      "employees": 14,
      "revenue_est": "$1M-3M",
      "business_type": "HVAC Contractor",
      "why_prospect": "specific reason they need this coverage",
      "cold_open": "personalized opening line referencing something real about this business",
      "talk_tracks": ["point 1", "point 2", "point 3"]
    }
  ]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      system: 'You are a territory research assistant. Return only valid JSON. No markdown, no explanation.',
      messages: [{ role: 'user', content: prompt }]
    });

    let resultText = '';
    for (const block of response.content) {
      if (block.type === 'text') resultText += block.text;
    }

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const data = JSON.parse(jsonMatch[0]);

    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};