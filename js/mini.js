// Міні-ігри на одному телефоні: гравець 1 знизу, гравець 2 зверху.

// Малює заголовок і полотно на весь залишок екрана. Повертає контекст у CSS-пікселях.
function makeArena(title) {
  render(`
    <div class="top">
      <button class="icon-btn" data-back aria-label="Назад">‹</button>
      <h2>${title}</h2>
      <span style="width:44px"></span>
    </div>
    <canvas id="arena" class="arena"></canvas>
  `);
  on('[data-back]', home);

  const cv = $('#arena');
  const W = cv.clientWidth;
  const H = Math.max(420, Math.floor(window.innerHeight - cv.getBoundingClientRect().top - 24));
  const dpr = window.devicePixelRatio || 1;
  cv.style.height = `${H}px`;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  return { cv, ctx, W, H, pos };
}

// Запускає цикл анімації з кроком у секундах; зупиняється, коли гравці йдуть з екрана.
function loop(step) {
  let frame = null;
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    step(dt);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  onLeave(() => cancelAnimationFrame(frame));
}

// Пише текст «обличчям» до гравця: для верхнього — догори дриґом.
function sideText(ctx, W, H, top, text, x, y, font, color) {
  ctx.save();
  if (top) {
    ctx.translate(W, H);
    ctx.rotate(Math.PI);
  }
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

const PLAYER_COLORS = ['#e53dff', '#c8ff3d'];
const FONT = '-apple-system, system-ui, sans-serif';

// ----- Аерохокей -----

function hockey() {
  const { cv, ctx, W, H, pos } = makeArena('Аерохокей');
  const R = Math.min(W, H) * 0.075;
  const r = R * 0.62;
  const goalW = W * 0.42;
  const maxSpeed = H * 2.4;
  const WIN = 7;
  const score = [0, 0];
  let winner = -1;

  const paddles = [
    { x: W / 2, y: H - R * 2, tx: W / 2, ty: H - R * 2, vx: 0, vy: 0 },
    { x: W / 2, y: R * 2, tx: W / 2, ty: R * 2, vx: 0, vy: 0 },
  ];
  const puck = { x: W / 2, y: H / 2, vx: 0, vy: 0 };

  // Шайба з'являється на боці того, хто пропустив гол.
  function serve(toward) {
    puck.x = W / 2;
    puck.y = toward === 0 ? H * 0.62 : H * 0.38;
    puck.vx = 0;
    puck.vy = 0;
  }
  serve(Math.random() < 0.5 ? 0 : 1);

  const owners = new Map();
  function aim(i, p) {
    const pad = paddles[i];
    pad.tx = Math.min(W - R, Math.max(R, p.x));
    pad.ty = i === 0
      ? Math.min(H - R, Math.max(H / 2 + R, p.y))
      : Math.min(H / 2 - R, Math.max(R, p.y));
  }

  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (winner >= 0) {
      score[0] = 0;
      score[1] = 0;
      winner = -1;
      serve(Math.random() < 0.5 ? 0 : 1);
      return;
    }
    const p = pos(e);
    const i = p.y > H / 2 ? 0 : 1;
    owners.set(e.pointerId, i);
    aim(i, p);
  });
  cv.addEventListener('pointermove', (e) => {
    if (owners.has(e.pointerId)) aim(owners.get(e.pointerId), pos(e));
  });
  const release = (e) => owners.delete(e.pointerId);
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);

  function goal(scorer) {
    score[scorer] += 1;
    if (navigator.vibrate) navigator.vibrate(150);
    if (score[scorer] >= WIN) winner = scorer;
    serve(1 - scorer);
  }

  function physics(dt) {
    paddles.forEach((p) => {
      p.vx = (p.tx - p.x) / dt;
      p.vy = (p.ty - p.y) / dt;
      p.x = p.tx;
      p.y = p.ty;
    });

    const sub = 4;
    for (let k = 0; k < sub; k++) {
      puck.x += (puck.vx * dt) / sub;
      puck.y += (puck.vy * dt) / sub;

      if (puck.x < r) { puck.x = r; puck.vx = Math.abs(puck.vx); }
      if (puck.x > W - r) { puck.x = W - r; puck.vx = -Math.abs(puck.vx); }

      const inGoal = Math.abs(puck.x - W / 2) < goalW / 2 - r;
      if (puck.y < r && !inGoal) { puck.y = r; puck.vy = Math.abs(puck.vy); }
      if (puck.y > H - r && !inGoal) { puck.y = H - r; puck.vy = -Math.abs(puck.vy); }
      if (puck.y < -r) return goal(0);
      if (puck.y > H + r) return goal(1);

      paddles.forEach((p) => {
        const dx = puck.x - p.x;
        const dy = puck.y - p.y;
        const d = Math.hypot(dx, dy);
        const min = R + r;
        if (d >= min || d === 0) return;
        const nx = dx / d;
        const ny = dy / d;
        puck.x = p.x + nx * min;
        puck.y = p.y + ny * min;
        const dot = (puck.vx - p.vx) * nx + (puck.vy - p.vy) * ny;
        if (dot < 0) {
          puck.vx -= 1.9 * dot * nx;
          puck.vy -= 1.9 * dot * ny;
        }
      });
    }

    const friction = Math.pow(0.992, dt * 60);
    puck.vx *= friction;
    puck.vy *= friction;
    const speed = Math.hypot(puck.vx, puck.vy);
    if (speed > maxSpeed) {
      puck.vx *= maxSpeed / speed;
      puck.vy *= maxSpeed / speed;
    }
  }

  function circle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function draw() {
    ctx.fillStyle = '#1b0a35';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W * 0.16, 0, 2 * Math.PI);
    ctx.stroke();

    // Ворота: колір того, хто їх захищає.
    ctx.fillStyle = PLAYER_COLORS[1];
    ctx.fillRect(W / 2 - goalW / 2, 0, goalW, 6);
    ctx.fillStyle = PLAYER_COLORS[0];
    ctx.fillRect(W / 2 - goalW / 2, H - 6, goalW, 6);

    [0, 1].forEach((i) => {
      const top = i === 1;
      sideText(ctx, W, H, top, String(score[i]), W - 34, H / 2 + 40, `900 40px ${FONT}`, PLAYER_COLORS[i]);
      sideText(ctx, W, H, top, state.names[i], 70, H / 2 + 28, `700 15px ${FONT}`, 'rgba(255,255,255,.6)');
    });

    paddles.forEach((p, i) => {
      circle(p.x, p.y, R, PLAYER_COLORS[i]);
      circle(p.x, p.y, R * 0.45, 'rgba(0,0,0,.25)');
    });
    circle(puck.x, puck.y, r, '#ffffff');

    if (winner >= 0) {
      ctx.fillStyle = 'rgba(10,3,20,.75)';
      ctx.fillRect(0, 0, W, H);
      [0, 1].forEach((i) => {
        const top = i === 1;
        const text = i === winner ? '🏆 Перемога!' : 'Цього разу ні 😏';
        sideText(ctx, W, H, top, text, W / 2, H * 0.72, `900 30px ${FONT}`, PLAYER_COLORS[i]);
        sideText(ctx, W, H, top, 'Торкніться, щоб зіграти ще', W / 2, H * 0.8, `600 16px ${FONT}`, '#fff');
      });
      sideText(ctx, W, H, false, 'Переможець обирає завдання для іншого', W / 2, H / 2, `700 15px ${FONT}`, '#ffd23f');
    }
  }

  loop((dt) => {
    if (winner < 0) physics(dt);
    draw();
  });
}

