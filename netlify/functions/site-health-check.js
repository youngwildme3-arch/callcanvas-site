// Site health check for callcanvasai.com
// Runs daily at 6:10 AM Central. Tests backend endpoints AND frontend wiring.
// If site is down (homepage/blog 5xx) OR frontend chat is broken: triggers Netlify rebuild.
// Always writes public/_health.json so latest status is viewable.

const SITE = process.env.SITE_URL || 'https://callcanvasai.com';
const NETLIFY_PAT = process.env.NETLIFY_PAT;
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;
const REPO = process.env.GITHUB_REPO;
const GH_TOKEN = process.env.GITHUB_TOKEN;

const TESTS = [
  { name: 'homepage', method: 'GET', path: '/', expect_text: 'CallCanvas', critical: true },
  { name: 'blog_index', method: 'GET', path: '/blog/', expect_text: 'AI &amp; modern tech', critical: true },
  { name: 'research_page', method: 'GET', path: '/research.html', expect_status: 200, critical: false },
  { name: 'frontend_chat_widget_js', method: 'GET', path: '/', expect_text: 'window.openChat = openChat', critical: true },
  { name: 'frontend_chat_button_present', method: 'GET', path: '/', expect_text: 'cc-chat-btn', critical: true },
  { name: 'frontend_smoke_test_present', method: 'GET', path: '/', expect_text: 'CC-SMOKETEST', critical: false },
  { name: 'frontend_manage_subscription', method: 'GET', path: '/', expect_text: 'openCustomerPortal', critical: false },
  { name: 'create_checkout', method: 'POST', path: '/.netlify/functions/create-checkout', body: { email: 'health-check@callcanvasai.com' }, expect_json_keys: ['url'], critical: false },
  { name: 'validate_coupon', method: 'POST', path: '/.netlify/functions/validate-coupon', body: { code: 'EVAN-FULL-2026' }, expect_json_keys: ['valid'], critical: false },
  { name: 'chat_function', method: 'POST', path: '/.netlify/functions/chat', body: { messages: [{ role: 'user', content: 'health check ping' }] }, expect_json_keys: ['reply'], critical: false },
  { name: 'territory_research_blocks_unauth', method: 'POST', path: '/.netlify/functions/territory-research', body: { city: 'X', product: 'Y' }, expect_status: 403, critical: false },
  { name: 'customer_portal_function', method: 'POST', path: '/.netlify/functions/customer-portal', body: { email: 'nobody-at-all@example.com' }, expect_status: 404, critical: false },
  { name: 'manifest_json', method: 'GET', path: '/blog/manifest.json', expect_json_keys: ['posts'], critical: false }
];

async function runTest(test) {
  const t0 = Date.now();
  try {
    const opts = { method: test.method };
    if (test.method !== 'GET') {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(test.body || {});
    }
    const r = await fetch(SITE + test.path, opts);
    const elapsed = Date.now() - t0;
    const text = await r.text();
    let status_ok, content_ok = true, content_msg = '';

    if (test.expect_status) {
      const expects = Array.isArray(test.expect_status) ? test.expect_status : [test.expect_status];
      status_ok = expects.includes(r.status);
    } else {
      status_ok = r.status >= 200 && r.status < 400;
    }

    if (test.expect_text) {
      content_ok = text.includes(test.expect_text);
      if (!content_ok) content_msg = 'expected text not found in response';
    }
    if (test.expect_json_keys) {
      try {
        const j = JSON.parse(text);
        const missing = test.expect_json_keys.filter(k => !(k in j));
        content_ok = missing.length === 0;
        if (!content_ok) content_msg = 'missing keys: ' + missing.join(', ');
      } catch (e) {
        content_ok = false;
        content_msg = 'invalid JSON in response';
      }
    }

    return {
      name: test.name,
      critical: test.critical,
      ok: status_ok && content_ok,
      status_code: r.status,
      elapsed_ms: elapsed,
      status_ok,
      content_ok,
      content_msg
    };
  } catch (e) {
    return { name: test.name, critical: test.critical, ok: false, error: e.message, elapsed_ms: Date.now() - t0 };
  }
}

async function triggerNetlifyRebuild() {
  if (!NETLIFY_PAT || !NETLIFY_SITE_ID) {
    return { triggered: false, reason: 'NETLIFY_PAT or NETLIFY_SITE_ID env var missing' };
  }
  try {
    const r = await fetch('https://api.netlify.com/api/v1/sites/' + NETLIFY_SITE_ID + '/builds', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + NETLIFY_PAT, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear_cache: true })
    });
    if (!r.ok) return { triggered: false, reason: 'Netlify API ' + r.status };
    return { triggered: true };
  } catch (e) {
    return { triggered: false, reason: e.message };
  }
}

async function writeHealthFile(status) {
  if (!REPO || !GH_TOKEN) return false;
  try {
    const r0 = await fetch('https://api.github.com/repos/' + REPO + '/contents/public/_health.json', {
      headers: { 'Authorization': 'token ' + GH_TOKEN }
    });
    let sha;
    if (r0.status === 200) sha = (await r0.json()).sha;
    const content = Buffer.from(JSON.stringify(status, null, 2), 'utf8').toString('base64');
    const body = {
      message: status.overall_ok
        ? 'Health check OK ' + status.timestamp
        : 'Health check FAILED ' + status.timestamp + ' (' + status.failed_count + ' tests, ' + status.critical_failed_count + ' critical)',
      content
    };
    if (sha) body.sha = sha;
    const r = await fetch('https://api.github.com/repos/' + REPO + '/contents/public/_health.json', {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + GH_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.ok;
  } catch (e) {
    console.error('Failed to write health file:', e.message);
    return false;
  }
}

exports.handler = async (event) => {
  const startedAt = new Date().toISOString();
  console.log('Site health check starting at', startedAt);
  const results = await Promise.all(TESTS.map(runTest));
  const failed = results.filter(r => !r.ok);
  const criticalFailed = failed.filter(r => r.critical);
  const allOk = failed.length === 0;

  let recoveryAction = null;
  if (criticalFailed.length > 0) {
    console.log('Critical failures detected, triggering Netlify rebuild');
    recoveryAction = await triggerNetlifyRebuild();
  }

  const status = {
    timestamp: startedAt,
    overall_ok: allOk,
    failed_count: failed.length,
    critical_failed_count: criticalFailed.length,
    failed_tests: failed.map(f => ({ name: f.name, critical: f.critical, reason: f.content_msg || f.error || ('status ' + f.status_code) })),
    tests: results,
    recovery_action: recoveryAction,
    next_check: 'tomorrow 11:10 UTC (6:10 AM Central)'
  };

  const wrote = await writeHealthFile(status);
  status.status_file_committed = wrote;

  console.log('Health check complete. ok=' + allOk + ' failed=' + failed.length + ' critical=' + criticalFailed.length);
  return { statusCode: 200, body: JSON.stringify(status, null, 2) };
};
