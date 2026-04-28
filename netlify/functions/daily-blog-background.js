// Daily blog generator for callcanvasai.com
// Picks a broad AI/tech/innovation topic from rotation, calls Claude with web search
// to research current data, writes ~1,400-word SEO post, commits as static HTML to GitHub.
// Cron: 0 11 * * * (6 AM Central) - configured in netlify.toml

const TOPICS = [
  { id: 'chatgpt-openai', label: 'Latest ChatGPT and OpenAI news, GPT model updates, new features, OpenAI strategy', kw: 'ChatGPT, OpenAI, GPT-5' },
  { id: 'humanoid-robots', label: 'Humanoid robots — Tesla Optimus, Figure, Apptronik, Boston Dynamics, Agility, latest demos and deployments', kw: 'humanoid robots, Tesla Optimus, Figure robot, Boston Dynamics' },
  { id: 'self-driving', label: 'Self-driving cars and robotaxis — Waymo expansion, Tesla FSD progress, Apollo Go, Cruise', kw: 'self driving cars, Waymo, Tesla FSD, robotaxi' },
  { id: 'spacex-mars', label: 'SpaceX, Starship launches, Mars colonization, modern rocket and space technology', kw: 'SpaceX, Starship, Mars, rocket' },
  { id: 'ai-jobs', label: 'AI replacing jobs — what 2026 data actually shows, which jobs are safe, displacement timelines', kw: 'AI replacing jobs, AI automation, jobs at risk' },
  { id: 'ai-agents', label: 'AI agents in 2026 — what they actually do, where they fail, agentic AI reality check', kw: 'AI agents, agentic AI, autonomous AI' },
  { id: 'quantum-computing', label: 'Quantum computing breakthroughs in 2026, IBM, Google quantum supremacy, qubit milestones', kw: 'quantum computing, qubits, IBM quantum' },
  { id: 'nvidia-chips', label: 'NVIDIA AI chips, Blackwell, AI hardware market, GPU economics, chip shortage', kw: 'NVIDIA, AI chips, Blackwell GPU' },
  { id: 'ai-medicine', label: 'AI in medicine and healthcare 2026 — diagnosis, drug discovery, medical imaging breakthroughs', kw: 'AI medicine, AI healthcare, AI drug discovery' },
  { id: 'ai-finance', label: 'AI in finance and trading 2026 — algorithmic trading, AI hedge funds, financial AI', kw: 'AI finance, AI trading, algorithmic trading' },
  { id: 'apple-intelligence', label: 'Apple Intelligence updates, Apple AI strategy, iOS AI features, Siri evolution', kw: 'Apple Intelligence, Apple AI, Siri' },
  { id: 'claude-ai', label: 'Anthropic Claude AI updates and capabilities, Claude vs competitors, new Claude features', kw: 'Claude AI, Anthropic, Claude vs ChatGPT' },
  { id: 'google-gemini', label: 'Google Gemini updates, Gemini features, Google AI Mode, Gemini in Workspace', kw: 'Google Gemini, Gemini AI, Google AI' },
  { id: 'ai-images', label: 'AI image generators 2026 — Midjourney, DALL-E, Stable Diffusion, Flux, comparison', kw: 'AI image generator, Midjourney, DALL-E' },
  { id: 'ai-video', label: 'AI video generators — Sora, Veo, Runway, Pika, latest capabilities and limits', kw: 'AI video generator, Sora, AI video' },
  { id: 'ai-music', label: 'AI music generators — Suno, Udio, AI-generated music, copyright debates', kw: 'AI music, Suno, Udio' },
  { id: 'ai-coding', label: 'AI coding tools in 2026 — Cursor, GitHub Copilot, Claude Code, AI software engineering', kw: 'AI coding, Cursor, GitHub Copilot, Claude Code' },
  { id: 'ai-bubble', label: 'AI bubble debate — investment, valuations, IPOs, will it burst', kw: 'AI bubble, AI investment, AI valuations' },
  { id: 'ai-safety', label: 'AI safety and alignment in 2026 — frontier risks, governance, regulations', kw: 'AI safety, AI alignment, AI regulation' },
  { id: 'china-us-ai', label: 'China vs US AI race — DeepSeek, Alibaba, geopolitical competition', kw: 'China AI, DeepSeek, US China AI race' },
  { id: 'ai-education', label: 'AI in education — students using ChatGPT, AI tutors, university policies', kw: 'AI in education, ChatGPT in school, AI tutoring' },
  { id: 'ai-science', label: 'AI in scientific discovery — protein folding, materials science, AI for physics', kw: 'AI science, AI drug discovery, AlphaFold' },
  { id: 'neuralink-bci', label: 'Brain-computer interfaces — Neuralink, Synchron, BCI breakthroughs in 2026', kw: 'Neuralink, brain computer interface, BCI' },
  { id: 'ai-energy', label: 'AI energy consumption and data centers — power demand, cooling, water use', kw: 'AI energy, AI data centers, AI power' },
  { id: 'agi-timeline', label: 'AGI timeline debate — when will AGI actually arrive, predictions from researchers', kw: 'AGI, artificial general intelligence, when AGI' },
  { id: 'ai-cybersecurity', label: 'AI in cybersecurity — AI hackers, AI defense, deepfakes, AI scams', kw: 'AI cybersecurity, AI hacking, deepfakes' },
  { id: 'physical-ai', label: 'Physical AI and embodied AI — robotics meets AI, NVIDIA Cosmos, world models', kw: 'physical AI, embodied AI, NVIDIA robotics' },
  { id: 'ai-customer-service', label: 'AI in customer service — chatbots, voice agents, support automation 2026', kw: 'AI customer service, AI chatbots, voice AI' },
  { id: 'warehouse-robots', label: 'Robotics in warehouses — Amazon, Walmart, Symbotic, robot logistics', kw: 'warehouse robots, Amazon robots, logistics automation' },
  { id: 'open-source-ai', label: 'Open source AI vs closed AI — Llama, DeepSeek, Mistral, the open ecosystem', kw: 'open source AI, Llama, DeepSeek, Mistral' }
];

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function postPageHtml(post) {
  const safeTitle = escapeHtml(post.title);
  const safeDesc = escapeHtml(post.metaDescription);
  const truncTitle = escapeHtml((post.title||'').substring(0, 40));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} - CallCanvas AI</title>
