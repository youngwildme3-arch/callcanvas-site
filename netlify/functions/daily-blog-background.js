// Daily blog generator for callcanvasai.com
// Picks a broad AI/tech/innovation topic from rotation, uses Claude with web search
// to research current data, writes ~1,500-word SEO post in listicle style.
// Commits all 3 files (post HTML, manifest, blog index) as ONE atomic commit
// via GitHub Trees API to avoid mid-deploy supersession on Netlify.
// Cron: 0 11 * * * (6 AM Central, runs as background function for 5min timeout)

const TOPICS = [
  { id: 'chatgpt-openai', label: 'Latest ChatGPT and OpenAI news, model updates, GPT-5 features, ecosystem changes', kw: 'ChatGPT' },
  { id: 'humanoid-robots', label: 'Humanoid robot race in 2026: Tesla Optimus, Figure, Boston Dynamics Atlas, Apptronik, Agility, Unitree, current capabilities and deployments', kw: 'humanoid robots 2026' },
  { id: 'self-driving-cars', label: 'Self-driving car progress in 2026: Waymo expansion, Tesla FSD, Apollo Go, Cruise, Zoox, real safety data', kw: 'self-driving cars 2026' },
  { id: 'spacex-mars', label: 'SpaceX Starship and Mars program progress, recent launches, Artemis, NASA partnerships, timeline', kw: 'SpaceX Starship Mars' },
  { id: 'ai-jobs', label: 'AI replacing jobs in 2026, which industries are most at risk, real displacement data, new jobs being created', kw: 'AI replacing jobs' },
  { id: 'ai-agents', label: 'AI agents in 2026: agentic AI, autonomous systems, real-world performance vs hype, current limitations', kw: 'AI agents' },
  { id: 'quantum-computing', label: 'Quantum computing breakthroughs, IBM, Google Willow, IonQ, real progress and use cases', kw: 'quantum computing' },
  { id: 'nvidia-chips', label: 'NVIDIA AI chips: Blackwell, Rubin, GB200, market dominance, AMD MI325X competition, AI data center buildout', kw: 'NVIDIA AI chips' },
  { id: 'ai-medicine', label: 'AI in medicine and healthcare 2026: drug discovery, diagnostics, AlphaFold, surgical robots, FDA-approved AI tools', kw: 'AI in medicine' },
  { id: 'ai-finance', label: 'AI in finance and trading: algorithmic trading, robo-advisors, fraud detection, real performance data', kw: 'AI in finance' },
  { id: 'apple-intelligence', label: 'Apple Intelligence updates, Siri overhaul, on-device AI, iPhone AI features, integration with ChatGPT', kw: 'Apple Intelligence' },
  { id: 'claude-ai', label: 'Anthropic Claude AI: latest model releases, Claude Opus, Claude Code, browser extension, enterprise adoption', kw: 'Claude AI' },
  { id: 'google-gemini', label: 'Google Gemini AI: latest model versions, Gemini integration in Search/Workspace/Android, market position', kw: 'Google Gemini AI' },
  { id: 'ai-image-generators', label: 'AI image generators 2026: Midjourney, DALL-E, Stable Diffusion, Flux, Adobe Firefly, comparisons and use cases', kw: 'AI image generators' },
  { id: 'ai-video-generators', label: 'AI video generators 2026: OpenAI Sora, Google Veo, Runway, Pika, Kling, real capabilities and limitations', kw: 'AI video generators' },
  { id: 'ai-music', label: 'AI music generators: Suno, Udio, ElevenLabs, royalty disputes, capabilities, what real musicians think', kw: 'AI music generators' },
  { id: 'ai-coding', label: 'AI coding tools 2026: Cursor, GitHub Copilot, Claude Code, Codeium, productivity data, what works in real teams', kw: 'AI coding tools' },
  { id: 'ai-bubble', label: 'AI bubble debate 2026: valuations, NVIDIA stock, OpenAI Anthropic IPOs, dotcom comparisons, capex spending', kw: 'AI bubble' },
  { id: 'ai-safety', label: 'AI safety and alignment in 2026: risks, regulation, EU AI Act, US executive orders, x-risk debate', kw: 'AI safety' },
  { id: 'china-us-ai', label: 'China vs US AI race 2026: DeepSeek, Alibaba Qwen, Baidu, chip export controls, who is winning', kw: 'China vs US AI' },
  { id: 'ai-education', label: 'AI in education 2026: ChatGPT in schools, AI tutors, Khan Academy Khanmigo, university policies, learning outcomes', kw: 'AI in education' },
  { id: 'ai-science', label: 'AI in science: AlphaFold, materials discovery, fusion, drug development, recent Nobel-tier breakthroughs', kw: 'AI in science' },
  { id: 'neuralink-bci', label: 'Neuralink and brain-computer interfaces 2026: human trials, Synchron, BCI startups, what is actually working', kw: 'Neuralink brain-computer interface' },
  { id: 'ai-energy', label: 'AI energy consumption 2026: data center power demand, nuclear deals, Microsoft Constellation, sustainability', kw: 'AI energy consumption' },
  { id: 'agi-timeline', label: 'AGI timeline predictions 2026: when will AGI arrive, what would qualify, current expert consensus, hype vs reality', kw: 'AGI timeline' },
  { id: 'ai-cybersecurity', label: 'AI in cybersecurity 2026: AI-driven attacks, deepfake fraud, defensive AI, real incident data', kw: 'AI cybersecurity' },
  { id: 'physical-ai', label: 'Physical AI and robotics: NVIDIA Isaac GR00T, Cosmos models, world models, simulation training breakthroughs', kw: 'physical AI' },
  { id: 'ai-customer-service', label: 'AI customer service 2026: chatbots replacing call centers, real CSAT data, what works and what fails', kw: 'AI customer service' },
  { id: 'warehouse-robots', label: 'Warehouse robots and logistics AI: Amazon, Symbotic, Locus, real productivity gains, deployment numbers', kw: 'warehouse robots' },
  { id: 'open-source-ai', label: 'Open-source AI models 2026: Llama, DeepSeek, Mistral, Qwen, what is competitive with closed models', kw: 'open-source AI' }
];

