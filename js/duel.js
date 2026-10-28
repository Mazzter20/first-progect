// Фанти для того, хто програв, і міні-ігри «Хто швидший», «Перетягування», «Малюй і вгадуй».

// Через паузу (щоб гравці побачили результат) запускає наступний екран.
function afterWin(next) {
  const id = setTimeout(next, 1800);
  onLeave(() => clearTimeout(id));
}

// Фант за рахунком: програє той, у кого менше; за нічиєї вирішує жереб.
function forfeitBy(scores, onDone) {
  if (scores[0] === scores[1]) {
    return forfeit(Math.floor(Math.random() * 2), onDone, 'Нічия — тому фант обрав жереб.');
  }
  return forfeit(scores[0] < scores[1] ? 0 : 1, onDone);
}

// loser — індекс гравця, який виконує фант; onDone — куди повернутися після.
function forfeit(loser, onDone, note = '') {
  const winner = 1 - loser;
  const w = esc(state.names[winner]);
  const l = esc(state.names[loser]);

  function choose() {
    render(`
      ${header('Фант')}
      <div class="card">
        <div class="tag">🏆 Перемагає ${w}!</div>
        <div class="text">${l}, на тебе чекає фант 😏</div>
        <div class="who">${note ? `${esc(note)} ` : ''}${w}, обери: випадковий фант із гри чи власне бажання.</div>
      </div>
      ${levelChips()}
      <div class="row">
        <button class="btn primary" id="rand">🎲 Фант із гри</button>
        <button class="btn" id="own">✍️ Своє бажання</button>
      </div>
      <button class="btn ghost" id="noForfeit">Цього разу без фанту</button>
    `);
    bindCommon(choose);
    on('#rand', () => show(null));
    on('#own', own);
    on('#noForfeit', onDone);
  }

  function own() {
    render(`
      ${header('Своє бажання')}
      <form class="field" id="wishForm">
        <label for="wish">${w}, що має зробити ${l}?</label>
        <input id="wish" maxlength="200" autocomplete="off" placeholder="Напр.: Сніданок у ліжко завтра зранку">
        <p class="muted">Будь-яке бажання, на яке ви обоє погоджуєтеся.</p>
        <button class="btn primary" type="submit">Загадати</button>
      </form>
      <button class="btn ghost" id="backToChoice">‹ Назад до вибору</button>
    `);
    on('[data-back]', home);
    on('#backToChoice', choose);
    $('#wishForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = $('#wish').value.trim();
      if (text) show(text);
    });
    $('#wish').focus();
  }

  // text === null — випадковий фант із колоди, інакше бажання переможця.
  function show(text) {
    state.turn = loser;
    const random = text === null;
    render(`
      ${header('Фант')}
      <div class="card">
        <div class="tag">${random ? `🎲 Фант · ${LEVELS[state.level].emoji}` : '✍️ Бажання'} для ${l}</div>
        <div class="text">${random ? fill(draw('forfeit')) : esc(text)}</div>
        <div class="who">загадує ${w}</div>
        <div class="timer"></div>
        <button class="btn ghost" id="timer">⏱ Таймер 60 с</button>
      </div>
      <div class="row">
        ${random ? '<button class="btn ghost" id="another">🔄 Інший</button>' : ''}
        <button class="btn ok" id="forfeitDone">✅ Виконано</button>
      </div>
    `);
    on('[data-back]', home);
    on('#timer', () => startTimer(60));
    on('#another', () => show(null));
    on('#forfeitDone', onDone);
  }

  choose();
}

// Дві половини екрана: верхня повернута до гравця 2, нижня — до гравця 1.
function duelLayout(title) {
  render(`
    <div class="top">
      <button class="icon-btn" data-back aria-label="Назад">‹</button>
      <h2>${title}</h2>
      <span style="width:44px"></span>
    </div>
    <div class="duel">
      ${[1, 0].map((i) => `
        <div class="half ${i ? 'up' : 'down'}" data-half="${i}">
          <b>${esc(state.names[i])}</b>
          <span class="hscore"></span>
          <p class="hmsg"></p>
        </div>`).join('')}
    </div>
  `);
  on('[data-back]', home);
  return [$('[data-half="0"]'), $('[data-half="1"]')];
}

// ----- Хто швидший -----

function reaction() {
  const halves = duelLayout('Хто швидший');
  const WIN = 3;
  const score = [0, 0];
  let phase = 'wait';
  let startedAt = 0;
  let timeoutId = null;
  onLeave(() => clearTimeout(timeoutId));

  function paint(cls, msgs) {
    halves.forEach((h, i) => {
      h.className = `half ${i ? 'up' : 'down'} ${cls}`;
      h.querySelector('.hmsg').textContent = msgs[i];
      h.querySelector('.hscore').textContent = `${score[i]} / ${WIN}`;
    });
  }

  function round() {
    phase = 'wait';
    paint('wait', ['Чекай зеленого…', 'Чекай зеленого…']);
    timeoutId = setTimeout(() => {
      phase = 'go';
      startedAt = performance.now();
      paint('go', ['ТИСНИ!', 'ТИСНИ!']);
    }, 1500 + Math.random() * 3000);
  }

  function point(i, msgs) {
    phase = 'result';
    clearTimeout(timeoutId);
    score[i] += 1;
    paint('result', msgs);
    halves[i].classList.add('win');
    if (navigator.vibrate) navigator.vibrate(60);
    if (score[i] >= WIN) afterWin(() => forfeit(1 - i, reaction));
    else timeoutId = setTimeout(round, 1600);
  }

  halves.forEach((h, i) => h.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const msgs = [];
    if (phase === 'wait') {
      msgs[i] = 'Фальстарт! 🙈 Очко партнеру';
      msgs[1 - i] = 'Партнер поспішив — очко тобі';
      point(1 - i, msgs);
    } else if (phase === 'go') {
      msgs[i] = `Перший(а)! ${Math.round(performance.now() - startedAt)} мс ⚡`;
      msgs[1 - i] = 'Не встиг(ла) 😅';
      point(i, msgs);
    }
  }));

  round();
}

