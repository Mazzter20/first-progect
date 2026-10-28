// Колесо, рулетка дотику, релакс-масаж та «Бажання».

const COLORS = ['#ff3d7f', '#a64dff', '#ff8a3d', '#3d8bff', '#e53dff', '#6b1fd1', '#c4245e', '#3ddc97'];

// ----- Колесо -----

function wheel() {
  const items = DATA.wheel[state.level];
  const size = 600;
  const seg = (2 * Math.PI) / items.length;
  let angle = 0;
  let spinning = false;

  render(`
    ${header('Колесо')}
    ${levelChips()}
    <div class="wheel-wrap">
      <canvas id="wheel" width="${size}" height="${size}"></canvas>
      <div class="pointer">▼</div>
    </div>
    <div class="card small">
      <div class="tag">🎡 Хід: ${esc(me())}</div>
      <div class="text" id="wtext">Крути колесо!</div>
    </div>
    <button class="btn primary" id="spin">Крутити</button>
  `);
  bindCommon(wheel);

  const ctx = $('#wheel').getContext('2d');
  let frame = null;
  onLeave(() => cancelAnimationFrame(frame));

  function draw() {
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(angle);
    items.forEach((item, i) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, c - 8, i * seg, (i + 1) * seg);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.save();
      ctx.rotate(i * seg + seg / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = '800 30px -apple-system, system-ui, sans-serif';
      const label = plain(item.t);
      const width = ctx.measureText(label).width;
      if (width > 190) ctx.font = `800 ${Math.floor(30 * 190 / width)}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(label, c - 30, 0);
      ctx.restore();
    });
    ctx.restore();

    ctx.beginPath();
    ctx.arc(c, c, 48, 0, 2 * Math.PI);
    ctx.fillStyle = '#14061f';
    ctx.fill();
    ctx.font = '44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(LEVELS[state.level].emoji, c, c + 2);
  }

  // Сектор під стрілкою, яка дивиться вгору (кут -π/2).
  function current() {
    const a = ((-Math.PI / 2 - angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    return items[Math.floor(a / seg)];
  }

  draw();

  on('#spin', (e) => {
    if (spinning) return;
    spinning = true;
    const btn = e.currentTarget;
    btn.disabled = true;
    app.querySelector('.tag').innerHTML = `🎡 Хід: ${esc(me())}`;
    $('#wtext').textContent = '…';

    const start = angle;
    const target = angle + 2 * Math.PI * (5 + Math.random() * 2);
    const duration = 4000;
    const t0 = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      angle = start + (target - start) * (1 - Math.pow(1 - t, 3));
      draw();
      if (t < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      spinning = false;
      $('#wtext').innerHTML = `<b>${esc(plain(current().t))}</b><br>${fill(current().d)}`;
      if (navigator.vibrate) navigator.vibrate(80);
      nextTurn();
      btn.disabled = false;
      btn.textContent = `Хід: ${me()} — крутити`;
    };
    frame = requestAnimationFrame(tick);
  });
}

// ----- Рулетка дотику -----

function roulette() {
  render(`
    ${header('Рулетка дотику')}
    <div class="touch-area" id="area">
      <p class="touch-hint" id="hint">Покладіть по пальцю на екран і тримайте</p>
    </div>
    <div id="chosen"></div>
    <button class="btn ghost" id="randomPick">Обрати без пальців</button>
  `);
  on('[data-back]', home);

  const area = $('#area');
  const hint = $('#hint');
  const fingers = new Map();
  let waitId = null;
  let done = false;
  onLeave(() => clearTimeout(waitId));

  function place(el, e) {
    const r = area.getBoundingClientRect();
    el.style.left = `${e.clientX - r.left}px`;
    el.style.top = `${e.clientY - r.top}px`;
  }

  function arm() {
    clearTimeout(waitId);
    if (done) return;
    if (fingers.size >= 2) {
      hint.textContent = 'Тримайте…';
      waitId = setTimeout(choose, 2000);
    } else {
      hint.textContent = fingers.size === 1 ? 'Потрібен ще один палець' : 'Покладіть по пальцю на екран і тримайте';
    }
  }

  function ask() {
    $('#chosen').innerHTML = `
      <div class="card small">
        <div class="tag">🎯 Обраний палець — чий він?</div>
        <div class="row">${state.names.map((n, i) => `<button class="btn" data-who="${i}">${esc(n)}</button>`).join('')}</div>
      </div>`;
    on('[data-who]', (e) => {
      state.turn = Number(e.currentTarget.dataset.who);
      todCard(pick(['truth', 'dare']), roulette);
    });
    $('#randomPick').hidden = true;
  }

  function choose() {
    done = true;
    const ids = [...fingers.keys()];
    const winner = pick(ids);
    fingers.forEach((el, id) => el.classList.add(id === winner ? 'chosen' : 'lost'));
    hint.textContent = '';
    if (navigator.vibrate) navigator.vibrate(200);
    ask();
  }

  area.addEventListener('pointerdown', (e) => {
    if (done) return;
    e.preventDefault();
    const el = document.createElement('div');
    el.className = 'finger';
    el.style.borderColor = COLORS[fingers.size % COLORS.length];
    place(el, e);
    area.appendChild(el);
    fingers.set(e.pointerId, el);
    arm();
  });
  area.addEventListener('pointermove', (e) => {
    const el = fingers.get(e.pointerId);
    if (el && !done) place(el, e);
  });
  const lift = (e) => {
    if (done || !fingers.has(e.pointerId)) return;
    fingers.get(e.pointerId).remove();
    fingers.delete(e.pointerId);
    arm();
  };
  area.addEventListener('pointerup', lift);
  area.addEventListener('pointercancel', lift);
  area.addEventListener('contextmenu', (e) => e.preventDefault());

  on('#randomPick', () => {
    state.turn = Math.floor(Math.random() * 2);
    todCard(pick(['truth', 'dare']), roulette);
  });
}

// ----- Релакс-масаж -----

// Тихий «ембієнт» із кількох синусоїд з повільною пульсацією гучності.
function startCalmSound() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  [[110, 0.07], [164.8, 0.05], [220, 0.025]].forEach(([freq, vol]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(master);
    osc.start();
  });
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = 0.12;
  depth.gain.value = 0.12;
  lfo.connect(depth).connect(master.gain);
  lfo.start();
  master.gain.setTargetAtTime(0.3, ctx.currentTime, 1.5);
  return ctx;
}

function massage() {
  const steps = DATA.massage;
  let step = 0;
  let left = steps[0].sec;
  let running = false;
  let sound = null;

  render(`
    ${header('Релакс-масаж')}
    <div class="card">
      <div class="tag" id="mstep"></div>
      <div class="text" id="mzone"></div>
      <div class="who" id="mhow"></div>
      <div class="timer" id="mtime"></div>
      <div class="progress"><i id="mbar"></i></div>
    </div>
    <div class="row">
      <button class="btn ghost" id="mprev" aria-label="Попередній крок">‹</button>
      <button class="btn primary" id="mplay">▶ Старт</button>
      <button class="btn ghost" id="mnext" aria-label="Наступний крок">›</button>
    </div>
    <button class="btn ghost" id="msound">🎵 Спокійний звук: вимкнено</button>
    <div class="note">
      ${esc(me())} робить масаж для ${esc(partner())}. Тисни м’яко й питай, як приємніше.
      Теплі руки та трохи олії чи крему зроблять усе ще краще.
    </div>
  `);
  on('[data-back]', home);

  const stopSound = () => {
    if (sound) sound.close();
    sound = null;
  };

  function show() {
    const s = steps[step];
    $('#mstep').textContent = `Крок ${step + 1} з ${steps.length}`;
    $('#mzone').textContent = s.zone;
    $('#mhow').textContent = s.how;
    $('#mtime').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $('#mbar').style.width = `${((step + 1 - left / s.sec) / steps.length) * 100}%`;
    $('#mplay').textContent = running ? '⏸ Пауза' : '▶ Старт';
  }

  function go(to) {
    if (to >= steps.length) {
      running = false;
      step = steps.length - 1;
      left = 0;
      show();
      $('#mzone').textContent = 'Готово 💞';
      $('#mhow').textContent = `Тепер поміняйтеся: ${partner()} робить масаж для ${me()}.`;
      return;
    }
    step = Math.max(0, to);
    left = steps[step].sec;
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    show();
  }

  const tick = setInterval(() => {
    if (!running) return;
    left -= 1;
    if (left <= 0) go(step + 1);
    else show();
  }, 1000);
  onLeave(() => {
    clearInterval(tick);
    stopSound();
  });

  on('#mplay', () => {
    if (left <= 0) go(0);
    running = !running;
    show();
  });
  on('#mprev', () => go(step - 1));
  on('#mnext', () => go(step + 1));
  on('#msound', (e) => {
    if (sound) stopSound();
    else sound = startCalmSound();
    e.currentTarget.textContent = `🎵 Спокійний звук: ${sound ? 'увімкнено' : 'вимкнено'}`;
  });

  show();
}

// ----- Бажання -----

function desires() {
  const deck = shuffle(DATA.desires[state.level]).slice(0, 12);
  const answers = [[], []]; // 2 — так, 1 — можливо, 0 — ні
  let player = 0;
  let idx = 0;

  function answer(value) {
    answers[player][idx] = value;
    idx += 1;
    if (idx < deck.length) return card();
    if (player === 0) {
      player = 1;
      idx = 0;
      return handoff();
    }
    return results();
  }

  function card() {
    render(`
      ${header('Бажання')}
      <div class="score"><div class="turn">${esc(state.names[player])}<span>${idx + 1} / ${deck.length}</span></div></div>
      <div class="card swipe" id="dcard">
        <div class="tag">${LEVELS[state.level].emoji} Чи хочеш ти…</div>
        <div class="text">${esc(deck[idx])}</div>
        <div class="who">Гортай вправо — так, вліво — ні</div>
      </div>
      <div class="row">
        <button class="btn ghost" data-ans="0">✖ Ні</button>
        <button class="btn" data-ans="1">🤔 Можливо</button>
        <button class="btn yes" data-ans="2">❤️ Так</button>
      </div>
    `);
    on('[data-back]', home);
    on('[data-ans]', (e) => answer(Number(e.currentTarget.dataset.ans)));

    const el = $('#dcard');
    let startX = null;
    el.addEventListener('pointerdown', (e) => { startX = e.clientX; });
    el.addEventListener('pointermove', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      el.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
    });
    const release = (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (dx > 90) return answer(2);
      if (dx < -90) return answer(0);
      el.style.transform = '';
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', () => { startX = null; el.style.transform = ''; });
  }

  function handoff() {
    render(`
      ${header('Бажання')}
      <div class="card">
        <div class="tag">🤫 Не підглядай</div>
        <div class="text">Готово, ${esc(state.names[0])}!<br>Передай телефон: ${esc(state.names[1])}</div>
        <div class="who">Ваші відповіді побачите разом наприкінці — лише ті, де ви збіглися</div>
      </div>
      <button class="btn primary" id="go">Я ${esc(state.names[1])}, почати</button>
    `);
    on('[data-back]', home);
    on('#go', card);
  }

  function results() {
    const both = [];
    const talk = [];
    deck.forEach((text, i) => {
      const [a, b] = [answers[0][i], answers[1][i]];
      if (a === 2 && b === 2) both.push(text);
      else if (a > 0 && b > 0) talk.push(text);
    });
    const list = (items) => items.map((t) => `<div class="match">${esc(t)}</div>`).join('');

    render(`
      ${header('Ваші збіги')}
      <div class="score"><div>Обоє хочете<span>${both.length}</span></div><div>Варто обговорити<span>${talk.length}</span></div></div>
      ${both.length ? `<h2>❤️ Ви обоє хочете</h2><div class="match-list">${list(both)}</div>` : ''}
      ${talk.length ? `<h2>🤔 Варто обговорити</h2><div class="match-list">${list(talk)}</div>` : ''}
      ${both.length + talk.length === 0 ? '<div class="card small"><div class="text">Цього разу збігів немає. Спробуйте ще раз або інший рівень 😉</div></div>' : ''}
      <div class="row">
        <button class="btn ghost" data-back>На головну</button>
        <button class="btn primary" id="again">Зіграти ще</button>
      </div>
    `);
    on('[data-back]', home);
    on('#again', desires);
  }

  card();
}

Object.assign(GAMES, { wheel, roulette, massage, desires });
