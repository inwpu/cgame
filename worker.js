export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const fingerprint = await generateFingerprint(clientIP, userAgent);

    await trackVisitor(env, clientIP, fingerprint, userAgent);

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
      const stats = await getStats(env);
      return new Response(JSON.stringify(stats), { headers: { 'Content-Type': 'application/json' } });
    }

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

async function trackVisitor(env, ip, fingerprint, ua) {
  if (!env.VISITORS) return;

  const key = `visitor:${fingerprint}`;
  const existing = await env.VISITORS.get(key);

  if (!existing) {
    await env.VISITORS.put(key, JSON.stringify({ ip, ua, first: Date.now(), count: 1 }));
    const totalVisitors = parseInt((await env.VISITORS.get('total_visitors')) || '0');
    await env.VISITORS.put('total_visitors', String(totalVisitors + 1));
  } else {
    const data = JSON.parse(existing);
    data.count++;
    data.last = Date.now();
    await env.VISITORS.put(key, JSON.stringify(data));
  }

  const totalVisits = parseInt((await env.VISITORS.get('total_visits')) || '0');
  await env.VISITORS.put('total_visits', String(totalVisits + 1));
}

async function getStats(env) {
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
        ips.push({ ip: data.ip, count: data.count });
      }
    }
  }

  return { visitors, visits, ips: ips.slice(0, 10) };
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
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = 2 + Math.random() * 3;
        this.hue = Math.random() * 360;
      }
      update() {
        const dx = bgMouseX - this.x;
        const dy = bgMouseY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150;
          this.vx += (dx / dist) * force * 0.5;
          this.vy += (dy / dist) * force * 0.5;
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
        pCtx.fillStyle = \`hsla(\${this.hue}, 80%, 60%, 0.8)\`;
        pCtx.shadowBlur = 10;
        pCtx.shadowColor = \`hsla(\${this.hue}, 100%, 50%, 0.5)\`;
        pCtx.fill();
      }
    }

    for (let i = 0; i < 100; i++) {
      bgParticles.push(new BgParticle());
    }

    document.addEventListener('mousemove', (e) => {
      bgMouseX = e.clientX;
      bgMouseY = e.clientY;
    });

    function animateBgParticles() {
      pCtx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      pCtx.fillRect(0, 0, particleCanvas.width, particleCanvas.height);

      // Draw connections
      for (let i = 0; i < bgParticles.length; i++) {
        for (let j = i + 1; j < bgParticles.length; j++) {
          const dx = bgParticles[i].x - bgParticles[j].x;
          const dy = bgParticles[i].y - bgParticles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            pCtx.beginPath();
            pCtx.moveTo(bgParticles[i].x, bgParticles[i].y);
            pCtx.lineTo(bgParticles[j].x, bgParticles[j].y);
            const alpha = (1 - dist / 120) * 0.3;
            pCtx.strokeStyle = \`hsla(\${(bgParticles[i].hue + bgParticles[j].hue) / 2}, 80%, 60%, \${alpha})\`;
            pCtx.lineWidth = 1;
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
  <title>解压小游戏集合</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(ellipse at top, #1b2735 0%, #090a0f 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    body::before {
      content: '';
      position: absolute;
      width: 200%;
      height: 200%;
      top: -50%;
      left: -50%;
      background:
        radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(255, 0, 128, 0.2), transparent 50%),
        radial-gradient(circle at 40% 20%, rgba(0, 255, 255, 0.2), transparent 50%);
      animation: bgFloat 20s ease-in-out infinite;
    }
    @keyframes bgFloat {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      33% { transform: translate(30px, -50px) rotate(120deg); }
      66% { transform: translate(-20px, 20px) rotate(240deg); }
    }
    .stars {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .star {
      position: absolute;
      width: 2px;
      height: 2px;
      background: white;
      border-radius: 50%;
      animation: twinkle 3s infinite;
    }
    @keyframes twinkle {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
    .container {
      max-width: 1200px;
      width: 100%;
      position: relative;
      z-index: 10;
    }
    h1 {
      text-align: center;
      color: white;
      font-size: 3.5em;
      margin-bottom: 20px;
      text-shadow: 0 0 20px rgba(120, 119, 198, 0.8), 0 0 40px rgba(120, 119, 198, 0.5);
      animation: glow 2s ease-in-out infinite alternate;
    }
    @keyframes glow {
      from { text-shadow: 0 0 20px rgba(120, 119, 198, 0.8), 0 0 40px rgba(120, 119, 198, 0.5); }
      to { text-shadow: 0 0 30px rgba(120, 119, 198, 1), 0 0 60px rgba(120, 119, 198, 0.8); }
    }
    .subtitle {
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      font-size: 1.2em;
      margin-bottom: 50px;
      letter-spacing: 2px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 30px;
      margin-bottom: 40px;
    }
    .card {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 35px;
      text-align: center;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: visible;
    }
    .card::before {
      content: '';
      position: absolute;
      top: -3px;
      left: -3px;
      right: -3px;
      bottom: -3px;
      background: linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3);
      background-size: 400%;
      border-radius: 20px;
      z-index: -1;
      animation: rainbow 4s linear infinite;
      filter: blur(10px);
      opacity: 0;
      transition: opacity 0.4s;
    }
    .card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 20px;
      box-shadow: 0 0 40px rgba(120, 119, 198, 0.4);
      opacity: 0.6;
      animation: breathe 3s ease-in-out infinite;
    }
    @keyframes rainbow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes breathe {
      0%, 100% { box-shadow: 0 0 20px rgba(120, 119, 198, 0.4); }
      50% { box-shadow: 0 0 60px rgba(120, 119, 198, 0.8); }
    }
    .card:hover {
      transform: translateY(-15px) scale(1.05);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    .card:hover::before {
      opacity: 0.9;
      animation: rainbow 2s linear infinite, sparkle 0.6s ease-in-out infinite;
    }
    @keyframes sparkle {
      0%, 100% { filter: blur(10px) brightness(1); }
      50% { filter: blur(15px) brightness(1.5); }
    }
    .card h2 {
      color: white;
      font-size: 1.6em;
      margin-bottom: 12px;
      position: relative;
      z-index: 1;
    }
    .card p {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.95em;
      position: relative;
      z-index: 1;
    }
    .icon {
      font-size: 3.5em;
      margin-bottom: 15px;
      filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
    }
    .stats {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(120, 119, 198, 0.3);
      color: white;
      padding: 15px;
      border-radius: 15px;
      font-size: 12px;
      max-width: 300px;
      z-index: 100;
      box-shadow: 0 0 30px rgba(120, 119, 198, 0.3);
    }
    .stats div { margin: 5px 0; }
    .footer {
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.9em;
      margin-top: 30px;
    }
    .floating-shapes {
      position: fixed;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 1;
    }
    .shape {
      position: absolute;
      opacity: 0.1;
      animation: float 20s infinite ease-in-out;
    }
    .shape:nth-child(1) {
      width: 80px;
      height: 80px;
      border: 2px solid cyan;
      border-radius: 50%;
      top: 10%;
      left: 10%;
      animation-delay: 0s;
    }
    .shape:nth-child(2) {
      width: 60px;
      height: 60px;
      border: 2px solid magenta;
      top: 70%;
      left: 80%;
      animation-delay: -5s;
    }
    .shape:nth-child(3) {
      width: 100px;
      height: 100px;
      border: 2px solid yellow;
      border-radius: 50%;
      top: 30%;
      left: 85%;
      animation-delay: -10s;
    }
    .shape:nth-child(4) {
      width: 70px;
      height: 70px;
      border: 2px solid lime;
      top: 80%;
      left: 15%;
      animation-delay: -15s;
    }
    @keyframes float {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      25% { transform: translate(20px, -30px) rotate(90deg); }
      50% { transform: translate(-20px, 30px) rotate(180deg); }
      75% { transform: translate(30px, 20px) rotate(270deg); }
    }
  </style>
</head>
<body>
  <div class="stars" id="stars"></div>
  <div class="floating-shapes">
    <div class="shape"></div>
    <div class="shape"></div>
    <div class="shape"></div>
    <div class="shape"></div>
  </div>
  <div class="container">
    <h1>🎮 解压小游戏</h1>
    <div class="subtitle">STRESS RELIEF GAMES COLLECTION</div>
    <div class="grid">
      <div class="card" onclick="location.href='/slime'">
        <div class="icon">🧪</div>
        <h2>无限扭曲史莱姆</h2>
        <p>点击拖拽产生果冻形变</p>
      </div>
      <div class="card" onclick="location.href='/bounce'">
        <div class="icon">⚽</div>
        <h2>小球碰碰碰</h2>
        <p>点击生成反弹小球</p>
      </div>
      <div class="card" onclick="location.href='/fountain'">
        <div class="icon">🎆</div>
        <h2>粒子喷泉</h2>
        <p>点击喷出彩色粒子</p>
      </div>
      <div class="card" onclick="location.href='/kaleidoscope'">
        <div class="icon">🌈</div>
        <h2>万花筒</h2>
        <p>鼠标移动生成图案</p>
      </div>
      <div class="card" onclick="location.href='/breathing'">
        <div class="icon">🎨</div>
        <h2>色块呼吸灯</h2>
        <p>舒缓的颜色变化</p>
      </div>
      <div class="card" onclick="location.href='/cube3'">
        <div class="icon">🧊</div>
        <h2>魔方模拟器</h2>
        <p>3×3 / 4×4 / 5×5</p>
      </div>
    </div>
    <div class="footer">
      <p>让压力随指尖消散 · 在游戏中找回平静</p>
    </div>
  </div>
  <div class="stats" id="stats">加载中...</div>
  <script>
    // Generate stars
    const starsContainer = document.getElementById('stars');
    for (let i = 0; i < 100; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.animationDelay = Math.random() * 3 + 's';
      starsContainer.appendChild(star);
    }
  </script>
  <script>${getParticleBackgroundScript()}</script>
  <script>
    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div><strong>📊 访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>🌐 最近访客IP:</strong></div>
        \${data.ips.map(v => \`<div>• \${v.ip} (访问\${v.count}次)</div>\`).join('')}
      \`;
    });
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
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100;
             backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
    .stats div { margin: 5px 0; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <canvas id="slimeCanvas"></canvas>
  <div class="stats" id="stats">加载中...</div>
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

    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div><strong>📊 访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>🌐 最近访客IP:</strong></div>
        \${data.ips.map(v => \`<div>• \${v.ip} (访问\${v.count}次)</div>\`).join('')}
      \`;
    });
  </script>
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
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100;
             backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
    .stats div { margin: 5px 0; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <canvas id="canvas"></canvas>
  <div class="stats" id="stats">加载中...</div>
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

    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div><strong>📊 访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>🌐 最近访客IP:</strong></div>
        \${data.ips.map(v => \`<div>• \${v.ip} (访问\${v.count}次)</div>\`).join('')}
      \`;
    });
  </script>
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
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100;
             backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
    .stats div { margin: 5px 0; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <div class="controls">
    <button onclick="mode='firework'">烟花🎆</button>
    <button onclick="mode='fountain'">喷泉⛲</button>
    <button onclick="mode='spiral'">螺旋🌀</button>
    <button onclick="mode='rainbow'">彩虹🌈</button>
    <button onclick="mode='explosion'">爆炸💥</button>
  </div>
  <canvas id="canvas"></canvas>
  <div class="stats" id="stats">加载中...</div>
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

    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div><strong>📊 访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>🌐 最近访客IP:</strong></div>
        \${data.ips.map(v => \`<div>• \${v.ip} (访问\${v.count}次)</div>\`).join('')}
      \`;
    });
  </script>
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
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100;
             backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
    .stats div { margin: 5px 0; }
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
  <div class="stats" id="stats">加载中...</div>
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

    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div><strong>📊 访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>🌐 最近访客IP:</strong></div>
        \${data.ips.map(v => \`<div>• \${v.ip} (访问\${v.count}次)</div>\`).join('')}
      \`;
    });
  </script>
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
    .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0; width: 100vw; height: 100vh; }
    .cell { transition: background-color 0.5s ease; }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100;
             backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
    .stats div { margin: 5px 0; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <div class="controls">
    <button onclick="changeTheme('tech')">科技蓝💙</button>
    <button onclick="changeTheme('zen')">禅意绿💚</button>
    <button onclick="changeTheme('rainbow')">无限彩虹🌈</button>
  </div>
  <div class="grid" id="grid"></div>
  <div class="stats" id="stats">加载中...</div>
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

    for (let i = 0; i < 30; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.speed = 0.5 + Math.random() * 2;
      cell.dataset.offset = Math.random() * Math.PI * 2;
      grid.appendChild(cell);
      cells.push(cell);
    }

    function changeTheme(theme) {
      currentTheme = theme;
    }

    function animate() {
      const time = Date.now() / 1000;
      const theme = themes[currentTheme];

      cells.forEach((cell, i) => {
        const speed = parseFloat(cell.dataset.speed);
        const offset = parseFloat(cell.dataset.offset);
        const brightness = 30 + Math.sin(time * speed + offset) * 20 + 30;

        let hue;
        if (currentTheme === 'rainbow') {
          hue = (time * 30 + i * 12) % 360;
        } else {
          hue = theme.base + Math.sin(time * speed + offset) * theme.range / 2;
        }

        cell.style.backgroundColor = \`hsl(\${hue}, 70%, \${brightness}%)\`;
      });

      requestAnimationFrame(animate);
    }
    animate();

    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div><strong>📊 访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>🌐 最近访客IP:</strong></div>
        \${data.ips.map(v => \`<div>• \${v.ip} (访问\${v.count}次)</div>\`).join('')}
      \`;
    });
  </script>
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

function getCubeHTML(size) {
  const cameraZ = size === 3 ? 8 : size === 4 ? 10 : 12;
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
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100;
             box-shadow: 0 0 20px rgba(0,150,255,0.3); backdrop-filter: blur(10px);
             border: 1px solid rgba(0,150,255,0.3); }
    .stats div { margin: 5px 0; }
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
    <h3>🎮 操作说明</h3>
    <p><strong>拖拽旋转：</strong>鼠标左键拖动</p>
    <p><strong>点击面块：</strong>旋转该层</p>
    <p><strong>打乱：</strong>随机打乱魔方</p>
    <p><strong>复原：</strong>恢复初始状态</p>
    <p style="margin-top:15px; color: #00aaff;">提示：点击魔方表面的小方块即可旋转对应的层！</p>
  </div>
  <div class="controls">
    <div><a href="/cube3">3×3</a><a href="/cube4">4×4</a><a href="/cube5">5×5</a></div>
    <button onclick="scrambleCube()">🎲 打乱</button>
    <button onclick="solveCube()">✨ 复原</button>
  </div>
  <div id="container"></div>
  <div class="stats" id="stats">加载中...</div>
  <script>${getParticleBackgroundScript()}</script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    let scene, camera, renderer, rubikGroup, cubelets = [];
    let isDragging = false, previousMouse = { x: 0, y: 0 };
    let raycaster, mouse;
    const SIZE = ${size};
    const GAP = 0.05;
    const cubeState = [];
    let isAnimating = false;

    function init() {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = ${cameraZ};

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
      renderer.domElement.addEventListener('click', onCubeClick);
      renderer.domElement.addEventListener('touchstart', onTouchStart);
      renderer.domElement.addEventListener('touchmove', onTouchMove);
      renderer.domElement.addEventListener('touchend', onMouseUp);

      animate();
    }

    function createRubiksCube() {
      const colors = [
        0xff3333, 0x33ff33, 0x3333ff,
        0xffff33, 0xffffff, 0xff8833
      ];

      for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++) {
          for (let z = 0; z < SIZE; z++) {
            const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
            const materials = colors.map(color => {
              return new THREE.MeshPhongMaterial({
                color,
                shininess: 100,
                specular: 0x666666,
                emissive: color,
                emissiveIntensity: 0.2
              });
            });

            const cube = new THREE.Mesh(geometry, materials);
            cube.position.set(
              (x - SIZE / 2 + 0.5) * (1 + GAP),
              (y - SIZE / 2 + 0.5) * (1 + GAP),
              (z - SIZE / 2 + 0.5) * (1 + GAP)
            );

            cube.castShadow = true;
            cube.receiveShadow = true;

            cube.userData = {
              initPos: cube.position.clone(),
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
      isDragging = true;
      previousMouse = { x: e.clientX, y: e.clientY };
    }

    function onMouseMove(e) {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMouse.x;
      const deltaY = e.clientY - previousMouse.y;
      rubikGroup.rotation.y += deltaX * 0.01;
      rubikGroup.rotation.x += deltaY * 0.01;
      previousMouse = { x: e.clientX, y: e.clientY };
    }

    function onMouseUp() {
      isDragging = false;
    }

    function onTouchStart(e) {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }

    function onTouchMove(e) {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMouse.x;
      const deltaY = e.touches[0].clientY - previousMouse.y;
      rubikGroup.rotation.y += deltaX * 0.01;
      rubikGroup.rotation.x += deltaY * 0.01;
      previousMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      e.preventDefault();
    }

    function onCubeClick(event) {
      if (isAnimating || isDragging) return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cubelets);

      if (intersects.length > 0) {
        const clickedCube = intersects[0].object;
        const faceIndex = Math.floor(intersects[0].faceIndex / 2);
        rotateFace(clickedCube, faceIndex);
      }
    }

    function rotateFace(clickedCube, faceIndex) {
      const gridPos = clickedCube.userData.gridPos;
      let axis, layer;

      if (faceIndex === 0) { axis = 'x'; layer = SIZE - 1; }
      else if (faceIndex === 1) { axis = 'x'; layer = 0; }
      else if (faceIndex === 2) { axis = 'y'; layer = SIZE - 1; }
      else if (faceIndex === 3) { axis = 'y'; layer = 0; }
      else if (faceIndex === 4) { axis = 'z'; layer = SIZE - 1; }
      else if (faceIndex === 5) { axis = 'z'; layer = 0; }

      animateRotation(axis, layer, Math.PI / 2);
    }

    function animateRotation(axis, layer, angle) {
      isAnimating = true;
      const duration = 300;
      const startTime = Date.now();
      const layerGroup = new THREE.Group();
      scene.add(layerGroup);

      const cubesToRotate = [];
      cubelets.forEach(cube => {
        const pos = cube.userData.gridPos;
        let shouldRotate = false;

        if (axis === 'x' && pos.x === layer) shouldRotate = true;
        if (axis === 'y' && pos.y === layer) shouldRotate = true;
        if (axis === 'z' && pos.z === layer) shouldRotate = true;

        if (shouldRotate) {
          cubesToRotate.push(cube);
          rubikGroup.remove(cube);
          layerGroup.add(cube);
        }
      });

      function rotateStep() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentAngle = angle * progress;

        layerGroup.rotation[axis] = currentAngle;

        if (progress < 1) {
          requestAnimationFrame(rotateStep);
        } else {
          cubesToRotate.forEach(cube => {
            const worldPos = new THREE.Vector3();
            cube.getWorldPosition(worldPos);
            const worldRot = new THREE.Euler();
            cube.getWorldQuaternion(new THREE.Quaternion()).toEuler(worldRot);

            layerGroup.remove(cube);
            rubikGroup.add(cube);

            cube.position.copy(worldPos);
            cube.rotation.copy(worldRot);
          });

          scene.remove(layerGroup);
          isAnimating = false;
        }
      }

      rotateStep();
    }

    function scrambleCube() {
      if (isAnimating) return;
      const moves = 20;
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
      cubelets.forEach(cube => {
        cube.position.copy(cube.userData.initPos);
        cube.rotation.set(0, 0, 0);
        cube.userData.gridPos = {
          x: Math.round((cube.position.x / (1 + GAP)) + SIZE / 2 - 0.5),
          y: Math.round((cube.position.y / (1 + GAP)) + SIZE / 2 - 0.5),
          z: Math.round((cube.position.z / (1 + GAP)) + SIZE / 2 - 0.5)
        };
      });
    }

    function animate() {
      requestAnimationFrame(animate);
      if (!isDragging && !isAnimating) {
        rubikGroup.rotation.y += 0.003;
      }
      renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    init();

    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div><strong>📊 访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>🌐 最近访客IP:</strong></div>
        \${data.ips.map(v => \`<div>• \${v.ip} (访问\${v.count}次)</div>\`).join('')}
      \`;
    });
  </script>
</body>
</html>`;
}