// ----- Щасливі бегемоти -----

function hippos() {
  const { cv, ctx, W, H, pos } = makeArena('Щасливі бегемоти');
  const TOTAL = 21;
  const br = Math.max(8, Math.min(W, H) * 0.028);
  const head = H * 0.13; // висота голови біля краю екрана
  const reach = H * 0.24; // наскільки далеко висувається паща
  const mouthW = W * 0.4;
  const ballColors = ['#ffd23f', '#3ddc97', '#3d8bff', '#ff8a3d', '#ffffff'];
  let balls = [];
  let hippoState;

  function reset() {
    balls = Array.from({ length: TOTAL }, () => {
      const a = Math.random() * 2 * Math.PI;
      const speed = H * (0.25 + Math.random() * 0.25);
      return {
        x: br + Math.random() * (W - 2 * br),
        y: H / 2 + (Math.random() - 0.5) * H * 0.3,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        color: pick(ballColors),
      };
    });
    hippoState = [0, 1].map(() => ({ t: -1, score: 0 }));
  }
  reset();

  const over = () => balls.length === 0;

  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (over()) return reset();
    const i = pos(e).y > H / 2 ? 0 : 1;
    if (hippoState[i].t < 0) hippoState[i].t = 0;
  });

  // Наскільки висунута паща: 0 — сховалася, 1 — максимально.
  function extension(t) {
    if (t < 0) return 0;
    if (t < 0.14) return t / 0.14;
    if (t < 0.3) return 1 - (t - 0.14) / 0.16;
    return 0;
  }

  // Прямокутник пащі для гравця i у координатах екрана.
  function mouthRect(i, ext) {
    const depth = ext * reach;
    const x = W / 2 - mouthW / 2;
    return i === 0
      ? { x, y: H - head - depth, w: mouthW, h: depth }
      : { x, y: head, w: mouthW, h: depth };
  }

  function update(dt) {
    hippoState.forEach((h, i) => {
      if (h.t < 0) return;
      h.t += dt;
      const ext = extension(h.t);
      if (h.t < 0.2 && ext > 0.2) {
        const m = mouthRect(i, ext);
        balls = balls.filter((b) => {
          const eaten = b.x > m.x && b.x < m.x + m.w && b.y > m.y - br && b.y < m.y + m.h + br;
          if (eaten) h.score += 1;
          return !eaten;
        });
      }
      if (h.t > 0.45) h.t = -1;
    });

    balls.forEach((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < br) { b.x = br; b.vx = Math.abs(b.vx); }
      if (b.x > W - br) { b.x = W - br; b.vx = -Math.abs(b.vx); }
      if (b.y < head + br) { b.y = head + br; b.vy = Math.abs(b.vy); }
      if (b.y > H - head - br) { b.y = H - head - br; b.vy = -Math.abs(b.vy); }
      // Легке «тремтіння», щоб кульки не ходили по одних і тих самих траєкторіях.
      b.vx += (Math.random() - 0.5) * H * 0.4 * dt;
      b.vy += (Math.random() - 0.5) * H * 0.4 * dt;
    });
  }

  // Малює бегемота знизу екрана; для верхнього гравця полотно повернуте на 180°.
  function drawHippo(i) {
    const color = PLAYER_COLORS[i];
    const ext = extension(hippoState[i].t);
    ctx.save();
    if (i === 1) {
      ctx.translate(W, H);
      ctx.rotate(Math.PI);
    }
    const depth = ext * reach;
    const neckTop = H - head - depth;

    // Шия та паща.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(W / 2 - mouthW / 2, neckTop - 6, mouthW, depth + head, 22);
    ctx.fill();
    ctx.fillStyle = '#2a0b2e';
    ctx.beginPath();
    ctx.roundRect(W / 2 - mouthW / 2 + 10, neckTop + 4, mouthW - 20, Math.max(0, depth * 0.6), 14);
    ctx.fill();

    // Голова біля краю.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(W / 2, H - head * 0.35, mouthW * 0.62, head * 0.75, 0, 0, 2 * Math.PI);
    ctx.fill();
    [-1, 1].forEach((side) => {
      const ex = W / 2 + side * mouthW * 0.32;
      const ey = H - head * 0.55;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, ey, head * 0.18, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#14061f';
      ctx.beginPath();
      ctx.arc(ex, ey - head * 0.04, head * 0.08, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(W / 2 + side * mouthW * 0.12, neckTop + 2, head * 0.06, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fill();
    });
    ctx.restore();

    const top = i === 1;
    sideText(ctx, W, H, top, String(hippoState[i].score), W - 30, H - head * 0.5, `900 34px ${FONT}`, color);
    sideText(ctx, W, H, top, state.names[i], 56, H - head * 0.5, `700 15px ${FONT}`, '#fff');
  }

  function draw() {
    ctx.fillStyle = '#2a0b3d';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fillRect(0, head, W, H - 2 * head);

    balls.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, br, 0, 2 * Math.PI);
      ctx.fillStyle = b.color;
      ctx.fill();
    });
    drawHippo(0);
    drawHippo(1);

    if (balls.length === TOTAL && hippoState.every((h) => h.score === 0)) {
      [false, true].forEach((top) => sideText(
        ctx, W, H, top, 'Тапай свою половину екрана!', W / 2, H * 0.62, `700 16px ${FONT}`, 'rgba(255,255,255,.75)',
      ));
    }

    if (over()) {
      const [a, b] = hippoState.map((h) => h.score);
      ctx.fillStyle = 'rgba(10,3,20,.75)';
      ctx.fillRect(0, 0, W, H);
      [0, 1].forEach((i) => {
        const mine = hippoState[i].score;
        const other = hippoState[1 - i].score;
        const text = a === b ? 'Нічия! 🤝' : mine > other ? '🏆 Найситніший!' : 'Голодний 😢';
        sideText(ctx, W, H, i === 1, text, W / 2, H * 0.7, `900 28px ${FONT}`, PLAYER_COLORS[i]);
        sideText(ctx, W, H, i === 1, 'Торкніться, щоб зіграти ще', W / 2, H * 0.78, `600 16px ${FONT}`, '#fff');
      });
    }
  }

  loop((dt) => {
    if (!over()) update(dt);
    draw();
  });
}

Object.assign(GAMES, { hockey, hippos });