<meta name="description" content="${safeDesc}">
<link rel="canonical" href="https://callcanvasai.com/blog/${post.slug}/">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDesc}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://callcanvasai.com/blog/${post.slug}/">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#080b10;color:#f0f6fc;line-height:1.7;-webkit-font-smoothing:antialiased}
nav{background:rgba(8,11,16,.96);border-bottom:1px solid rgba(255,255,255,.07);height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,5vw,64px);position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)}
.logo{font-size:19px;font-weight:900;color:#0ea5e9;text-decoration:none;letter-spacing:.02em}
.nav-cta{padding:9px 18px;background:#0ea5e9;color:#000;border-radius:8px;font-size:13px;font-weight:800;text-decoration:none}
.wrap{max-width:760px;margin:0 auto;padding:64px 24px 96px}
.crumb{font-size:13px;color:rgba(240,246,252,.45);margin-bottom:24px}
.crumb a{color:#0ea5e9;text-decoration:none}
h1{font-size:clamp(30px,5vw,46px);font-weight:900;line-height:1.15;margin-bottom:16px;letter-spacing:-.01em}
.meta{display:flex;gap:16px;font-size:13px;color:rgba(240,246,252,.45);margin-bottom:48px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,.07)}
.lead{font-size:20px;color:rgba(240,246,252,.85);margin-bottom:32px;font-weight:500;line-height:1.55}
h2{font-size:26px;font-weight:800;margin:40px 0 16px;letter-spacing:-.005em}
h3{font-size:19px;font-weight:700;margin:32px 0 12px;color:#0ea5e9}
p{font-size:16px;color:rgba(240,246,252,.78);margin-bottom:18px}
strong{color:#f0f6fc;font-weight:700}
ul,ol{margin:16px 0 24px 24px}
li{font-size:16px;color:rgba(240,246,252,.78);margin-bottom:10px}
a{color:#0ea5e9;text-decoration:none;border-bottom:1px solid rgba(14,165,233,.3)}
a:hover{border-bottom-color:#0ea5e9}
table{width:100%;border-collapse:collapse;margin:24px 0;background:#131b27;border:1px solid rgba(255,255,255,.07);border-radius:10px;overflow:hidden;font-size:14px}
th,td{padding:12px 16px;text-align:left;border-bottom:1px solid rgba(255,255,255,.05)}
th{background:rgba(14,165,233,.05);font-weight:700;color:#0ea5e9;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
td{color:rgba(240,246,252,.78)}
tr:last-child td{border-bottom:none}
footer{border-top:1px solid rgba(255,255,255,.07);margin-top:64px;padding:32px 0;text-align:center;font-size:13px;color:rgba(240,246,252,.4)}
footer a{color:rgba(240,246,252,.6)}
</style>
</head>
<body>
<nav>
  <a class="logo" href="/">CALLCANVAS AI</a>
  <a class="nav-cta" href="/research.html">Try Free for 7 Days</a>
</nav>
<div class="wrap">
  <div class="crumb"><a href="/">Home</a> &nbsp;/&nbsp; <a href="/blog/">Blog</a> &nbsp;/&nbsp; ${truncTitle}...</div>
  <h1>${safeTitle}</h1>
  <div class="meta">
    <span>${post.dateDisplay}</span>
    <span>${post.readTime}</span>
    <span>By the CallCanvas Team</span>
  </div>
  ${post.bodyHtml}
  <footer>
    <p>Published ${post.dateDisplay} &nbsp;|&nbsp; <a href="/blog/">More posts</a> &nbsp;|&nbsp; <a href="/">CallCanvas AI</a></p>
  </footer>
</div>
</body>
</html>`;
}

function blogIndexHtml(posts) {
  const cards = posts.map(p => `    <a class="post-card" href="/blog/${p.slug}/">
      <div class="post-meta">${p.dateDisplay} &nbsp;&middot;&nbsp; ${p.readTime}</div>
      <div class="post-title">${escapeHtml(p.title)}</div>
      <div class="post-desc">${escapeHtml(p.metaDescription)}</div>
      <div class="post-tag">Read full post &rarr;</div>
    </a>`).join('\n\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blog - CallCanvas AI</title>
<meta name="description" content="Daily articles on AI, robotics, space tech, and modern innovation — written for anyone tracking how AI is reshaping the world.">
<link rel="canonical" href="https://callcanvasai.com/blog/">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#080b10;color:#f0f6fc;line-height:1.65;-webkit-font-smoothing:antialiased}
nav{background:rgba(8,11,16,.96);border-bottom:1px solid rgba(255,255,255,.07);height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,5vw,64px);position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)}
.logo{font-size:19px;font-weight:900;color:#0ea5e9;text-decoration:none;letter-spacing:.02em}
.nav-cta{padding:9px 18px;background:#0ea5e9;color:#000;border-radius:8px;font-size:13px;font-weight:800;text-decoration:none}
.wrap{max-width:880px;margin:0 auto;padding:64px 24px 96px}
.crumb{font-size:13px;color:rgba(240,246,252,.45);margin-bottom:24px}
.crumb a{color:#0ea5e9;text-decoration:none}
h1{font-size:clamp(34px,5vw,52px);font-weight:900;line-height:1.1;margin-bottom:16px;letter-spacing:-.01em}
h1 em{color:#0ea5e9;font-style:normal}
.lede{font-size:18px;color:rgba(240,246,252,.65);margin-bottom:48px;max-width:640px}
.posts{display:flex;flex-direction:column;gap:20px}
.post-card{background:#131b27;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:28px;transition:border-color .2s,transform .2s;display:block;text-decoration:none}
.post-card:hover{border-color:rgba(14,165,233,.4);transform:translateY(-2px)}
.post-meta{font-size:12px;font-weight:600;color:#0ea5e9;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px}
.post-title{font-size:23px;font-weight:800;color:#f0f6fc;margin-bottom:10px;line-height:1.25}
.post-desc{font-size:15px;color:rgba(240,246,252,.6);line-height:1.55}
.post-tag{display:inline-block;margin-top:14px;font-size:12px;color:#0ea5e9;font-weight:600}
footer{border-top:1px solid rgba(255,255,255,.07);margin-top:64px;padding:32px 0;text-align:center;font-size:13px;color:rgba(240,246,252,.4)}
footer a{color:rgba(240,246,252,.6);text-decoration:none}
</style>
</head>
<body>
<nav>
  <a class="logo" href="/">CALLCANVAS AI</a>
  <a class="nav-cta" href="/research.html">Try Free for 7 Days</a>
</nav>
<div class="wrap">
  <div class="crumb"><a href="/">Home</a> &nbsp;/&nbsp; Blog</div>
  <h1>The latest in <em>AI &amp; modern tech.</em></h1>
  <p class="lede">Daily articles on AI, robotics, space tech, and the technology shaping 2026 — written for anyone tracking how the world is changing.</p>
  <div class="posts">
${cards}
  </div>
  <footer>
    <p>New post every day at 6 AM Central. <a href="/">Back to CallCanvas AI</a></p>
  </footer>
</div>
</body>
</html>`;
}

async function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error('Claude API error: ' + (data.error ? data.error.message : r.status));
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  if (!text) throw new Error('Claude returned no text content');
  return text;
}

function buildPrompt(topic, dateDisplay) {
  return `Today's date is ${dateDisplay}. You are writing a blog post for callcanvasai.com — a website that publishes daily articles about modern AI, robotics, space technology, and innovation. The blog is optimized for Google search traffic and reaches a broad audience interested in tech.

Topic for today: ${topic.label}
Target keywords: ${topic.kw}

Use the web_search tool to find the LATEST 2026 news, statistics, and developments on this topic. Then write a comprehensive ~1,400-word SEO-optimized blog post.

Voice: Industry insider with strong, well-grounded opinions. Concrete examples, real company names, real numbers. NO sales pitches, NO mentions of CallCanvas's product or services.

Structure required:
- Strong hook lead paragraph
- 8-12 H2 subheadings, mix question-format with statement-format
- At least one comparison table where it makes sense
- Real statistics with sources cited inline (e.g., "according to Stanford 2026 AI Index")
- FAQ section at the end with 4-6 questions for Google's "People Also Ask"
- Conclusion that gives a clear takeaway, no sales CTA

Output JSON ONLY in this exact format (no markdown code fences, just raw JSON):
{
  "slug": "url-safe-slug",
  "title": "Full SEO Title (under 60 characters ideally)",
  "metaDescription": "150-160 character meta description",
  "primaryKeyword": "main target keyword",
  "bodyHtml": "Full article HTML body — start with <p class=\\"lead\\">lead paragraph here</p>, then all body content. Use <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <a href=\\"...\\">. Do NOT include <h1>, <html>, <head>, <body>. End with <h2>Frequently asked questions</h2> followed by <h3>Question?</h3><p>Answer.</p> pairs. ESCAPE all double quotes inside the HTML as \\\" so the JSON parses correctly."
}`;
}

function extractJson(text) {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) {
    t = fence[1].trim();
  } else {
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) t = t.substring(s, e + 1);
  }
  return JSON.parse(t);
}

async function generatePost(topic, today) {
  const dateDisplay = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const dateIso = today.toISOString().split('T')[0];
  const responseText = await callClaude(buildPrompt(topic, dateDisplay));
  const post = extractJson(responseText);
  post.date = dateIso;
  post.dateDisplay = dateDisplay;
  post.readTime = '7 min read';
  post.topicId = topic.id;
  if (!/20\d\d/.test(post.slug)) post.slug = post.slug + '-2026';
  if (!post.slug.endsWith(dateIso) && !post.slug.includes(dateIso.slice(5))) {
    post.slug = post.slug + '-' + dateIso.slice(5).replace('-','');
  }
  return post;
}

async function ghGet(path) {
  const r = await fetch('https://api.github.com/repos/' + process.env.GITHUB_REPO + '/contents/' + path, {
    headers: { 'Authorization': 'token ' + process.env.GITHUB_TOKEN, 'User-Agent': 'callcanvas-blog' }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub GET ' + path + ' failed: ' + r.status);
  return await r.json();
}

async function ghPut(path, content, message, sha) {
  const body = { message, content };
  if (sha) body.sha = sha;
  const r = await fetch('https://api.github.com/repos/' + process.env.GITHUB_REPO + '/contents/' + path, {
    method: 'PUT',
    headers: {
      'Authorization': 'token ' + process.env.GITHUB_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'callcanvas-blog'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error('GitHub PUT ' + path + ' failed: ' + r.status + ' | ' + err.substring(0, 200));
  }
  return await r.json();
}

const b64 = (s) => Buffer.from(s, 'utf-8').toString('base64');

async function commitPost(post) {
  const path = 'public/blog/' + post.slug + '/index.html';
  const html = postPageHtml(post);
  const existing = await ghGet(path);
  await ghPut(path, b64(html), 'Daily blog: ' + post.title, existing ? existing.sha : null);
}

async function updateManifestAndIndex(post) {
  const manifestData = await ghGet('public/blog/manifest.json');
  let manifest = { posts: [] };
  let manifestSha = null;
  if (manifestData) {
    manifestSha = manifestData.sha;
    try { manifest = JSON.parse(Buffer.from(manifestData.content, 'base64').toString('utf-8')); } catch(e) { manifest = { posts: [] }; }
  }
  const cleaned = (manifest.posts || []).filter(p => p.slug !== post.slug);
  manifest.posts = [{
    slug: post.slug,
    title: post.title,
    metaDescription: post.metaDescription,
    date: post.date,
    dateDisplay: post.dateDisplay,
    readTime: post.readTime,
    topicId: post.topicId
  }, ...cleaned].slice(0, 100);
  
  await ghPut('public/blog/manifest.json', b64(JSON.stringify(manifest, null, 2)), 'Update blog manifest', manifestSha);
  
  const indexHtml = blogIndexHtml(manifest.posts);
  const indexData = await ghGet('public/blog/index.html');
  await ghPut('public/blog/index.html', b64(indexHtml), 'Refresh blog index', indexData ? indexData.sha : null);
}

exports.handler = async (event) => {
  try {
    const today = new Date();
    const day = getDayOfYear(today);
    const topic = TOPICS[day % TOPICS.length];
    
    const post = await generatePost(topic, today);
    await commitPost(post);
    await updateManifestAndIndex(post);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        slug: post.slug,
        title: post.title,
        topic: topic.id,
        url: 'https://callcanvasai.com/blog/' + post.slug + '/'
      })
    };
  } catch(e) {
    console.error('[daily-blog] Error:', e.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: e.message, stack: (e.stack||'').substring(0, 500) })
    };
  }
};
