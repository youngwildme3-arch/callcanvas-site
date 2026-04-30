// SEO Monitor - weekly Mon 8am UTC. Asks Claude what to publish next.
exports.handler = async () => {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'ANTHROPIC_API_KEY not set' }) };
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `You are a sales SEO strategist for CallCanvas AI (territory research tool for outside sales reps, $59/mo). It is ${today}. Suggest 3 blog topics that would rank well and attract our target audience (outside B2B sales reps in insurance, telecom, fleet, energy). Output as JSON only: {"topics":[{"title":"...","keyword":"...","why":"..."}]}`;
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 25000);
    let resp;
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-5-20250929', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
      });
    } finally { clearTimeout(timeoutId); }
    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'anthropic_failed', status: resp.status, detail: errText.substring(0, 200) }) };
    }
    const data = await resp.json();
    const text = (data.content && data.content[0] && data.content[0].text) || '';
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, date: today, suggestions: text }) };
  } catch (err) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: err.message || 'unknown_error' }) };
  }
};