const REPO = process.env.GITHUB_REPO;
const GH_TOKEN = process.env.GITHUB_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SITE_URL = process.env.SITE_URL || 'https://callcanvasai.com';

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractJson(text) {
  let t = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.substring(a, b + 1)); } catch (e) {}
  }
  throw new Error('Could not parse JSON: ' + text.substring(0, 200));
}

function buildPrompt(topic, today) {
  return `You are writing today's blog post for callcanvasai.com â a daily AI/tech/innovation publication. Today is ` + today + `.

TOPIC: ` + topic.label + `
PRIMARY KEYWORD: ` + topic.kw + `

Step 1: Use the web_search tool 2-4 times to research the latest news, data, statistics, and developments on this topic as of ` + today + `. Find specific, citable facts (numbers, company moves, product launches, real quotes).

Step 2: Write a ~1,500-word SEO-optimized blog post in this EXACT structure:

1. **Title** â long-tail (8-12 words), question-style or list-style, includes primary keyword, includes "2026" or "in 2026"
2. **Lead paragraph** (hook) â open with a specific surprising fact or statistic. Set up the question the post answers. 60-100 words.
3. **"Quick verdict" or "Honest verdict" section** â a short paragraph or comparison TABLE that gives readers the answer in 30 seconds. Use HTML <table> with <thead> and <tbody>.
4. **3-5 main sections** â each with an H2 (use ## in markdown). Each section is 200-300 words. Use comparison tables, bullet lists, real data, named companies/products/people.
5. **One section should compare specific named products/companies** in a table.
6. **One "What's actually changing" or "What this means" section** â original insight, not just news rehash.
7. **FAQ section** â 5-6 question-style H3 (### in markdown). Each answered in 1-3 sentences.
8. **Closing line** â last-updated date.

STYLE RULES:
- Write like a knowledgeable human tracking the industry, not a marketing agency
- NO mentions of CallCanvas, sales tools, cold calling, or anything sales-related
- NO em-dashes (â). Use commas, semicolons, or periods.
- NO "in conclusion", "in today's fast-paced world", "leverage", "robust", "cutting-edge"
- Include real numbers, real names, real product versions
- Be willing to push back on hype with real data
- Long-tail title (8-12 words). Question-style or comparison-style.

OUTPUT FORMAT â return ONLY a JSON object, no markdown fences, no preamble:
{
  "slug": "url-safe-slug-with-keyword-and-2026",
  "title": "The full SEO title",
  "metaDescription": "150-character meta description with keyword",
  "primaryKeyword": "` + topic.kw + `",
  "leadHtml": "<p>The lead paragraph as HTML</p>",
  "verdictHtml": "<h2>Quick Verdict</h2><table>...</table>",
  "sectionsHtml": "<h2>Section 1</h2><p>...</p><h2>Section 2</h2><table>...</table>...",
  "faqs": [
    { "q": "Question 1?", "a": "Answer 1." }
  ]
}`;
}

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!res.ok) throw new Error('Claude API ' + res.status + ': ' + (await res.text()).substring(0,300));
  const data = await res.json();
  const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text);
  if (textBlocks.length === 0) throw new Error('No text in Claude response');
  return textBlocks[textBlocks.length - 1];
}

