exports.handler = async () => {
  const today = new Date().toISOString().split('T')[0];
  let linkedin = null, facebook = null, reddit = null;
  
  try {
    const store = require('@netlify/blobs').getStore('growth-logs');
    try { linkedin = JSON.parse(await store.get('linkedin-' + today)); } catch(e) {}
    try { facebook = JSON.parse(await store.get('facebook-' + today)); } catch(e) {}
    try { reddit = JSON.parse(await store.get('reddit-' + today)); } catch(e) {}
  } catch(e) {}
  
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CallCanvas AI — Daily Outreach Dashboard</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#080b10;color:#f0f6fc;padding:32px 24px}h1{color:#0ea5e9;font-size:26px;margin-bottom:4px}.date{color:rgba(240,246,252,.4);font-size:13px;margin-bottom:32px}.section{margin-bottom:28px}.section-title{font-size:14px;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;display:flex;align-items:center;gap:8px}.content{background:#141a24;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:20px;white-space:pre-wrap;font-size:13px;line-height:1.7;color:rgba(240,246,252,.85);max-height:320px;overflow-y:auto}.empty{color:rgba(240,246,252,.3);font-style:italic;font-size:13px}.btn{display:inline-block;background:#0ea5e9;color:#000;font-weight:700;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;margin-top:10px}nav{margin-bottom:24px}nav a{color:#0ea5e9;text-decoration:none;font-size:13px;margin-right:16px}</style>
</head><body>
<nav><a href="/">← Home</a><a href="/growth-log">Growth Dashboard</a><a href="/blog">Blog</a></nav>
<h1>📣 Daily Outreach Dashboard</h1>
<p class="date">Today: ${today} — content auto-generates 8-10 AM UTC daily</p>

<div class="section">
  <div class="section-title">🔵 LinkedIn Post — Ready to Copy & Post</div>
  ${linkedin?.post ? '<div class="content">' + linkedin.post.replace(/</g,'&lt;') + '</div><a class="btn" href="https://linkedin.com/feed/" target="_blank">Post to LinkedIn →</a>' : '<div class="empty">Generates at 8 AM UTC. Check back soon.</div>'}
</div>

<div class="section">
  <div class="section-title">🟡 Facebook Group Comment Scripts</div>
  ${facebook?.scripts ? '<div class="content">' + facebook.scripts.replace(/</g,'&lt;') + '</div><a class="btn" href="https://facebook.com/groups/" target="_blank">Open Facebook Groups →</a>' : '<div class="empty">Generates at 9 AM UTC. Check back soon.</div>'}
</div>

<div class="section">
  <div class="section-title">🟠 Reddit Opportunities — Reply Ready</div>
  ${reddit?.opportunities ? '<div class="content">' + reddit.opportunities.replace(/</g,'&lt;') + '</div><a class="btn" href="https://reddit.com/r/sales/" target="_blank">Open Reddit →</a>' : '<div class="empty">Generates at 10 AM UTC. Check back soon.</div>'}
</div>

<div class="section">
  <div class="section-title">🟢 Product Hunt Launch Assets</div>
  <a class="btn" href="/.netlify/functions/producthunt-prep" target="_blank">Generate Product Hunt Assets →</a>
</div>

<p style="margin-top:32px;font-size:12px;color:rgba(240,246,252,.25)">callcanvasai.com · Outreach runs automatically every morning · <a href="/" style="color:#0ea5e9">Home</a></p>
</body></html>`;
  
  return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: html };
};