// ----- Перетягування -----

function tug() {
  const halves = duelLayout('Перетягування');
  const STEP = 0.05;
  const taps = [0, 0];
  let rope = 0; // від -1 до 1; більше нуля — перевага нижнього гравця
  let phase = 'count';
  const timers = [];
  onLeave(() => timers.forEach(clearTimeout));

  function paint(msgs) {
    const share = 50 + rope * 40;
    halves[0].style.flexGrow = share;
    halves[1].style.flexGrow = 100 - share;
    halves.forEach((h, i) => {
      if (msgs) h.querySelector('.hmsg').textContent = msgs[i];
      h.querySelector('.hscore').textContent = `${taps[i]} тапів`;
    });
  }

  [3, 2, 1].forEach((n, k) => timers.push(setTimeout(() => paint([`${n}…`, `${n}…`]), k * 800)));
  timers.push(setTimeout(() => {
    phase = 'play';
    paint(['Тапай! 💪', 'Тапай! 💪']);
  }, 2400));
  paint(['Приготуйтеся', 'Приготуйтеся']);

  halves.forEach((h, i) => h.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (phase !== 'play') return;
    taps[i] += 1;
    rope = Math.max(-1, Math.min(1, rope + (i === 0 ? STEP : -STEP)));
    if (Math.abs(rope) < 1) return paint();
    phase = 'end';
    const winner = rope > 0 ? 0 : 1;
    const msgs = [];
    msgs[winner] = '🏆 Перемога!';
    msgs[1 - winner] = 'Тебе чекає фант 😏';
    paint(msgs);
    halves[winner].classList.add('win');
    afterWin(() => forfeit(1 - winner, tug));
  }));
}

// ----- Малюй і вгадуй -----

function drawGuess() {
  const ROUNDS = 6;
  const SECONDS = 60;
  const words = shuffle(DATA.drawWords);
  const score = [0, 0];
  let round = 0;
  state.turn = 0;

  function secret() {
    if (round >= ROUNDS) return forfeitBy(score, drawGuess);
    render(`
      ${header('Малюй і вгадуй')}
      ${scoreboard(score)}
      <div class="card">
        <div class="tag">🎨 Раунд ${round + 1} з ${ROUNDS}</div>
        <div class="text">Малює ${esc(me())}</div>
        <div class="who">${esc(partner())}, відвернись! Слово бачить лише ${esc(me())}.</div>
        <div class="text word" id="word" hidden>${esc(words[round])}</div>
        <button class="btn primary" id="reveal">👀 Показати слово</button>
      </div>
    `);
    on('[data-back]', home);
    on('#reveal', (e) => {
      if (!$('#word').hidden) return board();
      $('#word').hidden = false;
      e.currentTarget.textContent = 'Запам’ятав(ла) — малювати';
    });
  }

  function board() {
    render(`
      ${header('Малюй і вгадуй')}
      <div class="row draw-bar">
        <div class="timer" id="clock">${SECONDS}</div>
        <button class="btn ghost" id="clear">🧽 Очистити</button>
      </div>
      <canvas id="board" class="board"></canvas>
      <p class="muted center">${esc(partner())} вгадує вголос. Літери й цифри не можна!</p>
      <div class="row">
        <button class="btn ghost" id="fail">⏭ Не вгадали</button>
        <button class="btn ok" id="guessed">✅ Вгадано!</button>
      </div>
    `);
    on('[data-back]', home);

    const cv = $('#board');
    const W = cv.clientWidth;
    const H = Math.round(Math.min(W * 1.1, window.innerHeight * 0.5));
    const dpr = window.devicePixelRatio || 1;
    cv.style.height = `${H}px`;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff';

    const at = (e) => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    let drawing = false;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      drawing = true;
      cv.setPointerCapture(e.pointerId);
      const [x, y] = at(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y);
      ctx.stroke();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const [x, y] = at(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    });
    const stop = () => { drawing = false; };
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);
    on('#clear', () => ctx.clearRect(0, 0, W, H));

    let left = SECONDS;
    const tick = setInterval(() => {
      left -= 1;
      $('#clock').textContent = left;
      if (left <= 0) finish(false);
    }, 1000);
    onLeave(() => clearInterval(tick));

    on('#guessed', () => finish(true));
    on('#fail', () => finish(false));
  }

  function finish(ok) {
    if (ok) score[state.turn] += 1;
    render(`
      ${header('Малюй і вгадуй')}
      ${scoreboard(score)}
      <div class="card">
        <div class="tag">${ok ? '🎉 Вгадано! +1 художнику' : '⏰ Не вгадали'}</div>
        <div class="who">Слово було</div>
        <div class="text word">${esc(words[round])}</div>
      </div>
      <button class="btn primary" id="nextRound">${round + 1 < ROUNDS ? 'Наступний раунд' : 'До фанту 😏'}</button>
    `);
    on('[data-back]', home);
    on('#nextRound', () => {
      round += 1;
      nextTurn();
      secret();
    });
  }

  secret();
}

Object.assign(GAMES, { reaction, tug, draw: drawGuess });