function postPageHtml(post, dateDisplay) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": (post.faqs || []).map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  };
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.metaDescription,
    "datePublished": post.date,
    "dateModified": post.date,
    "author": { "@type": "Organization", "name": "CallCanvas AI" },
    "publisher": { "@type": "Organization", "name": "CallCanvas AI", "url": SITE_URL }
  };
  const faqSection = (post.faqs && post.faqs.length)
    ? '<h2>Frequently asked questions</h2>' + post.faqs.map(f => '<h3>' + escapeHtml(f.q) + '</h3><p>' + escapeHtml(f.a) + '</p>').join('')
    : '';
  
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>' + escapeHtml(post.title) + ' - CallCanvas AI</title>',
    '<meta name="description" content="' + escapeHtml(post.metaDescription) + '">',
    '<meta name="keywords" content="' + escapeHtml(post.primaryKeyword) + ', AI 2026, artificial intelligence">',
    '<link rel="canonical" href="' + SITE_URL + '/blog/' + post.slug + '/">',
    '<meta property="og:title" content="' + escapeHtml(post.title) + '">',
    '<meta property="og:description" content="' + escapeHtml(post.metaDescription) + '">',
    '<meta property="og:type" content="article">',
    '<meta property="og:url" content="' + SITE_URL + '/blog/' + post.slug + '/">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<script type="application/ld+json">' + JSON.stringify(articleJsonLd) + '</script>',
    '<script type="application/ld+json">' + JSON.stringify(faqJsonLd) + '</script>',
    '<style>',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:"Segoe UI",system-ui,-apple-system,sans-serif;background:#080b10;color:#f0f6fc;line-height:1.7;-webkit-font-smoothing:antialiased}',
    'nav{background:rgba(8,11,16,.96);border-bottom:1px solid rgba(255,255,255,.07);height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,5vw,64px);position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)}',
    '.logo{font-size:19px;font-weight:900;color:#0ea5e9;text-decoration:none;letter-spacing:.02em}',
    '.nav-cta{padding:9px 18px;background:#0ea5e9;color:#000;border-radius:8px;font-size:13px;font-weight:800;text-decoration:none}',
    '.wrap{max-width:760px;margin:0 auto;padding:64px 24px 96px}',
    '.crumb{font-size:13px;color:rgba(240,246,252,.45);margin-bottom:24px}',
    '.crumb a{color:#0ea5e9;text-decoration:none}',
    'h1{font-size:clamp(30px,5vw,44px);font-weight:900;line-height:1.18;margin-bottom:16px;letter-spacing:-.01em}',
    '.meta{display:flex;gap:16px;font-size:13px;color:rgba(240,246,252,.45);margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,.07);flex-wrap:wrap}',
    'h2{font-size:25px;font-weight:800;margin:40px 0 16px;letter-spacing:-.005em}',
    'h3{font-size:18px;font-weight:700;margin:28px 0 10px;color:#0ea5e9}',
    'p{font-size:16px;color:rgba(240,246,252,.78);margin-bottom:18px}',
    'strong{color:#f0f6fc;font-weight:700}',
    'em{color:rgba(240,246,252,.85)}',
    'ul,ol{margin:12px 0 22px 24px}',
    'li{font-size:16px;color:rgba(240,246,252,.78);margin-bottom:8px}',
    'a{color:#0ea5e9;text-decoration:none;border-bottom:1px solid rgba(14,165,233,.3)}',
    'a:hover{border-bottom-color:#0ea5e9}',
    'table{width:100%;border-collapse:collapse;margin:24px 0;background:#131b27;border:1px solid rgba(255,255,255,.07);border-radius:10px;overflow:hidden;font-size:14px}',
    'th,td{padding:12px 16px;text-align:left;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}',
    'th{background:rgba(14,165,233,.06);font-weight:700;color:#0ea5e9;font-size:12px;text-transform:uppercase;letter-spacing:.08em}',
    'td{color:rgba(240,246,252,.78)}',
    'tr:last-child td{border-bottom:none}',
    'blockquote{border-left:3px solid #0ea5e9;background:rgba(14,165,233,.04);padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;font-style:italic;color:rgba(240,246,252,.85)}',
    'footer{border-top:1px solid rgba(255,255,255,.07);margin-top:56px;padding:28px 0;text-align:center;font-size:13px;color:rgba(240,246,252,.4)}',
    'footer a{color:rgba(240,246,252,.6)}',
    '</style>',
    '</head>',
    '<body>',
    '<nav>',
    '<a class="logo" href="/">CALLCANVAS AI</a>',
    '<a class="nav-cta" href="/research.html">Try Free for 7 Days</a>',
    '</nav>',
    '<div class="wrap">',
    '<div class="crumb"><a href="/">Home</a> &nbsp;/&nbsp; <a href="/blog/">Blog</a> &nbsp;/&nbsp; ' + escapeHtml(post.title.substring(0, 50)) + '...</div>',
    '<h1>' + escapeHtml(post.title) + '</h1>',
    '<div class="meta">',
    '<span>' + escapeHtml(dateDisplay) + '</span>',
    '<span>' + escapeHtml(post.readTime || '7 min read') + '</span>',
    '<span>By the CallCanvas Team</span>',
    '</div>',
    post.leadHtml || '',
    post.verdictHtml || '',
    post.sectionsHtml || '',
    faqSection,
    '<footer>',
    '<p>Published ' + escapeHtml(dateDisplay) + ' &nbsp;|&nbsp; <a href="/blog/">More posts</a> &nbsp;|&nbsp; <a href="/">CallCanvas AI</a></p>',
    '<p style="margin-top:8px;font-size:11px;color:rgba(240,246,252,.3)">Last updated ' + escapeHtml(dateDisplay) + '. Article data updates with the news cycle.</p>',
    '</footer>',
    '</div>',
    '</body>',
    '</html>'
  ].join('\n');
}

