exports.handler = async () => {
  let log = null;
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'growth-logs', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_PAT });
    const keys = await store.list();
    const latest = keys.blobs?.sort()?.reverse()?.[0]?.key;
    if (latest) { const raw = await store.get(latest); log = JSON.parse(raw); }
  } catch(e) {}
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CallCanvas AI Growth Dashboard</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#080b10;color:#f0f6fc;padding:40px 24px}h1{color:#0ea5e9;font-size:28px;margin-bottom:8px}.sub{color:rgba(240,246,252,.4);margin-bottom:32px;font-size:14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:32px}.card{background:#141a24;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px}.card h2{color:#0ea5e9;font-size:14px;font-weight:700;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em}.dot{width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:6px}.item{padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;color:rgba(240,246,252,.8)}.item:last-child{border:none}.log{background:#141a24;border:1px solid rgba(14,165,233,.2);border-radius:12px;padding:20px;white-space:pre-wrap;font-size:12px;color:rgba(240,246,252,.7);max-height:400px;overflow:auto}</style>
</head>
<body>
<h1>ð¤ CallCanvas AI â Autonomous Growth Engine</h1>
<p class="sub">Self-optimizing 24/7 Â· Last run: ${log?.date || 'Starting up...'}</p>
<div class="grid">
<div class="card"><h2>Active Automations</h2>
<div class="item"><span class="dot"></span>Daily Blog â 6:00 AM UTC</div>
<div class="item"><span class="dot"></span>Growth Optimizer â 7:00 AM UTC</div>
<div class="item"><span class="dot"></span>SEO Monitor â Monday 8:00 AM UTC</div>
<div class="item"><span class="dot"></span>Affiliate Tracker â /ref?ref=CODE</div>
</div>
<div class="card"><h2>Today's Actions</h2>
<div class="item">Blog: targeting trending keyword</div>
<div class="item">Evaluating all traffic channels</div>
<div class="item">Dropping underperformers</div>
<div class="item">Finding new opportunities</div>
</div>
<div class="card"><h2>Monthly Cost</h2>
<div class="item">Daily blog posts: ~$1.20/mo</div>
<div class="item">Growth optimizer: ~$1.50/mo</div>
<div class="item">SEO monitor: ~$0.20/mo</div>
<div class="item" style="color:#22c55e;font-weight:700">TOTAL: ~$2.90/month</div>
</div>
</div>
${log ? '<div class="log"><strong style=color:#0ea5e9>Latest Growth Report:</strong>\n\n' + log.evaluation + '</div>' : ''}
<p style="margin-top:24px;color:rgba(240,246,252,.3);font-size:12px">callcanvasai.com Â· <a href="/" style="color:#0ea5e9">Home</a> Â· <a href="/blog" style="color:#0ea5e9">Blog</a></p>
</body></html>`;
  
  return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: html };
};