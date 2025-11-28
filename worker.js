export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const fingerprint = await generateFingerprint(clientIP, userAgent);
    const country = request.cf?.country || 'Unknown';
    const city = request.cf?.city || '';
    const location = city ? `${city}, ${country}` : country;

    // Only track on page requests, not API calls
    if (!path.startsWith('/api/')) {
      await trackVisitor(env, clientIP, fingerprint, userAgent, location);
    }

    if (path === '/') return new Response(getIndexHTML(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    if (path === '/slime') return new Response(getSlimeHTML(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    if (path === '/bounce') return new Response(getBounceHTML(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    if (path === '/fountain') return new Response(getFountainHTML(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    if (path === '/kaleidoscope') return new Response(getKaleidoscopeHTML(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    if (path === '/breathing') return new Response(getBreathingHTML(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    if (path === '/cube3') return new Response(getCube3HTML(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    if (path === '/cube4') return new Response(getCube4HTML(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    if (path === '/cube5') return new Response(getCube5HTML(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    if (path === '/api/stats') {
      const stats = await getStats(env, request);
      return new Response(JSON.stringify(stats), { headers: { 'Content-Type': 'application/json' } });
    }
    if (path === '/api/current') {
      return new Response(JSON.stringify({
        ip: clientIP,
        fingerprint,
        location,
        cf: request.cf ? {
          country: request.cf.country,
          city: request.cf.city,
          region: request.cf.region,
          timezone: request.cf.timezone
        } : null
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (path === '/stats') return new Response(getStatsPageHTML(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });

    return new Response('Not Found', { status: 404 });
  }
};

async function generateFingerprint(ip, ua) {
  const data = `${ip}-${ua}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

async function trackVisitor(env, ip, fingerprint, ua, location) {
  if (!env.VISITORS) return;

  const key = `visitor:${fingerprint}`;
  const existing = await env.VISITORS.get(key);

  if (!existing) {
    await env.VISITORS.put(key, JSON.stringify({
      ip,
      ua,
      location: location || 'Unknown',
      first: Date.now(),
      count: 1
    }));
    const totalVisitors = parseInt((await env.VISITORS.get('total_visitors')) || '0');
    await env.VISITORS.put('total_visitors', String(totalVisitors + 1));

    const totalVisits = parseInt((await env.VISITORS.get('total_visits')) || '0');
    await env.VISITORS.put('total_visits', String(totalVisits + 1));
  } else {
    const data = JSON.parse(existing);
    data.count++;
    data.last = Date.now();
    // Always update location (handles old data migration)
    if (!data.location || data.location === 'Unknown') {
      data.location = location || 'Unknown';
    }
    await env.VISITORS.put(key, JSON.stringify(data));

    const totalVisits = parseInt((await env.VISITORS.get('total_visits')) || '0');
    await env.VISITORS.put('total_visits', String(totalVisits + 1));
  }
}

async function getStats(env, request) {
  if (!env.VISITORS) return { visitors: 0, visits: 0, ips: [] };

  const visitors = parseInt((await env.VISITORS.get('total_visitors')) || '0');
  const visits = parseInt((await env.VISITORS.get('total_visits')) || '0');

  const list = await env.VISITORS.list();
  const ips = [];
  const seen = new Set();

  for (const key of list.keys) {
    if (key.name.startsWith('visitor:')) {
      const data = JSON.parse(await env.VISITORS.get(key.name));
      if (!seen.has(data.ip)) {
        seen.add(data.ip);
        ips.push({
          ip: data.ip,
          count: data.count,
          location: data.location || 'Unknown'
        });
      }
    }
  }

  return { visitors, visits, ips };
}

function getStatsFloatScript() {
  return `
    fetch('/api/current').then(r => r.json()).then(data => {
      const statsEl = document.getElementById('stats');
      if (statsEl) {
        statsEl.innerHTML = '<div><strong>YOUR INFO</strong></div>' +
          '<div>IP: ' + data.ip + '</div>' +
          '<div>Fingerprint: ' + data.fingerprint + '</div>' +
          '<a href="/stats" style="display:block;margin-top:10px;padding-top:10px;border-top:1px solid #ddd;text-align:center;color:#0066cc;text-decoration:none;font-size:10px;">查看完整统计 →</a>';
        setTimeout(() => {
          statsEl.classList.add('hidden');
        }, 10000);
      }
    }).catch(err => {
      console.error('Failed to load stats:', err);
      const statsEl = document.getElementById('stats');
      if (statsEl) statsEl.innerHTML = '<div>加载失败</div>';
    });
  `;
}

function getParticleBackgroundScript() {
  return `
    const particleCanvas = document.createElement('canvas');
    particleCanvas.style.position = 'fixed';
    particleCanvas.style.top = '0';
    particleCanvas.style.left = '0';
    particleCanvas.style.width = '100%';
    particleCanvas.style.height = '100%';
    particleCanvas.style.pointerEvents = 'none';
    particleCanvas.style.zIndex = '1';
    document.body.insertBefore(particleCanvas, document.body.firstChild);

    const pCtx = particleCanvas.getContext('2d');
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;

    const bgParticles = [];
    let bgMouseX = -1000, bgMouseY = -1000;

    class BgParticle {
      constructor() {
        this.x = Math.random() * particleCanvas.width;
        this.y = Math.random() * particleCanvas.height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.radius = 1.5;
      }
      update() {
        const dx = bgMouseX - this.x;
        const dy = bgMouseY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150;
          this.vx += (dx / dist) * force * 0.3;
          this.vy += (dy / dist) * force * 0.3;
        }
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > particleCanvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > particleCanvas.height) this.vy *= -1;
        this.x = Math.max(0, Math.min(particleCanvas.width, this.x));
        this.y = Math.max(0, Math.min(particleCanvas.height, this.y));
      }
      draw() {
        pCtx.beginPath();
        pCtx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        pCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        pCtx.fill();
      }
    }

    for (let i = 0; i < 60; i++) {
      bgParticles.push(new BgParticle());
    }

    document.addEventListener('mousemove', (e) => {
      bgMouseX = e.clientX;
      bgMouseY = e.clientY;
    });

    function animateBgParticles() {
      pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

      // Draw connections
      for (let i = 0; i < bgParticles.length; i++) {
        for (let j = i + 1; j < bgParticles.length; j++) {
          const dx = bgParticles[i].x - bgParticles[j].x;
          const dy = bgParticles[i].y - bgParticles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            pCtx.beginPath();
            pCtx.moveTo(bgParticles[i].x, bgParticles[i].y);
            pCtx.lineTo(bgParticles[j].x, bgParticles[j].y);
            const alpha = (1 - dist / 150) * 0.15;
            pCtx.strokeStyle = \`rgba(0, 0, 0, \${alpha})\`;
            pCtx.lineWidth = 0.5;
            pCtx.stroke();
          }
        }
      }

      bgParticles.forEach(p => {
        p.update();
        p.draw();
      });
      requestAnimationFrame(animateBgParticles);
    }
    animateBgParticles();

    window.addEventListener('resize', () => {
      particleCanvas.width = window.innerWidth;
      particleCanvas.height = window.innerHeight;
    });
  `;
}

function getIndexHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Stress Relief Games</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', 'SimSun', serif;
      background: #ffffff;
      min-height: 100vh;
      padding: 60px 40px 40px;
      position: relative;
      line-height: 1.8;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      position: relative;
      z-index: 10;
    }
    header {
      border-bottom: 2px solid #000;
      padding-bottom: 30px;
      margin-bottom: 50px;
    }
    h1 {
      font-size: 2.5em;
      font-weight: 400;
      color: #000;
      margin-bottom: 15px;
      letter-spacing: -0.5px;
    }
    .meta {
      font-size: 0.95em;
      color: #666;
      font-style: italic;
      margin-bottom: 20px;
    }
    .abstract {
      background: #f9f9f9;
      border-left: 3px solid #000;
      padding: 20px 25px;
      margin: 40px 0;
      font-size: 0.95em;
      color: #333;
    }
    .abstract strong {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 1px;
    }
    .section-title {
      font-size: 1.3em;
      font-weight: 600;
      color: #000;
      margin: 40px 0 20px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .card {
      background: #fff;
      border: 1px solid #ddd;
      padding: 25px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }
    .card:hover {
      border-color: #000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transform: translateY(-2px);
    }
    .card-number {
      position: absolute;
      top: 10px;
      right: 15px;
      font-size: 0.75em;
      color: #999;
      font-weight: 600;
    }
    .card h3 {
      font-size: 1.1em;
      font-weight: 600;
      color: #000;
      margin-bottom: 10px;
    }
    .card p {
      font-size: 0.9em;
      color: #666;
      line-height: 1.6;
    }
    .stats {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      padding: 15px;
      font-size: 11px;
      max-width: 250px;
      z-index: 100;
      font-family: 'Courier New', monospace;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    .stats.hidden { opacity: 0; pointer-events: none; }
    .stats div { margin: 4px 0; color: #333; }
    .stats strong { font-weight: 600; }
    .stats-link {
      display: block;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #0066cc;
      text-decoration: none;
      font-size: 10px;
    }
    .stats-link:hover { text-decoration: underline; }
    footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 0.85em;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>交互式解压游戏：极简主义方法</h1>
      <div class="meta">
        hxorz Lab · 2025 · 交互系统研究
      </div>
    </header>

    <div class="abstract">
      <strong>摘要</strong><br>
      本项目展示了六款通过极简交互设计实现压力缓解的应用程序集合。每个应用采用不同的视觉和交互范式，涵盖物理模拟到生成式视觉图案。所有实现都优先考虑简洁性、响应性和治疗价值。
    </div>

    <div class="section-title">1. 实验性应用</div>
    <div class="grid">
      <div class="card" onclick="location.href='/slime'">
        <div class="card-number">1.1</div>
        <h3>粘性形变模拟</h3>
        <p>实时软体物理引擎，具备弹性恢复和呼吸形态特性。</p>
      </div>
      <div class="card" onclick="location.href='/bounce'">
        <div class="card-number">1.2</div>
        <h3>碰撞动力学系统</h3>
        <p>多粒子碰撞检测，集成重力模拟和声学反馈机制。</p>
      </div>
      <div class="card" onclick="location.href='/fountain'">
        <div class="card-number">1.3</div>
        <h3>粒子发射引擎</h3>
        <p>可配置粒子系统，支持多种发射模式和物理模型。</p>
      </div>
      <div class="card" onclick="location.href='/kaleidoscope'">
        <div class="card-number">1.4</div>
        <h3>对称图案生成器</h3>
        <p>动态万花筒效果，可调节镜像分段和色彩方案。</p>
      </div>
      <div class="card" onclick="location.href='/breathing'">
        <div class="card-number">1.5</div>
        <h3>色度振荡网格</h3>
        <p>异步色彩转换，基于参数化波函数驱动。</p>
      </div>
      <div class="card" onclick="location.href='/cube3'">
        <div class="card-number">1.6</div>
        <h3>三维组合谜题</h3>
        <p>交互式魔方模拟，支持可配置维度（3×3、4×4、5×5）。</p>
      </div>
    </div>

    <footer>
      © 2025 · Stress Relief Research Initiative
    </footer>

    <div style="margin-top: 60px; padding-top: 40px; border-top: 1px solid #ddd;">
      <h2 style="font-size: 1.5em; font-weight: 400; margin-bottom: 20px;">评论区</h2>
      <div class="giscus"></div>
    </div>
  </div>
  <div class="stats" id="stats">Loading...</div>
  <script>${getParticleBackgroundScript()}</script>
  <script>
    fetch('/api/current').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div><strong>YOUR INFO</strong></div>
        <div>IP: \${data.ip}</div>
        <div>Fingerprint: \${data.fingerprint}</div>
        <a href="/stats" class="stats-link">查看完整统计 →</a>
      \`;

      // Hide after 10 seconds
      setTimeout(() => {
        document.getElementById('stats').classList.add('hidden');
      }, 10000);
    });
  </script>
  <script src="https://giscus.app/client.js"
        data-repo="inwpu/cgame"
        data-repo-id="R_kgDOQciOGQ"
        data-category="General"
        data-category-id="DIC_kwDOQciOGc4Cy_W7"
        data-mapping="pathname"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="light"
        data-lang="zh-CN"
        crossorigin="anonymous"
        async>
  </script>
</body>
</html>`;
}

function getSlimeHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>无限扭曲史莱姆</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #0a0a0f; position: relative; }
    canvas { display: block; position: absolute; top: 0; left: 0; }
    #slimeCanvas { z-index: 5; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; padding: 10px 20px; background: rgba(255,255,255,0.1);
            border-radius: 10px; backdrop-filter: blur(10px); }
    .back:hover { background: rgba(255,255,255,0.2); }
    .stats {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      padding: 15px;
      font-size: 11px;
      max-width: 250px;
      z-index: 100;
      font-family: 'Courier New', monospace;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    .stats.hidden { opacity: 0; pointer-events: none; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <canvas id="slimeCanvas"></canvas>
  <div class="stats" id="stats">Loading...</div>
  <script>${getParticleBackgroundScript()}</script>
  <script>
    const canvas = document.getElementById('slimeCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    class SlimePoint {
      constructor(x, y, index, total) {
        this.x = this.originX = x;
        this.y = this.originY = y;
        this.vx = 0;
        this.vy = 0;
        this.index = index;
        this.total = total;
      }
      update(mouseX, mouseY, mouseDown) {
        if (mouseDown) {
          const dx = mouseX - this.x;
          const dy = mouseY - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 300) {
            const force = (300 - dist) / 300;
            this.x += dx * force * 0.15;
            this.y += dy * force * 0.15;
          }
        }

        const dx = this.originX - this.x;
        const dy = this.originY - this.y;
        this.vx += dx * 0.005;
        this.vy += dy * 0.005;
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.x += this.vx;
        this.y += this.vy;
      }
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const points = [];
    let radius = 180;
    let breathScale = 1;

    for (let i = 0; i < 360; i += 5) {
      const angle = (i * Math.PI) / 180;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      points.push(new SlimePoint(x, y, i, 360));
    }

    let mouseX = 0, mouseY = 0, mouseDown = false;

    canvas.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    canvas.addEventListener('mousedown', () => mouseDown = true);
    canvas.addEventListener('mouseup', () => mouseDown = false);
    canvas.addEventListener('mouseleave', () => mouseDown = false);
    canvas.addEventListener('touchmove', (e) => {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      mouseDown = true;
      e.preventDefault();
    });
    canvas.addEventListener('touchstart', (e) => {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      mouseDown = true;
      e.preventDefault();
    });
    canvas.addEventListener('touchend', () => mouseDown = false);

    function animate() {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      breathScale = 1 + Math.sin(Date.now() / 1000) * 0.2;

      points.forEach((p) => {
        p.update(mouseX, mouseY, mouseDown);
        const angle = Math.atan2(p.originY - centerY, p.originX - centerX);
        const targetDist = radius * breathScale;
        p.originX = centerX + Math.cos(angle) * targetDist;
        p.originY = centerY + Math.sin(angle) * targetDist;
      });

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const xc = (points[i].x + points[i - 1].x) / 2;
        const yc = (points[i].y + points[i - 1].y) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
      }
      ctx.closePath();

      const time = Date.now() / 8;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * breathScale);
      gradient.addColorStop(0, \`hsla(\${time % 360}, 100%, 65%, 0.9)\`);
      gradient.addColorStop(0.5, \`hsla(\${(time + 60) % 360}, 100%, 55%, 0.8)\`);
      gradient.addColorStop(1, \`hsla(\${(time + 180) % 360}, 100%, 50%, 0.7)\`);
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 40;
      ctx.shadowColor = \`hsl(\${time % 360}, 100%, 50%)\`;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = \`hsla(\${(time + 180) % 360}, 100%, 70%, 0.6)\`;
      ctx.lineWidth = 3;
      ctx.stroke();

      requestAnimationFrame(animate);
    }
    animate();

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });

  </script>
  <script>${getStatsFloatScript()}</script>
</body>
</html>`;
}

function getBounceHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>小球碰碰碰</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #0a0a0f; position: relative; }
    canvas { display: block; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; padding: 10px 20px; background: rgba(255,255,255,0.1);
            border-radius: 10px; backdrop-filter: blur(10px); }
    .back:hover { background: rgba(255,255,255,0.2); }
    .stats {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      padding: 15px;
      font-size: 11px;
      max-width: 250px;
      z-index: 100;
      font-family: 'Courier New', monospace;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    .stats.hidden { opacity: 0; pointer-events: none; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <canvas id="canvas"></canvas>
  <div class="stats" id="stats">Loading...</div>
  <script>${getParticleBackgroundScript()}</script>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const balls = [];
    const explosions = [];
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffd93d', '#6bcf7f', '#a29bfe'];

    class Ball {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10 + Math.random() * 20;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.gravity = 0.3;
        this.damping = 0.85;
      }
      update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
          this.vx *= -this.damping;
          this.x = this.x + this.radius > canvas.width ? canvas.width - this.radius : this.radius;
          createExplosion(this.x, this.y, this.color);
          playSound();
        }
        if (this.y + this.radius > canvas.height || this.y - this.radius < 0) {
          this.vy *= -this.damping;
          this.y = this.y + this.radius > canvas.height ? canvas.height - this.radius : this.radius;
          createExplosion(this.x, this.y, this.color);
          playSound();
        }
      }
      draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    class Explosion {
      constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.particles = [];
        for (let i = 0; i < 20; i++) {
          const angle = (Math.PI * 2 * i) / 20;
          const speed = 3 + Math.random() * 5;
          this.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            radius: 2 + Math.random() * 3
          });
        }
      }
      update() {
        this.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.life -= 0.015;
        });
        this.particles = this.particles.filter(p => p.life > 0);
      }
      draw() {
        this.particles.forEach(p => {
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.shadowBlur = 15;
          ctx.shadowColor = this.color;
          ctx.fill();
          ctx.restore();
        });
      }
      isDead() {
        return this.particles.length === 0;
      }
    }

    function createExplosion(x, y, color) {
      explosions.push(new Explosion(x, y, color));
    }

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function playSound() {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = 200 + Math.random() * 400;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.1);
    }

    canvas.addEventListener('click', (e) => {
      balls.push(new Ball(e.clientX, e.clientY));
    });
    canvas.addEventListener('touchstart', (e) => {
      balls.push(new Ball(e.touches[0].clientX, e.touches[0].clientY));
    });

    function animate() {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      balls.forEach(ball => {
        ball.update();
        ball.draw();
      });

      explosions.forEach((exp, i) => {
        exp.update();
        exp.draw();
        if (exp.isDead()) explosions.splice(i, 1);
      });

      requestAnimationFrame(animate);
    }
    animate();
  </script>
  <script>${getStatsFloatScript()}</script>
</body>
</html>`;
}

function getFountainHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>粒子喷泉</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #0a0a0f; position: relative; }
    canvas { display: block; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; padding: 10px 20px; background: rgba(255,255,255,0.1);
            border-radius: 10px; backdrop-filter: blur(10px); }
    .back:hover { background: rgba(255,255,255,0.2); }
    .controls { position: absolute; top: 20px; right: 20px; z-index: 100; }
    .controls button { margin: 5px; padding: 10px 20px; border: none; border-radius: 8px;
                       background: rgba(255,255,255,0.15); color: white; cursor: pointer;
                       font-size: 14px; backdrop-filter: blur(10px); transition: all 0.3s; }
    .controls button:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .stats {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      padding: 15px;
      font-size: 11px;
      max-width: 250px;
      z-index: 100;
      font-family: 'Courier New', monospace;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    .stats.hidden { opacity: 0; pointer-events: none; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <div class="controls">
    <button onclick="mode='firework'">烟花</button>
    <button onclick="mode='fountain'">喷泉</button>
    <button onclick="mode='spiral'">螺旋</button>
    <button onclick="mode='rainbow'">彩虹</button>
    <button onclick="mode='explosion'">爆炸</button>
  </div>
  <canvas id="canvas"></canvas>
  <div class="stats" id="stats">Loading...</div>
  <script>${getParticleBackgroundScript()}</script>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    let mode = 'firework';

    class Particle {
      constructor(x, y, mode) {
        this.x = x;
        this.y = y;
        let angle, speed;

        switch(mode) {
          case 'firework':
            angle = Math.random() * Math.PI * 2;
            speed = 3 + Math.random() * 8;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed - 8;
            this.gravity = 0.15;
            break;
          case 'fountain':
            angle = -Math.PI/2 + (Math.random() - 0.5) * 0.5;
            speed = 5 + Math.random() * 10;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.gravity = 0.3;
            break;
          case 'spiral':
            const t = Date.now() / 100;
            angle = t + Math.random() * 0.5;
            speed = 5 + Math.random() * 5;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.gravity = 0.1;
            break;
          case 'rainbow':
            angle = Math.random() * Math.PI * 2;
            speed = 2 + Math.random() * 6;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed - 5;
            this.gravity = 0.2;
            break;
          case 'explosion':
            angle = Math.random() * Math.PI * 2;
            speed = 8 + Math.random() * 15;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.gravity = 0.05;
            break;
        }

        this.radius = 2 + Math.random() * 4;
        this.life = 1;
        this.decay = 0.003 + Math.random() * 0.01;
        this.hue = mode === 'rainbow' ? Date.now() / 10 % 360 : Math.random() * 360;
        this.mode = mode;
      }
      update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.vx *= 0.99;
        if (this.mode === 'rainbow') {
          this.hue = (this.hue + 2) % 360;
        }
      }
      draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.shadowBlur = 15;
        ctx.shadowColor = \`hsl(\${this.hue}, 100%, 50%)\`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = \`hsl(\${this.hue}, 100%, \${50 + this.life * 30}%)\`;
        ctx.fill();
        ctx.restore();
      }
    }

    let mouseDown = false;
    let mouseX = 0, mouseY = 0;

    canvas.addEventListener('mousedown', (e) => {
      mouseDown = true;
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    canvas.addEventListener('mousemove', (e) => {
      if (mouseDown) {
        mouseX = e.clientX;
        mouseY = e.clientY;
      }
    });
    canvas.addEventListener('mouseup', () => mouseDown = false);
    canvas.addEventListener('touchstart', (e) => {
      mouseDown = true;
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
    });
    canvas.addEventListener('touchmove', (e) => {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      e.preventDefault();
    });
    canvas.addEventListener('touchend', () => mouseDown = false);

    function animate() {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (mouseDown) {
        const count = mode === 'explosion' ? 8 : 5;
        for (let i = 0; i < count; i++) {
          particles.push(new Particle(mouseX, mouseY, mode));
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
      }

      requestAnimationFrame(animate);
    }
    animate();
  </script>
  <script>${getStatsFloatScript()}</script>
</body>
</html>`;
}

function getKaleidoscopeHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>万花筒</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000; position: relative; }
    canvas { display: block; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; padding: 10px 20px; background: rgba(255,255,255,0.1);
            border-radius: 10px; backdrop-filter: blur(10px); }
    .back:hover { background: rgba(255,255,255,0.2); }
    .controls { position: absolute; top: 20px; right: 20px; z-index: 100; }
    .controls button { margin: 5px; padding: 10px 20px; border: none; border-radius: 8px;
                       background: rgba(255,255,255,0.15); color: white; cursor: pointer;
                       backdrop-filter: blur(10px); transition: all 0.3s; }
    .controls button:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .stats {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      padding: 15px;
      font-size: 11px;
      max-width: 250px;
      z-index: 100;
      font-family: 'Courier New', monospace;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    .stats.hidden { opacity: 0; pointer-events: none; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <div class="controls">
    <button onclick="changeMode(6)">6镜像</button>
    <button onclick="changeMode(8)">8镜像</button>
    <button onclick="changeMode(12)">12镜像</button>
    <button onclick="changeTheme('rainbow')">彩虹</button>
    <button onclick="changeTheme('fire')">火焰</button>
    <button onclick="changeTheme('ocean')">海洋</button>
  </div>
  <canvas id="canvas"></canvas>
  <div class="stats" id="stats">Loading...</div>
  <script>${getParticleBackgroundScript()}</script>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let segments = 8;
    let theme = 'rainbow';
    let trail = [];
    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;

    canvas.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      trail.push({ x: mouseX, y: mouseY, hue: Date.now() % 360 });
      if (trail.length > 50) trail.shift();
    });

    function changeMode(s) { segments = s; }
    function changeTheme(t) { theme = t; }

    function getColor(hue) {
      if (theme === 'rainbow') return \`hsl(\${hue}, 100%, 50%)\`;
      if (theme === 'fire') return \`hsl(\${hue % 60}, 100%, 50%)\`;
      if (theme === 'ocean') return \`hsl(\${180 + hue % 60}, 100%, 50%)\`;
    }

    function animate() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);

      for (let i = 0; i < segments; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / segments) * i);

        trail.forEach((p, idx) => {
          const x = p.x - canvas.width / 2;
          const y = p.y - canvas.height / 2;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = getColor(p.hue);
          ctx.globalAlpha = idx / trail.length;
          ctx.shadowBlur = 10;
          ctx.shadowColor = getColor(p.hue);
          ctx.fill();

          ctx.scale(1, -1);
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = getColor(p.hue);
          ctx.fill();
        });

        ctx.restore();
      }

      ctx.restore();
      requestAnimationFrame(animate);
    }
    animate();
  </script>
  <script>${getStatsFloatScript()}</script>
</body>
</html>`;
}

function getBreathingHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>色块呼吸灯</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000; position: relative; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; padding: 10px 20px; background: rgba(255,255,255,0.1);
            border-radius: 10px; backdrop-filter: blur(10px); }
    .back:hover { background: rgba(255,255,255,0.2); }
    .controls { position: absolute; top: 20px; right: 20px; z-index: 100; }
    .controls button { margin: 5px; padding: 10px 20px; border: none; border-radius: 8px;
                       background: rgba(255,255,255,0.15); color: white; cursor: pointer;
                       backdrop-filter: blur(10px); transition: all 0.3s; }
    .controls button:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; width: 100vw; height: 100vh; padding: 3px; }
    .cell {
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 4px;
      box-shadow: inset 0 0 20px rgba(0,0,0,0.3);
      position: relative;
      overflow: hidden;
    }
    .cell::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255,255,255,0.4);
      transform: translate(-50%, -50%);
      transition: width 0.6s ease, height 0.6s ease;
    }
    .cell:hover::before {
      width: 100%;
      height: 100%;
    }
    .stats {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      padding: 15px;
      font-size: 11px;
      max-width: 250px;
      z-index: 100;
      font-family: 'Courier New', monospace;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    .stats.hidden { opacity: 0; pointer-events: none; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <div class="controls">
    <button onclick="changeTheme('tech')">科技蓝</button>
    <button onclick="changeTheme('zen')">禅意绿</button>
    <button onclick="changeTheme('rainbow')">无限彩虹</button>
  </div>
  <div class="grid" id="grid"></div>
  <div class="stats" id="stats">Loading...</div>
  <script>${getParticleBackgroundScript()}</script>
  <script>
    const grid = document.getElementById('grid');
    const cells = [];
    let currentTheme = 'tech';

    const themes = {
      tech: { base: 200, range: 60 },
      zen: { base: 120, range: 40 },
      rainbow: { base: 0, range: 360 }
    };

    let mouseX = -1, mouseY = -1;

    for (let i = 0; i < 64; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.speed = 0.3 + Math.random() * 1.5;
      cell.dataset.offset = Math.random() * Math.PI * 2;
      cell.dataset.index = i;
      grid.appendChild(cell);
      cells.push(cell);

      // Add mouse interaction with ripple effect
      cell.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.05)';
        this.style.boxShadow = '0 0 30px rgba(255,255,255,0.6), inset 0 0 20px rgba(0,0,0,0.3)';
      });
      cell.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = 'inset 0 0 20px rgba(0,0,0,0.3)';
      });
    }

    // Track mouse position for proximity effects
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function changeTheme(theme) {
      currentTheme = theme;
    }

    function animate() {
      const time = Date.now() / 1000;
      const theme = themes[currentTheme];

      cells.forEach((cell, i) => {
        const speed = parseFloat(cell.dataset.speed);
        const offset = parseFloat(cell.dataset.offset);

        // Get cell position
        const rect = cell.getBoundingClientRect();
        const cellX = rect.left + rect.width / 2;
        const cellY = rect.top + rect.height / 2;

        // Calculate distance to mouse
        const dx = mouseX - cellX;
        const dy = mouseY - cellY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 300;
        const proximity = Math.max(0, 1 - dist / maxDist);

        // Enhanced breathing effect with wave propagation
        const wave = Math.sin(time * 0.5 + i * 0.15) * 0.5 + 0.5;
        const breathe = Math.sin(time * speed + offset);
        const baseBrightness = 40 + breathe * 25;
        const brightness = baseBrightness + proximity * 20 + wave * 15;

        let hue, saturation;
        if (currentTheme === 'rainbow') {
          hue = (time * 20 + i * 5.625 + proximity * 40) % 360;
          saturation = 75 + proximity * 20 + wave * 10;
        } else {
          hue = theme.base + Math.sin(time * speed + offset) * theme.range / 2 + proximity * 25;
          saturation = 70 + proximity * 25 + breathe * 15;
        }

        cell.style.backgroundColor = \`hsl(\${hue}, \${saturation}%, \${brightness}%)\`;

        // Add subtle glow effect
        if (proximity > 0.3) {
          cell.style.boxShadow = \`0 0 \${20 + proximity * 30}px hsla(\${hue}, \${saturation}%, \${brightness}%, 0.6), inset 0 0 20px rgba(0,0,0,0.3)\`;
        }
      });

      requestAnimationFrame(animate);
    }
    animate();
  </script>
  <script>${getStatsFloatScript()}</script>
</body>
</html>`;
}

function getCube3HTML() {
  return getCubeHTML(3);
}

function getCube4HTML() {
  return getCubeHTML(4);
}

function getCube5HTML() {
  return getCubeHTML(5);
}

function getStatsPageHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>访客统计排名</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', 'SimSun', serif;
      background: #ffffff;
      min-height: 100vh;
      padding: 60px 40px 40px;
      line-height: 1.8;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    header {
      border-bottom: 2px solid #000;
      padding-bottom: 30px;
      margin-bottom: 40px;
    }
    h1 {
      font-size: 2.2em;
      font-weight: 400;
      color: #000;
      margin-bottom: 10px;
    }
    .back-link {
      display: inline-block;
      margin-bottom: 20px;
      color: #0066cc;
      text-decoration: none;
      font-size: 0.95em;
    }
    .back-link:hover { text-decoration: underline; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .summary-box {
      background: #f9f9f9;
      border: 1px solid #ddd;
      padding: 20px;
      text-align: center;
    }
    .summary-box .label {
      font-size: 0.85em;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .summary-box .value {
      font-size: 2em;
      font-weight: 600;
      color: #000;
    }
    .section-title {
      font-size: 1.3em;
      font-weight: 600;
      color: #000;
      margin: 40px 0 20px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: #fff;
      border: 1px solid #ddd;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f9f9f9;
      font-weight: 600;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #333;
    }
    tr:hover {
      background: #fafafa;
    }
    .rank {
      font-weight: 600;
      color: #666;
    }
    .rank-1 { color: #FFD700; }
    .rank-2 { color: #C0C0C0; }
    .rank-3 { color: #CD7F32; }
    .ip-cell {
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #999;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← 返回首页</a>
    <header>
      <h1>访客统计排名</h1>
      <div style="color: #666; font-size: 0.95em; margin-top: 10px;">Visitor Analytics & Rankings</div>
    </header>

    <div class="summary">
      <div class="summary-box">
        <div class="label">Total Visitors</div>
        <div class="value" id="totalVisitors">-</div>
      </div>
      <div class="summary-box">
        <div class="label">Total Views</div>
        <div class="value" id="totalViews">-</div>
      </div>
    </div>

    <div class="section-title">IP访问排名（共 <span id="totalIPs">-</span> 个独立IP）</div>
    <table id="statsTable">
      <thead>
        <tr>
          <th style="width: 80px;">排名</th>
          <th>IP地址</th>
          <th style="width: 200px;">归属地</th>
          <th style="width: 120px;">访问次数</th>
        </tr>
      </thead>
      <tbody id="statsBody">
        <tr><td colspan="4" class="loading">加载中...</td></tr>
      </tbody>
    </table>
  </div>
  <script>${getParticleBackgroundScript()}</script>
  <script>
    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('totalVisitors').textContent = data.visitors;
      document.getElementById('totalViews').textContent = data.visits;
      document.getElementById('totalIPs').textContent = data.ips.length;

      const tbody = document.getElementById('statsBody');
      if (data.ips.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">暂无数据</td></tr>';
        return;
      }

      // Sort by count descending
      const sorted = data.ips.sort((a, b) => b.count - a.count);

      tbody.innerHTML = sorted.map((item, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? \`rank-\${rank}\` : 'rank';
        return \`
          <tr>
            <td class="\${rankClass}">#\${rank}</td>
            <td class="ip-cell">\${item.ip}</td>
            <td>\${item.location || 'Unknown'}</td>
            <td>\${item.count}</td>
          </tr>
        \`;
      }).join('');
    }).catch(err => {
      document.getElementById('statsBody').innerHTML = '<tr><td colspan="4" class="loading">加载失败</td></tr>';
    });
  </script>
</body>
</html>`;
}

function getCubeHTML(size) {
  const scaleFactor = 1.0 + (size - 3) * 0.4;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>魔方模拟器 ${size}×${size}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%); position: relative; }
    #container { width: 100vw; height: 100vh; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; padding: 10px 20px; background: rgba(255,255,255,0.1);
            border-radius: 10px; backdrop-filter: blur(10px); }
    .back:hover { background: rgba(255,255,255,0.2); }
    .controls { position: absolute; top: 20px; right: 20px; z-index: 100; }
    .controls button { margin: 5px; padding: 12px 24px; border: none; border-radius: 8px;
                       background: rgba(0,150,255,0.6); color: white; cursor: pointer;
                       box-shadow: 0 0 20px rgba(0,150,255,0.5); font-size: 14px;
                       backdrop-filter: blur(10px); transition: all 0.3s; }
    .controls button:hover { background: rgba(0,150,255,0.8); box-shadow: 0 0 30px rgba(0,150,255,0.8);
                              transform: translateY(-2px); }
    .controls a { color: white; text-decoration: none; padding: 10px 20px; display: inline-block;
                  background: rgba(255,255,255,0.1); border-radius: 8px; margin: 5px;
                  backdrop-filter: blur(10px); transition: all 0.3s; }
    .controls a:hover { background: rgba(255,255,255,0.2); }
    .info-panel {
      position: absolute;
      top: 50%;
      left: 30px;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 150, 255, 0.3);
      border-radius: 15px;
      padding: 20px;
      color: white;
      max-width: 250px;
      z-index: 50;
    }
    .info-panel h3 { margin-bottom: 15px; color: #00aaff; }
    .info-panel p { margin: 8px 0; font-size: 14px; line-height: 1.6; }
    .stats {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      padding: 15px;
      font-size: 11px;
      max-width: 250px;
      z-index: 100;
      font-family: 'Courier New', monospace;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    .stats.hidden { opacity: 0; pointer-events: none; }
    .floating-cubes {
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 1;
    }
    .mini-cube {
      position: absolute;
      width: 30px;
      height: 30px;
      background: rgba(0, 150, 255, 0.1);
      border: 1px solid rgba(0, 150, 255, 0.3);
      animation: floatCube 15s infinite ease-in-out;
    }
    .mini-cube:nth-child(1) { top: 10%; left: 5%; animation-delay: 0s; }
    .mini-cube:nth-child(2) { top: 60%; left: 8%; animation-delay: -3s; }
    .mini-cube:nth-child(3) { top: 30%; left: 90%; animation-delay: -6s; }
    .mini-cube:nth-child(4) { top: 80%; left: 85%; animation-delay: -9s; }
    @keyframes floatCube {
      0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.3; }
      25% { transform: translate(30px, -40px) rotate(90deg); opacity: 0.6; }
      50% { transform: translate(-20px, 40px) rotate(180deg); opacity: 0.3; }
      75% { transform: translate(40px, 20px) rotate(270deg); opacity: 0.6; }
    }
  </style>
</head>
<body>
  <div class="floating-cubes">
    <div class="mini-cube"></div>
    <div class="mini-cube"></div>
    <div class="mini-cube"></div>
    <div class="mini-cube"></div>
  </div>
  <a href="/" class="back">← 返回</a>
  <div class="info-panel">
    <h3>操作说明</h3>
    <p><strong>拖拽旋转：</strong>鼠标左键拖动</p>
    <p><strong>点击面块：</strong>旋转该层</p>
    <p><strong>打乱：</strong>随机打乱魔方</p>
    <p><strong>复原：</strong>恢复初始状态</p>
    <p style="margin-top:15px; color: #00aaff;">提示：点击魔方表面的小方块即可旋转对应的层！</p>
  </div>
  <div class="controls">
    <div><a href="/cube3">3×3</a><a href="/cube4">4×4</a><a href="/cube5">5×5</a></div>
    <button onclick="scrambleCube()">打乱</button>
    <button onclick="solveCube()">复原</button>
  </div>
  <div id="container"></div>
  <div class="stats" id="stats">Loading...</div>
  <script>${getParticleBackgroundScript()}</script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    let scene, camera, renderer, rubikGroup, cubelets = [];
    let raycaster, mouse;
    const SIZE = ${size};
    const GAP = 0.05;
    const SCALE = ${scaleFactor.toFixed(3)};
    const cubeState = [];
    let isAnimating = false;

    // Interaction state variables
    let interactionState = {
      active: false,
      startPoint: null,
      startPlane: null,
      selectedCube: null,
      possibleLayers: null,
      axisDetermined: false,
      rotationAxis: null,
      rotationLayer: null,
      startTime: 0
    };

    let controlState = {
      rotating: false,
      lastMouse: new THREE.Vector2(),
      velocity: new THREE.Vector2()
    };

    function snapToBasis(vec) {
      const max = Math.max(Math.abs(vec.x), Math.abs(vec.y), Math.abs(vec.z));
      vec.x = Math.abs(vec.x) === max ? Math.sign(vec.x) : 0;
      vec.y = vec.x !== 0 ? 0 : (Math.abs(vec.y) === max ? Math.sign(vec.y) : 0);
      vec.z = vec.x !== 0 || vec.y !== 0 ? 0 : Math.sign(vec.z);
      return vec;
    }

    function init() {
      scene = new THREE.Scene();

      // Responsive camera setup based on screen size
      const aspect = window.innerWidth / window.innerHeight;
      const baseFOV = 50;
      const fov = window.innerWidth < 768 ? baseFOV + 10 : baseFOV;
      camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);

      // Adjust camera distance based on screen size and cube size
      const baseDistance = window.innerWidth < 768 ? 20 : 15;
      const sizeMultiplier = SIZE / 3;
      camera.position.z = baseDistance + (SIZE - 3) * 2;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      document.getElementById('container').appendChild(renderer.domElement);

      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();

      const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
      scene.add(ambientLight);

      const light1 = new THREE.PointLight(0x0096ff, 2.5, 100);
      light1.position.set(5, 5, 5);
      light1.castShadow = true;
      scene.add(light1);

      const light2 = new THREE.PointLight(0x00ffff, 2, 100);
      light2.position.set(-5, -5, 5);
      scene.add(light2);

      const light3 = new THREE.PointLight(0x0066ff, 1.5, 100);
      light3.position.set(0, 0, -10);
      scene.add(light3);

      rubikGroup = new THREE.Group();
      scene.add(rubikGroup);

      createRubiksCube();

      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('touchstart', onTouchStart);
      renderer.domElement.addEventListener('touchmove', onTouchMove);
      renderer.domElement.addEventListener('touchend', onMouseUp);

      animate();
    }

    function createRubiksCube() {
      // Security conferences with their brand colors
      const faces = [
        { name: 'IEEE S&P', color: '#003f87', textColor: '#ffffff' },  // IEEE Blue
        { name: 'USENIX', color: '#8B0000', textColor: '#ffffff' },    // Dark Red
        { name: 'CCS', color: '#2E8B57', textColor: '#ffffff' },       // Sea Green
        { name: 'NDSS', color: '#FF8C00', textColor: '#000000' },      // Dark Orange
        { name: 'BlackHat', color: '#33CEFF', textColor: '#000000' },  // Official Dodger Blue
        { name: 'DEFCON', color: '#4477AA', textColor: '#ffffff' }     // Official Blue-Purple
      ];

      // Calculate font size based on cube size to maintain readability
      const fontSize = Math.floor(48 / (SIZE / 3));

      for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++) {
          for (let z = 0; z < SIZE; z++) {
            const geometry = new THREE.BoxGeometry(0.95 * SCALE, 0.95 * SCALE, 0.95 * SCALE);

            // Create materials with text for each face
            const materials = faces.map((face, faceIndex) => {
              const canvas = document.createElement('canvas');
              canvas.width = 512;
              canvas.height = 512;
              const context = canvas.getContext('2d');

              // Enable high quality rendering
              context.imageSmoothingEnabled = true;
              context.imageSmoothingQuality = 'high';

              // Background
              context.fillStyle = face.color;
              context.fillRect(0, 0, 512, 512);

              // Text
              context.fillStyle = face.textColor;
              context.font = \`bold \${fontSize * 2}px Arial, sans-serif\`;
              context.textAlign = 'center';
              context.textBaseline = 'middle';
              context.fillText(face.name, 256, 256);

              // Border
              context.strokeStyle = face.textColor;
              context.lineWidth = 8;
              context.strokeRect(4, 4, 504, 504);

              const texture = new THREE.CanvasTexture(canvas);
              texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
              texture.minFilter = THREE.LinearMipMapLinearFilter;
              texture.magFilter = THREE.LinearFilter;

              return new THREE.MeshPhongMaterial({
                map: texture,
                shininess: 30,
                specular: 0x222222
              });
            });

            const cube = new THREE.Mesh(geometry, materials);
            const posX = (x - SIZE / 2 + 0.5) * (1 + GAP) * SCALE;
            const posY = (y - SIZE / 2 + 0.5) * (1 + GAP) * SCALE;
            const posZ = (z - SIZE / 2 + 0.5) * (1 + GAP) * SCALE;

            cube.position.set(posX, posY, posZ);
            cube.castShadow = true;
            cube.receiveShadow = true;

            cube.userData = {
              initPos: new THREE.Vector3(posX, posY, posZ),
              initRot: new THREE.Euler(0, 0, 0),
              gridPos: { x, y, z }
            };

            rubikGroup.add(cube);
            cubelets.push(cube);
            cubeState.push({ x, y, z });
          }
        }
      }
    }

    function onMouseDown(e) {
      if (isAnimating) return;

      const x = e.clientX;
      const y = e.clientY;

      mouse.x = (x / window.innerWidth) * 2 - 1;
      mouse.y = -(y / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cubelets);

      if (intersects.length > 0) {
        // Interacting with cube
        const intersect = intersects[0];
        interactionState.active = true;
        interactionState.axisDetermined = false;
        interactionState.selectedCube = intersect.object;
        interactionState.startPoint = intersect.point.clone();
        interactionState.startTime = Date.now();

        // Create plane from intersected face
        const normal = intersect.face.normal.clone();
        normal.transformDirection(intersect.object.matrixWorld);
        interactionState.startPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, intersect.point);

        // Store possible layers
        const gridPos = intersect.object.userData.gridPos;
        interactionState.possibleLayers = { x: gridPos.x, y: gridPos.y, z: gridPos.z };

        controlState.rotating = false;
      } else {
        // Interacting with background - rotate whole cube
        controlState.rotating = true;
        controlState.lastMouse.set(x, y);
      }
    }

    function onMouseMove(e) {
      const x = e.clientX;
      const y = e.clientY;

      // Handle whole cube rotation
      if (controlState.rotating) {
        const deltaX = x - controlState.lastMouse.x;
        const deltaY = y - controlState.lastMouse.y;
        // Rotate in direction of mouse movement
        rubikGroup.rotation.y -= deltaX * 0.01;
        rubikGroup.rotation.x -= deltaY * 0.01;
        controlState.lastMouse.set(x, y);
        return;
      }

      // Handle layer rotation
      if (!interactionState.active) return;

      mouse.x = (x / window.innerWidth) * 2 - 1;
      mouse.y = -(y / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const currentPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(interactionState.startPlane, currentPoint);
      if (!currentPoint) return;

      // Calculate drag direction on the plane
      const dragVec = new THREE.Vector3().subVectors(currentPoint, interactionState.startPoint);
      const dragDist = dragVec.length();

      // Determine axis when drag distance is sufficient
      if (!interactionState.axisDetermined && dragDist > 0.1 * SCALE) {
        interactionState.axisDetermined = true;

        // Calculate rotation axis: plane normal × drag direction
        const axis3D = new THREE.Vector3();
        axis3D.crossVectors(interactionState.startPlane.normal, dragVec);
        snapToBasis(axis3D);

        // Determine which axis
        let axis, layer;
        if (Math.abs(axis3D.x) === 1) {
          axis = 'x';
          layer = interactionState.possibleLayers.x;
        } else if (Math.abs(axis3D.y) === 1) {
          axis = 'y';
          layer = interactionState.possibleLayers.y;
        } else {
          axis = 'z';
          layer = interactionState.possibleLayers.z;
        }

        interactionState.rotationAxis = axis;
        interactionState.rotationLayer = layer;

        // Determine rotation direction
        // The cross vector tells us the positive rotation direction
        const axisVec = new THREE.Vector3();
        axisVec[axis] = axis3D[axis];

        const cross = new THREE.Vector3();
        cross.crossVectors(interactionState.startPlane.normal, axisVec);

        // The sign of the dot product determines rotation direction
        // Inverted to match user drag direction
        const dotProduct = cross.dot(dragVec);
        const direction = dotProduct > 0 ? -1 : 1;

        animateRotation(axis, layer, (Math.PI / 2) * direction);
      }
    }

    function onMouseUp() {
      // Reset interaction state
      interactionState.active = false;
      interactionState.axisDetermined = false;
      interactionState.selectedCube = null;
      interactionState.startPoint = null;
      interactionState.startPlane = null;
      interactionState.possibleLayers = null;
      interactionState.rotationAxis = null;
      interactionState.rotationLayer = null;

      // Reset control state
      controlState.rotating = false;
    }

    function onTouchStart(e) {
      if (e.touches.length === 1 && !isAnimating) {
        const touch = e.touches[0];
        onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
        e.preventDefault();
      }
    }

    function onTouchMove(e) {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        e.preventDefault();
      }
    }

    function animateRotation(axis, layer, angle) {
      isAnimating = true;
      const duration = 300;
      const startTime = Date.now();
      const layerGroup = new THREE.Group();
      rubikGroup.add(layerGroup);

      const cubesToRotate = [];
      cubelets.forEach(cube => {
        const pos = cube.userData.gridPos;
        let shouldRotate = false;

        if (axis === 'x' && pos.x === layer) shouldRotate = true;
        if (axis === 'y' && pos.y === layer) shouldRotate = true;
        if (axis === 'z' && pos.z === layer) shouldRotate = true;

        if (shouldRotate) {
          cubesToRotate.push(cube);
          THREE.SceneUtils.detach(cube, rubikGroup, layerGroup);
        }
      });

      function rotateStep() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        const currentAngle = angle * eased;

        layerGroup.rotation[axis] = currentAngle;

        if (progress < 1) {
          requestAnimationFrame(rotateStep);
        } else {
          // Update grid positions based on rotation
          cubesToRotate.forEach(cube => {
            THREE.SceneUtils.attach(cube, layerGroup, rubikGroup);

            const pos = cube.userData.gridPos;
            const center = (SIZE - 1) / 2;

            if (axis === 'x') {
              const newY = Math.round(center - (pos.z - center) * Math.sign(angle));
              const newZ = Math.round(center + (pos.y - center) * Math.sign(angle));
              pos.y = newY;
              pos.z = newZ;
            } else if (axis === 'y') {
              const newX = Math.round(center + (pos.z - center) * Math.sign(angle));
              const newZ = Math.round(center - (pos.x - center) * Math.sign(angle));
              pos.x = newX;
              pos.z = newZ;
            } else if (axis === 'z') {
              const newX = Math.round(center - (pos.y - center) * Math.sign(angle));
              const newY = Math.round(center + (pos.x - center) * Math.sign(angle));
              pos.x = newX;
              pos.y = newY;
            }
          });

          rubikGroup.remove(layerGroup);
          isAnimating = false;
        }
      }

      rotateStep();
    }

    // Add THREE.SceneUtils.attach and detach helpers
    THREE.SceneUtils = {
      attach: function(child, scene, parent) {
        child.parent.updateMatrixWorld();
        child.applyMatrix4(child.parent.matrixWorld);
        child.parent.remove(child);
        child.applyMatrix4(parent.matrixWorld.clone().invert());
        parent.add(child);
      },
      detach: function(child, parent, scene) {
        child.parent.updateMatrixWorld();
        child.applyMatrix4(child.parent.matrixWorld);
        child.parent.remove(child);
        child.applyMatrix4(scene.matrixWorld.clone().invert());
        scene.add(child);
      }
    };

    function scrambleCube() {
      if (isAnimating) return;
      // Random number of moves between 20 and 50
      const moves = 20 + Math.floor(Math.random() * 31);
      let count = 0;

      function doMove() {
        if (count >= moves) return;
        const axis = ['x', 'y', 'z'][Math.floor(Math.random() * 3)];
        const layer = Math.floor(Math.random() * SIZE);
        const direction = Math.random() < 0.5 ? 1 : -1;
        animateRotation(axis, layer, (Math.PI / 2) * direction);
        count++;
        setTimeout(doMove, 350);
      }

      doMove();
    }

    function solveCube() {
      if (isAnimating) return;
      cubelets.forEach((cube, idx) => {
        cube.position.copy(cube.userData.initPos);
        cube.rotation.copy(cube.userData.initRot);
        const x = Math.floor(idx / (SIZE * SIZE));
        const y = Math.floor((idx % (SIZE * SIZE)) / SIZE);
        const z = idx % SIZE;
        cube.userData.gridPos = { x, y, z };
      });
    }

    function animate() {
      requestAnimationFrame(animate);
      // No auto-rotation - cube stays still unless user interacts
      renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    init();
  </script>
  <script>${getStatsFloatScript()}</script>
</body>
</html>`;
}