function blogIndexHtml(manifest) {
  const posts = (manifest.posts || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const cards = posts.map(p => {
    return '<a class="post-card" href="/blog/' + p.slug + '/">' +
      '<div class="post-meta">' + escapeHtml(p.dateDisplay || p.date) + ' &nbsp;&middot;&nbsp; ' + escapeHtml(p.readTime || '7 min read') + '</div>' +
      '<div class="post-title">' + escapeHtml(p.title) + '</div>' +
      '<div class="post-desc">' + escapeHtml(p.metaDescription || '') + '</div>' +
      '<div class="post-tag">Read full post &rarr;</div>' +
    '</a>';
  }).join('\n');
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>Blog - CallCanvas AI</title>',
    '<meta name="description" content="Daily articles on AI, robotics, space tech, and modern innovation. Written for anyone tracking what is actually happening in technology in 2026.">',
    '<link rel="canonical" href="' + SITE_URL + '/blog/">',
    '<style>',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:"Segoe UI",system-ui,-apple-system,sans-serif;background:#080b10;color:#f0f6fc;line-height:1.65;-webkit-font-smoothing:antialiased}',
    'nav{background:rgba(8,11,16,.96);border-bottom:1px solid rgba(255,255,255,.07);height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,5vw,64px);position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)}',
    '.logo{font-size:19px;font-weight:900;color:#0ea5e9;text-decoration:none;letter-spacing:.02em}',
    '.nav-cta{padding:9px 18px;background:#0ea5e9;color:#000;border-radius:8px;font-size:13px;font-weight:800;text-decoration:none}',
    '.wrap{max-width:880px;margin:0 auto;padding:64px 24px 96px}',
    '.crumb{font-size:13px;color:rgba(240,246,252,.45);margin-bottom:24px}',
    '.crumb a{color:#0ea5e9;text-decoration:none}',
    'h1{font-size:clamp(34px,5vw,52px);font-weight:900;line-height:1.1;margin-bottom:16px;letter-spacing:-.01em}',
    'h1 em{color:#0ea5e9;font-style:normal}',
    '.lede{font-size:18px;color:rgba(240,246,252,.65);margin-bottom:48px;max-width:640px}',
    '.posts{display:flex;flex-direction:column;gap:20px}',
    '.post-card{background:#131b27;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:28px;transition:border-color .2s,transform .2s;display:block;text-decoration:none}',
    '.post-card:hover{border-color:rgba(14,165,233,.4);transform:translateY(-2px)}',
    '.post-meta{font-size:12px;font-weight:600;color:#0ea5e9;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px}',
    '.post-title{font-size:23px;font-weight:800;color:#f0f6fc;margin-bottom:10px;line-height:1.25}',
    '.post-desc{font-size:15px;color:rgba(240,246,252,.6);line-height:1.55}',
    '.post-tag{display:inline-block;margin-top:14px;font-size:12px;color:#0ea5e9;font-weight:600}',
    'footer{border-top:1px solid rgba(255,255,255,.07);margin-top:64px;padding:32px 0;text-align:center;font-size:13px;color:rgba(240,246,252,.4)}',
    'footer a{color:rgba(240,246,252,.6);text-decoration:none}',
    '</style>',
    '</head>',
    '<body>',
    '<nav>',
    '<a class="logo" href="/">CALLCANVAS AI</a>',
    '<a class="nav-cta" href="/research.html">Try Free for 7 Days</a>',
    '</nav>',
    '<div class="wrap">',
    '<div class="crumb"><a href="/">Home</a> &nbsp;/&nbsp; Blog</div>',
    '<h1>The latest in <em>AI &amp; modern tech.</em></h1>',
    '<p class="lede">Daily articles on artificial intelligence, robotics, space tech, and the innovations driving the modern world. New post every morning at 6 AM Central.</p>',
    '<div class="posts">' + cards + '</div>',
    '<footer><p>New posts daily at 6 AM Central. <a href="/">Back to CallCanvas AI</a></p></footer>',
    '</div>',
    '</body>',
    '</html>'
  ].join('\n');
}

