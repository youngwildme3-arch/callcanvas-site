// check-access.js — determines whether a given email/coupon has active access

const { getStore } = require('@netlify/blobs');

const FREE_PASS_COUPONS = ['EVAN-FULL-2026', 'BETA-TEST'];

function getSubscribersStore() {
  // Always use explicit config — Blobs auto-config is unreliable in some function contexts
  return getStore({
    name: 'subscribers',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_PAT
  });
}

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
    const store = getSubscribersStore();
    record = await store.get(key, { type: 'json' });
  } catch (e) {
    console.error('Blob get failed for', key, ':', e.message);
    // Fail closed if explicitly configured but still broken — better to deny than to leak access
    if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_PAT) {
      return { hasAccess: false, reason: 'blob_error_fail_closed', error: e.message };
    }
    // Only fail-open if creds are missing entirely (avoid locking out everyone during config issues)
    return { hasAccess: true, reason: 'blob_unconfigured_fail_open', error: e.message };
  }
  if (!record) {
    return { hasAccess: false, reason: 'no_record' };
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
