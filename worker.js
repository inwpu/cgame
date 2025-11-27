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
        this.radius = 1 + Math.random() * 2;
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
        pCtx.fillStyle = \`hsla(\${this.hue}, 70%, 60%, 0.6)\`;
        pCtx.fill();
      }
    }

    for (let i = 0; i < 80; i++) {
      bgParticles.push(new BgParticle());
    }

    document.addEventListener('mousemove', (e) => {
      bgMouseX = e.clientX;
      bgMouseY = e.clientY;
    });

    function animateBgParticles() {
      pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      position: relative;
    }
    .container {
      max-width: 900px;
      width: 100%;
      position: relative;
      z-index: 10;
    }
    h1 {
      text-align: center;
      color: white;
      font-size: 3em;
      margin-bottom: 50px;
      text-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 25px;
    }
    .card {
      background: rgba(255,255,255,0.95);
      border-radius: 20px;
      padding: 30px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      background: linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3);
      background-size: 400%;
      border-radius: 20px;
      z-index: -1;
      animation: rainbow 3s linear infinite;
      filter: blur(8px);
      opacity: 0.8;
    }
    @keyframes rainbow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .card:hover {
      transform: translateY(-10px) scale(1.02);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      animation: sparkle 0.6s ease-in-out infinite;
    }
    @keyframes sparkle {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.3); }
    }
    .card h2 {
      color: #667eea;
      font-size: 1.5em;
      margin-bottom: 10px;
    }
    .card p {
      color: #666;
      font-size: 0.9em;
    }
    .icon {
      font-size: 3em;
      margin-bottom: 15px;
    }
    .stats {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 15px;
      border-radius: 10px;
      font-size: 12px;
      max-width: 300px;
      z-index: 100;
    }
    .stats div { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎮 解压小游戏</h1>
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
  </div>
  <div class="stats" id="stats">加载中...</div>
  <script>${getParticleBackgroundScript()}</script>
  <script>
    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div><strong>访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>最近访客IP:</strong></div>
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
    body { overflow: hidden; background: #1a1a2e; position: relative; }
    canvas { display: block; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100; }
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

    class Point {
      constructor(x, y) {
        this.x = this.originX = x;
        this.y = this.originY = y;
        this.vx = 0;
        this.vy = 0;
      }
      update() {
        const dx = this.originX - this.x;
        const dy = this.originY - this.y;
        this.vx += dx * 0.008;
        this.vy += dy * 0.008;
        this.vx *= 0.92;
        this.vy *= 0.92;
        this.x += this.vx;
        this.y += this.vy;
      }
    }

    const points = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    let radius = 150;
    let breathScale = 1;

    for (let i = 0; i < 360; i += 8) {
      const angle = (i * Math.PI) / 180;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      points.push(new Point(x, y));
    }

    let mouseX = 0, mouseY = 0, mouseDown = false;

    canvas.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    canvas.addEventListener('mousedown', () => mouseDown = true);
    canvas.addEventListener('mouseup', () => mouseDown = false);
    canvas.addEventListener('touchmove', (e) => {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      mouseDown = true;
      e.preventDefault();
    });
    canvas.addEventListener('touchend', () => mouseDown = false);

    function animate() {
      ctx.fillStyle = 'rgba(26, 26, 46, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      breathScale = 1 + Math.sin(Date.now() / 1000) * 0.15;

      points.forEach((p, i) => {
        if (mouseDown) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            const force = (200 - dist) / 200;
            p.x += dx * force * 0.3;
            p.y += dy * force * 0.3;
          }
        }
        p.update();

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

      const time = Date.now() / 10;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * breathScale);
      gradient.addColorStop(0, \`hsl(\${time % 360}, 100%, 60%)\`);
      gradient.addColorStop(1, \`hsl(\${(time + 180) % 360}, 100%, 50%)\`);
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 30;
      ctx.shadowColor = \`hsl(\${time % 360}, 100%, 50%)\`;
      ctx.fill();
      ctx.shadowBlur = 0;

      requestAnimationFrame(animate);
    }
    animate();

    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div><strong>访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>最近访客IP:</strong></div>
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
    body { overflow: hidden; background: #16213e; position: relative; }
    canvas { display: block; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100; }
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
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    class Explosion {
      constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.particles = [];
        for (let i = 0; i < 15; i++) {
          const angle = (Math.PI * 2 * i) / 15;
          const speed = 2 + Math.random() * 4;
          this.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1
          });
        }
      }
      update() {
        this.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.life -= 0.02;
        });
        this.particles = this.particles.filter(p => p.life > 0);
      }
      draw() {
        this.particles.forEach(p => {
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.shadowBlur = 10;
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
      ctx.fillStyle = 'rgba(22, 33, 62, 0.2)';
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
        <div><strong>访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>最近访客IP:</strong></div>
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
    body { overflow: hidden; background: #0f0f23; position: relative; }
    canvas { display: block; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; }
    .controls { position: absolute; top: 20px; right: 20px; z-index: 100; }
    .controls button { margin: 5px; padding: 10px 20px; border: none; border-radius: 5px;
                       background: rgba(255,255,255,0.2); color: white; cursor: pointer;
                       font-size: 14px; }
    .controls button:hover { background: rgba(255,255,255,0.4); }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100; }
    .stats div { margin: 5px 0; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <div class="controls">
    <button onclick="mode='firework'">烟花模式</button>
    <button onclick="mode='fountain'">喷泉模式</button>
    <button onclick="mode='spiral'">螺旋模式</button>
    <button onclick="mode='rainbow'">彩虹模式</button>
    <button onclick="mode='explosion'">爆炸模式</button>
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
      ctx.fillStyle = 'rgba(15, 15, 35, 0.15)';
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
        <div><strong>访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>最近访客IP:</strong></div>
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
            font-size: 24px; z-index: 100; }
    .controls { position: absolute; top: 20px; right: 20px; z-index: 100; }
    .controls button { margin: 5px; padding: 10px 20px; border: none; border-radius: 5px;
                       background: rgba(255,255,255,0.2); color: white; cursor: pointer; }
    .controls button:hover { background: rgba(255,255,255,0.4); }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100; }
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
        <div><strong>访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>最近访客IP:</strong></div>
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
            font-size: 24px; z-index: 100; }
    .controls { position: absolute; top: 20px; right: 20px; z-index: 100; }
    .controls button { margin: 5px; padding: 10px 20px; border: none; border-radius: 5px;
                       background: rgba(255,255,255,0.2); color: white; cursor: pointer; }
    .controls button:hover { background: rgba(255,255,255,0.4); }
    .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0; width: 100vw; height: 100vh; }
    .cell { transition: background-color 0.5s ease; }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100; }
    .stats div { margin: 5px 0; }
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
        <div><strong>访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>最近访客IP:</strong></div>
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
    body { overflow: hidden; background: #0a0a0a; position: relative; }
    #container { width: 100vw; height: 100vh; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; }
    .controls { position: absolute; top: 20px; right: 20px; z-index: 100; }
    .controls button { margin: 5px; padding: 10px 20px; border: none; border-radius: 5px;
                       background: rgba(0,150,255,0.6); color: white; cursor: pointer;
                       box-shadow: 0 0 20px rgba(0,150,255,0.5); font-size: 14px; }
    .controls button:hover { background: rgba(0,150,255,0.8); box-shadow: 0 0 30px rgba(0,150,255,0.8); }
    .controls a { color: white; text-decoration: none; padding: 10px 20px; display: inline-block;
                  background: rgba(255,255,255,0.1); border-radius: 5px; margin: 5px; }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100;
             box-shadow: 0 0 20px rgba(0,150,255,0.3); }
    .stats div { margin: 5px 0; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <div class="controls">
    <div><a href="/cube3">3×3</a><a href="/cube4">4×4</a><a href="/cube5">5×5</a></div>
    <button onclick="scrambleCube()">打乱</button>
    <button onclick="solveCube()">复原</button>
  </div>
  <div id="container"></div>
  <div class="stats" id="stats">加载中...</div>
  <script>${getParticleBackgroundScript()}</script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    let scene, camera, renderer, rubikGroup, cubelets = [];
    let isDragging = false, previousMouse = { x: 0, y: 0 };
    const SIZE = ${size};
    const GAP = 0.05;
    const cubeState = [];

    function init() {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = ${cameraZ};

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      document.getElementById('container').appendChild(renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0x404040, 1);
      scene.add(ambientLight);

      const light1 = new THREE.PointLight(0x0096ff, 2, 100);
      light1.position.set(5, 5, 5);
      light1.castShadow = true;
      scene.add(light1);

      const light2 = new THREE.PointLight(0x00ffff, 1.5, 100);
      light2.position.set(-5, -5, 5);
      scene.add(light2);

      const light3 = new THREE.PointLight(0x0066ff, 1, 100);
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
      const colors = [
        0xff0000, // Red
        0x00ff00, // Green
        0x0000ff, // Blue
        0xffff00, // Yellow
        0xffffff, // White
        0xff8800  // Orange
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
                emissiveIntensity: 0.15
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
              initPos: { x: cube.position.x, y: cube.position.y, z: cube.position.z },
              initRot: { x: 0, y: 0, z: 0 }
            };

            rubikGroup.add(cube);
            cubelets.push(cube);
            cubeState.push({ x, y, z, rotX: 0, rotY: 0, rotZ: 0 });
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

    function scrambleCube() {
      const moves = 20;
      let currentRotation = { x: 0, y: 0, z: 0 };

      for (let i = 0; i < moves; i++) {
        const axis = Math.floor(Math.random() * 3);
        const layer = Math.floor(Math.random() * SIZE);
        const direction = Math.random() < 0.5 ? 1 : -1;
        const angle = (Math.PI / 2) * direction;

        cubelets.forEach((cube, idx) => {
          let shouldRotate = false;
          const state = cubeState[idx];

          if (axis === 0 && Math.abs(state.x - layer) < 0.1) shouldRotate = true;
          if (axis === 1 && Math.abs(state.y - layer) < 0.1) shouldRotate = true;
          if (axis === 2 && Math.abs(state.z - layer) < 0.1) shouldRotate = true;

          if (shouldRotate) {
            if (axis === 0) {
              cube.rotation.x += angle;
              state.rotX += angle;
              const oldY = state.y;
              state.y = SIZE - 1 - state.z;
              state.z = oldY;
            } else if (axis === 1) {
              cube.rotation.y += angle;
              state.rotY += angle;
              const oldX = state.x;
              state.x = state.z;
              state.z = SIZE - 1 - oldX;
            } else {
              cube.rotation.z += angle;
              state.rotZ += angle;
              const oldX = state.x;
              state.x = SIZE - 1 - state.y;
              state.y = oldX;
            }
          }
        });
      }
    }

    function solveCube() {
      cubelets.forEach((cube, idx) => {
        cube.rotation.set(0, 0, 0);
        cube.position.copy(cube.userData.initPos);
        cubeState[idx] = {
          x: Math.round((cube.position.x / (1 + GAP)) + SIZE / 2 - 0.5),
          y: Math.round((cube.position.y / (1 + GAP)) + SIZE / 2 - 0.5),
          z: Math.round((cube.position.z / (1 + GAP)) + SIZE / 2 - 0.5),
          rotX: 0,
          rotY: 0,
          rotZ: 0
        };
      });
    }

    function animate() {
      requestAnimationFrame(animate);
      if (!isDragging) {
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
        <div><strong>访客统计</strong></div>
        <div>总访客: \${data.visitors}</div>
        <div>总访问: \${data.visits}</div>
        <div style="margin-top:8px"><strong>最近访客IP:</strong></div>
        \${data.ips.map(v => \`<div>• \${v.ip} (访问\${v.count}次)</div>\`).join('')}
      \`;
    });
  </script>
</body>
</html>`;
}