// === ATOMIC GITHUB COMMIT (Trees API) ===
// Pushes multiple files in ONE commit, ensuring single Netlify deploy with all changes.
async function ghHeaders() {
  return { 'Authorization': 'token ' + GH_TOKEN, 'Content-Type': 'application/json' };
}

async function ghGetContents(path) {
  const r = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, {
    headers: { 'Authorization': 'token ' + GH_TOKEN }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub GET ' + path + ' failed: ' + r.status);
  return await r.json();
}

async function atomicCommit(filesByPath, message) {
  const headers = await ghHeaders();
  // 1. Get current main ref
  const refRes = await fetch('https://api.github.com/repos/' + REPO + '/git/ref/heads/main', { headers });
  if (!refRes.ok) throw new Error('Failed to get ref: ' + refRes.status);
  const refData = await refRes.json();
  const parentSha = refData.object.sha;
  // 2. Get parent commit's tree
  const commitRes = await fetch('https://api.github.com/repos/' + REPO + '/git/commits/' + parentSha, { headers });
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;
  // 3. Create blobs for each file
  const treeItems = [];
  for (const [path, content] of Object.entries(filesByPath)) {
    const blobRes = await fetch('https://api.github.com/repos/' + REPO + '/git/blobs', {
      method: 'POST', headers,
      body: JSON.stringify({ content: Buffer.from(content, 'utf8').toString('base64'), encoding: 'base64' })
    });
    if (!blobRes.ok) throw new Error('Failed to create blob for ' + path + ': ' + blobRes.status);
    const blob = await blobRes.json();
    treeItems.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  // 4. Create new tree
  const treeRes = await fetch('https://api.github.com/repos/' + REPO + '/git/trees', {
    method: 'POST', headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
  });
  if (!treeRes.ok) throw new Error('Failed to create tree: ' + treeRes.status);
  const newTree = await treeRes.json();
  // 5. Create commit
  const newCommitRes = await fetch('https://api.github.com/repos/' + REPO + '/git/commits', {
    method: 'POST', headers,
    body: JSON.stringify({ message, tree: newTree.sha, parents: [parentSha] })
  });
  if (!newCommitRes.ok) throw new Error('Failed to create commit: ' + newCommitRes.status);
  const newCommit = await newCommitRes.json();
  // 6. Update main ref
  const updateRes = await fetch('https://api.github.com/repos/' + REPO + '/git/refs/heads/main', {
    method: 'PATCH', headers,
    body: JSON.stringify({ sha: newCommit.sha })
  });
  if (!updateRes.ok) throw new Error('Failed to update ref: ' + updateRes.status);
  return newCommit.sha;
}

exports.handler = async (event) => {
  // Same-day dedup: skip if a post was already published today
  try {
    const todayDate = new Date().toISOString().slice(0, 10);
    const manifestPath = 'public/blog/manifest.json';
    let existingManifest = null;
    try {
      const ghHeadersObj = await ghHeaders();
      const r = await fetch('https://api.github.com/repos/' + (process.env.GITHUB_REPO || 'youngwildme3-arch/callcanvas-site') + '/contents/' + manifestPath, { headers: ghHeadersObj });
      if (r.ok) {
        const j = await r.json();
        existingManifest = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
      }
    } catch (e) { console.log('manifest fetch failed (ok):', e.message); }
    if (existingManifest && Array.isArray(existingManifest.posts)) {
      const todayPostExists = existingManifest.posts.some(p => (p.date || p.published_at || '').startsWith(todayDate));
      if (todayPostExists) {
        console.log('Daily blog: post already published today, skipping');
        return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true, reason: 'already published today' }) };
      }
    }
  } catch (e) { console.log('Same-day check failed (proceeding):', e.message); }

  try {
    if (!REPO || !GH_TOKEN || !ANTHROPIC_KEY) {
      throw new Error('Missing env vars: GITHUB_REPO=' + !!REPO + ' GITHUB_TOKEN=' + !!GH_TOKEN + ' ANTHROPIC_API_KEY=' + !!ANTHROPIC_KEY);
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const dateDisplay = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
    const topic = TOPICS[dayOfYear(today) % TOPICS.length];

    console.log('Today topic:', topic.id, 'date:', todayStr);

    // 1. Generate post via Claude
    const raw = await callClaude(buildPrompt(topic, todayStr));
    const post = extractJson(raw);
    post.date = todayStr;
    post.dateDisplay = dateDisplay;
    post.readTime = post.readTime || '7 min read';
    if (!post.slug) throw new Error('Missing slug in post output');
    post.slug = post.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    // 2. Idempotency check
    const existing = await ghGetContents('public/blog/' + post.slug + '/index.html');
    if (existing) {
      console.log('Post already exists today:', post.slug);
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'already_exists', slug: post.slug }) };
    }

    // 3. Render HTML
    const html = postPageHtml(post, dateDisplay);

    // 4. Get current manifest, add new entry
    const manifestRes = await ghGetContents('public/blog/manifest.json');
    let manifest = { posts: [] };
    if (manifestRes && manifestRes.content) {
      manifest = JSON.parse(Buffer.from(manifestRes.content, 'base64').toString('utf8'));
    }
    manifest.posts = manifest.posts || [];
    manifest.posts.unshift({
      slug: post.slug,
      title: post.title,
      metaDescription: post.metaDescription,
      date: post.date,
      dateDisplay: post.dateDisplay,
      readTime: post.readTime,
      topicId: topic.id
    });
    manifest.posts = manifest.posts.slice(0, 60);

    // 5. Render new index
    const indexHtml = blogIndexHtml(manifest);

    // 6. ATOMIC commit all 3 files in ONE operation -> ONE Netlify deploy
    const commitSha = await atomicCommit({
      ['public/blog/' + post.slug + '/index.html']: html,
      'public/blog/manifest.json': JSON.stringify(manifest, null, 2),
      'public/blog/index.html': indexHtml
    }, 'Daily blog: ' + post.title.substring(0, 60));

    console.log('Atomic commit', commitSha, 'for slug', post.slug);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, slug: post.slug, title: post.title, topic: topic.id, commit: commitSha, url: SITE_URL + '/blog/' + post.slug + '/' })
    };
  } catch (e) {
    console.error('daily-blog error:', e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
