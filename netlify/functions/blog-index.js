const { getStore } = require('@netlify/blobs');
exports.handler = async () => {
  let posts = [];
  try {
    const store = getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
    const list = await store.list({ prefix: 'blog-' });
    posts = list.blobs?.map(b => ({ slug: b.key.replace('blog-', '') })) || [];
  } catch(e) {}
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CallCanvas AI Blog</title>
<style>body{font-family:system-ui,sans-serif;background:#080b10;color:#f0f6fc;max-width:800px;margin:0 auto;padding:40px 24px}h1{color:#0ea5e9}a{color:#0ea5e9}.post{padding:16px 0;border-bottom:1px solid rgba(255,255,255,.08)}</style>
</head><body><nav><a href="/">â CallCanvas AI</a></nav><h1>Blog</h1>
<p style="color:rgba(240,246,252,.5)">Daily posts on territory intelligence, outside sales, and AI tools.</p>
${posts.length ? posts.map(p => `<div class="post"><a href="/blog/${p.slug}">${p.slug.replace(/-/g,' ')}</a></div>`).join('') : '<p style="opacity:.5">First post publishes tomorrow at 6 AM UTC.</p>'}
</body></html>`;
  return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: html };
};