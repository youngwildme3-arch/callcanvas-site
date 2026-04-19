exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const ref = p.ref || 'direct';
  console.log('[Affiliate] ref=' + ref + ' time=' + new Date().toISOString());
  return {
    statusCode: 302,
    headers: {
      Location: 'https://callcanvasai.com/#pricing',
      'Set-Cookie': 'ccref=' + ref + '; Max-Age=2592000; Path=/; SameSite=Lax'
    },
    body: ''
  };
};