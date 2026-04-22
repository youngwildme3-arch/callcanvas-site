// Coupon validation for CallCanvas AI
// Valid codes unlock full research access without payment
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const { code } = JSON.parse(event.body || '{}');
  if (!code) return { statusCode: 400, headers, body: JSON.stringify({ valid: false, error: 'No code provided' }) };

  const normalized = String(code).trim().toUpperCase();
  
  // Coupon registry
  const COUPONS = {
    'EVAN-FULL-2026': {
      valid: true,
      owner: 'Evan Jones',
      access: 'full',
      expires: '2026-12-31',
      description: 'Owner full access - unlimited research',
      max_uses: 9999
    },
    'DEBUG-5DAYS': {
      valid: true,
      owner: 'Debug team',
      access: 'full',
      expires: '2026-04-27',
      description: '5-day debug access for beta testing',
      max_uses: 100
    },
    'BETA-TEST': {
      valid: true,
      owner: 'Beta testers',
      access: 'full',
      expires: '2026-05-31',
      description: 'Beta tester access',
      max_uses: 50
    }
  };

  const coupon = COUPONS[normalized];
  
  if (!coupon) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ valid: false, error: 'Invalid coupon code' })
    };
  }

  // Check expiration
  const now = new Date();
  const expires = new Date(coupon.expires);
  if (now > expires) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ valid: false, error: 'Coupon expired' })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      valid: true,
      access: coupon.access,
      owner: coupon.owner,
      description: coupon.description,
      expires: coupon.expires
    })
  };
};