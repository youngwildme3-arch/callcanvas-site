const { getStore } = require('@netlify/blobs');
exports.handler = async (event) => {
  const slug = event.path.replace('/blog/', '').replace(/\//g, '');
  try {
    const store = getStore('growth-logs');
    const content = await store.get('blog-' + slug);
    if (content) return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: content };
  } catch(e) {}
  return { statusCode: 302, headers: { Location: '/blog' }, body: '' };
};