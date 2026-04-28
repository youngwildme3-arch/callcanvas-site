// check-access.js — determines whether a given email/coupon has active access
// Returns: { hasAccess: bool, reason: string, status?: string, periodEnd?: number }

const { getStore } = require('@netlify/blobs');

const FREE_PASS_COUPONS = ['EVAN-FULL-2026', 'BETA-TEST'];

async function checkAccess({ email, couponCode }) {
  if (couponCode && FREE_PASS_COUPONS.includes(String(couponCode).toUpperCase().trim())) {
    return { hasAccess: true, reason: 'coupon', status: 'coupon' };
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return { hasAccess: false, reason: 'no_email' };
  }
  const key = email.trim().toLowerCase();
  let record;
  try {
    const store = getStore('subscribers');
    record = await store.get(key, { type: 'json' });
  } catch (e) {
    return { hasAccess: true, reason: 'blob_error_fail_open', error: e.message };
  }
  if (!record) {
    return { hasAccess: true, reason: 'no_record_fail_open' };
  }
  const now = Math.floor(Date.now() / 1000);
  const status = record.status;
  const periodEnd = record.current_period_end || 0;
  if (status === 'active' || status === 'trialing') {
    return { hasAccess: true, reason: 'subscribed', status, periodEnd };
  }
  if (status === 'canceled' && periodEnd > now) {
    return { hasAccess: true, reason: 'canceled_in_period', status, periodEnd };
  }
  return { hasAccess: false, reason: status || 'unknown_status', status, periodEnd };
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}
  const result = await checkAccess(body);
  return { statusCode: 200, headers, body: JSON.stringify(result) };
};

exports.checkAccess = checkAccess;
