export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 访客统计
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const fingerprint = await generateFingerprint(clientIP, userAgent);

    // 记录访问
    await trackVisitor(env, clientIP, fingerprint, userAgent);

    // 路由
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
    await env.VISITORS.put('total_visitors', ((await env.VISITORS.get('total_visitors')) || 0) + 1);
  } else {
    const data = JSON.parse(existing);
    data.count++;
    data.last = Date.now();
    await env.VISITORS.put(key, JSON.stringify(data));
  }

  await env.VISITORS.put('total_visits', ((await env.VISITORS.get('total_visits')) || 0) + 1);
}

async function getStats(env) {
  if (!env.VISITORS) return { visitors: 0, visits: 0, ips: [] };

  const visitors = parseInt((await env.VISITORS.get('total_visitors')) || '0');
  const visits = parseInt((await env.VISITORS.get('total_visits')) || '0');

  const list = await env.VISITORS.list();
  const ips = [];
  for (const key of list.keys) {
    if (key.name.startsWith('visitor:')) {
      const data = JSON.parse(await env.VISITORS.get(key.name));
      ips.push({ ip: data.ip, ua: data.ua.substring(0, 50), count: data.count });
    }
  }

  return { visitors, visits, ips: ips.slice(0, 10) };
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
    }
    .container {
      max-width: 900px;
      width: 100%;
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
    }
    .card:hover {
      transform: translateY(-10px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
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
    body { overflow: hidden; background: #1a1a2e; }
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
        this.vx += dx * 0.02;
        this.vy += dy * 0.02;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.x += this.vx;
        this.y += this.vy;
      }
    }

    const points = [];
    const gridSize = 30;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 150;

    for (let i = 0; i < 360; i += 10) {
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
    });
    canvas.addEventListener('touchend', () => mouseDown = false);

    function animate() {
      ctx.fillStyle = 'rgba(26, 26, 46, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      points.forEach((p, i) => {
        if (mouseDown) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            const force = (100 - dist) / 100;
            p.x += dx * force * 0.1;
            p.y += dy * force * 0.1;
          }
        }
        p.update();
      });

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const xc = (points[i].x + points[i - 1].x) / 2;
        const yc = (points[i].y + points[i - 1].y) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
      }
      ctx.closePath();
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, '#00f2ff');
      gradient.addColorStop(1, '#ff00ea');
      ctx.fillStyle = gradient;
      ctx.fill();

      requestAnimationFrame(animate);
    }
    animate();

    // 访客统计
    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div>访客数: \${data.visitors}</div>
        <div>访问数: \${data.visits}</div>
        <div>最近访客:</div>
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
    body { overflow: hidden; background: #16213e; }
    canvas { display: block; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <canvas id="canvas"></canvas>
  <div class="stats" id="stats">加载中...</div>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const balls = [];
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
        this.damping = 0.95;
      }
      update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
          this.vx *= -this.damping;
          this.x = this.x + this.radius > canvas.width ? canvas.width - this.radius : this.radius;
          playSound();
        }
        if (this.y + this.radius > canvas.height || this.y - this.radius < 0) {
          this.vy *= -this.damping;
          this.y = this.y + this.radius > canvas.height ? canvas.height - this.radius : this.radius;
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
      requestAnimationFrame(animate);
    }
    animate();

    fetch('/api/stats').then(r => r.json()).then(data => {
      document.getElementById('stats').innerHTML = \`
        <div>访客数: \${data.visitors}</div>
        <div>访问数: \${data.visits}</div>
        <div>最近访客:</div>
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
    body { overflow: hidden; background: #0f0f23; }
    canvas { display: block; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100; }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <canvas id="canvas"></canvas>
  <div class="stats" id="stats">加载中...</div>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];

    class Particle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 10;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 5;
        this.radius = 2 + Math.random() * 4;
        this.life = 1;
        this.decay = 0.005 + Math.random() * 0.01;
        this.hue = Math.random() * 360;
      }
      update() {
        this.vy += 0.3;
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.vx *= 0.99;
      }
      draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.shadowBlur = 10;
        ctx.shadowColor = \`hsl(\${this.hue}, 100%, 50%)\`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = \`hsl(\${this.hue}, 100%, 50%)\`;
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
    });
    canvas.addEventListener('touchend', () => mouseDown = false);

    function animate() {
      ctx.fillStyle = 'rgba(15, 15, 35, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (mouseDown) {
        for (let i = 0; i < 5; i++) {
          particles.push(new Particle(mouseX, mouseY));
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
        <div>访客数: \${data.visitors}</div>
        <div>访问数: \${data.visits}</div>
        <div>最近访客:</div>
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
    body { overflow: hidden; background: #000; }
    canvas { display: block; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; }
    .controls { position: absolute; top: 20px; right: 20px; z-index: 100; }
    .controls button { margin: 5px; padding: 10px 20px; border: none; border-radius: 5px;
                       background: rgba(255,255,255,0.2); color: white; cursor: pointer; }
    .controls button:hover { background: rgba(255,255,255,0.4); }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100; }
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
        <div>访客数: \${data.visitors}</div>
        <div>访问数: \${data.visits}</div>
        <div>最近访客:</div>
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
    body { overflow: hidden; background: #000; }
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
        <div>访客数: \${data.visitors}</div>
        <div>访问数: \${data.visits}</div>
        <div>最近访客:</div>
        \${data.ips.map(v => \`<div>• \${v.ip} (访问\${v.count}次)</div>\`).join('')}
      \`;
    });
  </script>
</body>
</html>`;
}

function getCube3HTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>魔方模拟器 3×3</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #0a0a0a; }
    canvas { display: block; }
    .back { position: absolute; top: 20px; left: 20px; color: white; text-decoration: none;
            font-size: 24px; z-index: 100; }
    .controls { position: absolute; top: 20px; right: 20px; z-index: 100; }
    .controls button { margin: 5px; padding: 10px 20px; border: none; border-radius: 5px;
                       background: rgba(0,150,255,0.6); color: white; cursor: pointer;
                       box-shadow: 0 0 20px rgba(0,150,255,0.5); }
    .controls button:hover { background: rgba(0,150,255,0.8); box-shadow: 0 0 30px rgba(0,150,255,0.8); }
    .controls a { color: white; text-decoration: none; padding: 10px 20px; display: inline-block;
                  background: rgba(255,255,255,0.1); border-radius: 5px; margin: 5px; }
    .stats { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8);
             color: white; padding: 15px; border-radius: 10px; font-size: 12px; max-width: 300px; z-index: 100;
             box-shadow: 0 0 20px rgba(0,150,255,0.3); }
  </style>
