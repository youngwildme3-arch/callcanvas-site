// outreach-dashboard.js — renders /outreach page with today's generated content
const { getStore } = require('@netlify/blobs');

function getStoreSafe() {
  return getStore({
    name: 'growth-logs',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_PAT
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

exports.handler = async () => {
  const today = new Date().toISOString().slice(0, 10);
  let linkedin = null, facebook = null, reddit = null;

  try {
    const store = getStoreSafe();
    const liRaw = await store.get('linkedin-' + today);
    if (liRaw) { try { linkedin = JSON.parse(liRaw); } catch (e) { linkedin = { post: liRaw }; } }
    const fbRaw = await store.get('facebook-' + today);
    if (fbRaw) { try { facebook = JSON.parse(fbRaw); } catch (e) { facebook = { scripts: fbRaw }; } }
    const rdRaw = await store.get('reddit-' + today);
    if (rdRaw) { try { reddit = JSON.parse(rdRaw); } catch (e) { reddit = { opportunities: rdRaw }; } }
  } catch (e) {
    console.error('Blob read failed:', e.message);
  }

  const linkedInBlock = linkedin && linkedin.post
    ? '<pre>' + escapeHtml(linkedin.post) + '</pre><a class="btn" href="https://www.linkedin.com/sharing/share-offsite/?url=https://callcanvasai.com" target="_blank" rel="noopener">Post to LinkedIn</a>'
    : '<p class="muted">Generates at 8 AM UTC. Check back soon.</p>';

  const facebookBlock = facebook && (facebook.scripts || facebook.post)
    ? '<pre>' + escapeHtml(facebook.scripts || facebook.post) + '</pre>'
    : '<p class="muted">Generates at 9 AM UTC. Check back soon.</p>';

  const redditBlock = reddit && (reddit.opportunities || reddit.post)
    ? '<pre>' + escapeHtml(reddit.opportunities || reddit.post) + '</pre>'
    : '<p class="muted">Generates at 10 AM UTC. Check back soon.</p>';

  const html = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Daily Outreach Dashboard - CallCanvas AI</title>\n<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif;background:#080b10;color:#f0f6fc;padding:32px 24px;line-height:1.6}nav{display:flex;gap:18px;margin-bottom:24px;font-size:14px}nav a{color:#0ea5e9;text-decoration:none}nav a:hover{text-decoration:underline}h1{color:#0ea5e9;font-size:28px;margin-bottom:6px;font-weight:800}.date{color:#888;font-size:14px;margin-bottom:32px}.section{margin:32px 0;padding:20px 22px;background:#131b27;border:1px solid rgba(255,255,255,.06);border-radius:12px;max-width:920px}.section-title{display:flex;align-items:center;gap:10px;color:#0ea5e9;font-weight:700;font-size:14px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:14px}.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.dot-blue{background:#3b82f6}.dot-yellow{background:#facc15}.dot-orange{background:#f97316}.dot-green{background:#22c55e}pre{white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace;font-size:13px;line-height:1.6;color:#d1d5db;background:#0b1118;padding:16px;border-radius:8px;border:1px solid rgba(255,255,255,.04);max-height:480px;overflow-y:auto}.muted{color:#666;font-style:italic;font-size:14px}.btn{display:inline-block;margin-top:14px;padding:9px 18px;background:#0ea5e9;color:#000;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px}.btn:hover{background:#0284c7}footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,.06);font-size:12px;color:#666;max-width:920px}footer a{color:#888}</style>\n</head><body>\n<nav><a href="/">&larr; Home</a><a href="/growth-log">Growth Dashboard</a><a href="/blog">Blog</a></nav>\n<h1>Daily Outreach Dashboard</h1>\n<p class="date">Today: ' + today + ' &nbsp;|&nbsp; content auto-generates 8-10 AM UTC daily</p>\n\n<div class="section">\n  <div class="section-title"><span class="dot dot-blue"></span> LinkedIn Post &mdash; Ready to Copy &amp; Post</div>\n  ' + linkedInBlock + '\n</div>\n\n<div class="section">\n  <div class="section-title"><span class="dot dot-yellow"></span> Facebook Group Comment Scripts</div>\n  ' + facebookBlock + '\n</div>\n\n<div class="section">\n  <div class="section-title"><span class="dot dot-orange"></span> Reddit Opportunities &mdash; Reply Ready</div>\n  ' + redditBlock + '\n</div>\n\n<div class="section">\n  <div class="section-title"><span class="dot dot-green"></span> Product Hunt Launch Assets</div>\n  <a class="btn" href="/.netlify/functions/producthunt-prep" target="_blank" rel="noopener">Generate Product Hunt Assets</a>\n</div>\n\n<footer>callcanvasai.com &middot; Outreach runs automatically every morning &middot; <a href="/">Home</a></footer>\n</body></html>';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html
  };
};
