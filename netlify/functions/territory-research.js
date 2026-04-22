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

  const makePrompt = (batch, startRank) => `You are a territory research engine for outside sales reps. Research real local businesses in ${city}, ${state || 'IL'} for a rep selling ${product || industry}.

Research exactly 10 real companies for batch ${batch}. ${batch === 2 ? 'These must be DIFFERENT from batch 1 — focus on different business types/industries to avoid duplicates.' : 'Focus on the highest priority prospects.'}

For each find: real business name, street address, phone number, owner or GM name, employee count, why they need ${product || industry}, personalized cold call opening line, 3 talk track points, priority score 1-10.

Return ONLY valid JSON with companies array (rank starts at ${startRank}):
{
  "companies": [
    {
      "rank": ${startRank},
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

  const callBatch = async (batch, startRank) => {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: 'You are a territory research assistant. Return only valid JSON. No markdown, no explanation.',
      messages: [{ role: 'user', content: makePrompt(batch, startRank) }]
    });
    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') text += block.text;
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in batch ' + batch);
    return JSON.parse(match[0]).companies || [];
  };

  try {
    // Run two parallel 10-company calls
    const [batch1, batch2] = await Promise.all([
      callBatch(1, 1),
      callBatch(2, 11)
    ]);
    
    const allCompanies = [...batch1, ...batch2];
    
    const result = {
      city,
      state: state || 'IL',
      industry,
      generated_at: new Date().toISOString(),
      companies: allCompanies
    };

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};