const { schedule } = require('@netlify/functions');
const handler = async () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  const SITE = process.env.SITE_URL || 'https://callcanvasai.com';
  if (!KEY) return { statusCode: 500, body: 'Missing ANTHROPIC_API_KEY' };
  const today = new Date().toISOString().split('T')[0];
  const cats = ['AI tools for outside sales trending today','territory research software news','SPOTIO alternative searches today','outside sales productivity trending','insurance sales AI tools today','B2B field sales tools trending','outside sales success strategies'];
  const cat = cats[new Date().getDay() % cats.length];
  async function claude(prompt, tokens) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: tokens || 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }] })
    });
    const d = await r.json();
    return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/, '').substring(0,60); }
  function field(t, f) { const m = t.match(new RegExp(f + ':[^\n]+')); return m ? m[0].replace(f+':','').trim() : ''; }
  console.log('[Blog] Starting ' + today);
  const meta = await claude('Today is '+today+'. Search for most-searched topic in: '+cat+'. Return KEYWORD: [3-6 words] and TITLE: [blog title]', 400);
  const keyword = field(meta,'KEYWORD') || cat;
  const title = field(meta,'TITLE') || ('Outside Sales Guide: ' + keyword);
  const postSlug = slug(title) + '-' + today;
  const html = await claude('Write complete 1200-word HTML blog post for callcanvasai.com. Title: "'+title+'". Keyword: "'+keyword+'". Dark theme (#080b10 bg). Include schema, nav to callcanvasai.com, FAQ, CTA to start free trial at callcanvasai.com/#pricing', 4000);
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore('growth-logs');
    await store.set('blog-' + postSlug, html);
    await store.set('blog-meta-' + today, JSON.stringify({ slug: postSlug, title, keyword, date: today }));
    console.log('[Blog] Published: ' + title);
  } catch(e) { console.error('[Blog] Storage error:', e.message); }
  return { statusCode: 200, body: JSON.stringify({ title, keyword, slug: postSlug }) };
};
module.exports.handler = schedule('0 6 * * *', handler);