const { getStore } = require('@netlify/blobs');
exports.handler = async (event) => {
  const slug = event.path.replace('/blog/', '').replace(/\//g, '');
  try {
    const store = getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
    const content = await store.get('blog-' + slug);
    if (content) return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: content };
  } catch(e) {}
  return { statusCode: 302, headers: { Location: '/blog' }, body: '' };
};