</head>
<body>
  <a href="/" class="back">← 返回</a>
  <div class="controls">
    <div><a href="/cube3">3×3</a><a href="/cube4">4×4</a><a href="/cube5">5×5</a></div>
    <button onclick="scramble()">打乱</button>
    <button onclick="solve()">复原</button>
  </div>
  <div id="container"></div>
  <div class="stats" id="stats">加载中...</div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    let scene, camera, renderer, cubes = [], isDragging = false, previousMousePosition = { x: 0, y: 0 };
    const size = 3;

    function init() {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 8;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      document.getElementById('container').appendChild(renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0x404040, 2);
      scene.add(ambientLight);

      const pointLight = new THREE.PointLight(0x0096ff, 3, 100);
      pointLight.position.set(5, 5, 5);
      pointLight.castShadow = true;
      scene.add(pointLight);

      const pointLight2 = new THREE.PointLight(0x00ffff, 2, 100);
      pointLight2.position.set(-5, -5, 5);
      scene.add(pointLight2);

      createCube();

      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('mouseup', onMouseUp);

      animate();
    }

    function createCube() {
      const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xffffff, 0xff8800];
      const gap = 0.1;

      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          for (let z = 0; z < size; z++) {
            const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
            const materials = colors.map(color => {
              return new THREE.MeshPhongMaterial({
                color,
                shininess: 100,
                specular: 0x444444,
                emissive: color,
                emissiveIntensity: 0.2
              });
            });
            const cube = new THREE.Mesh(geometry, materials);
            cube.position.set(
              (x - size / 2 + 0.5) * (1 + gap),
              (y - size / 2 + 0.5) * (1 + gap),
              (z - size / 2 + 0.5) * (1 + gap)
            );
            cube.castShadow = true;
            cube.receiveShadow = true;
            scene.add(cube);
            cubes.push(cube);
          }
        }
      }
    }

    function onMouseDown(e) {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }

    function onMouseMove(e) {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      cubes.forEach(cube => {
        cube.rotation.y += deltaX * 0.01;
        cube.rotation.x += deltaY * 0.01;
      });
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }

    function onMouseUp() {
      isDragging = false;
    }

    function scramble() {
      cubes.forEach(cube => {
        cube.rotation.x = Math.random() * Math.PI;
        cube.rotation.y = Math.random() * Math.PI;
        cube.rotation.z = Math.random() * Math.PI;
      });
    }

    function solve() {
      cubes.forEach(cube => {
        cube.rotation.set(0, 0, 0);
      });
    }

    function animate() {
      requestAnimationFrame(animate);
      if (!isDragging) {
        cubes.forEach(cube => {
          cube.rotation.y += 0.002;
        });
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
        <div>访客数: \${data.visitors}</div>
        <div>访问数: \${data.visits}</div>
        <div>最近访客:</div>
        \${data.ips.map(v => \`<div>• \${v.ip} (访问\${v.count}次)</div>\`).join('')}
      \`;
    });
  </script>
</body>
</html>`;
}

function getCube4HTML() {
  return getCube3HTML().replace(/size = 3/g, 'size = 4').replace(/3×3/g, '4×4');
}

function getCube5HTML() {
  return getCube3HTML().replace(/size = 3/g, 'size = 5').replace(/3×3/g, '5×5').replace(/camera.position.z = 8/g, 'camera.position.z = 12');
}
