// Пози, «Гаряча бомба», «Роздягання» та «Ескалація».

// ----- Пози -----

function poses(filter = 'all', idx = 0) {
  const saved = store('poses') || { fav: [], tried: [] };
  const list = DATA.poses.filter((p) => (
    filter === 'all' || (filter === 'fav' ? saved.fav.includes(p.name) : p.level === Number(filter))
  ));
  const filters = [['all', 'Усі'], ['1', '🔥'], ['2', '🔥🔥'], ['3', '🔥🔥🔥'], ['fav', '❤️']];
  const pose = list[(idx + list.length) % list.length];

  render(`
    ${header('Пози')}
    <div class="filters">${filters.map(([key, label]) => `
      <button class="chip ${key === filter ? 'active' : ''}" data-filter="${key}">${label}</button>`).join('')}
    </div>
    <p class="muted center">Спробували ${saved.tried.length} з ${DATA.poses.length}</p>
    ${pose ? `
      <div class="card pose">
        ${poseSvg(pose.name) || `<div class="pose-emoji">${pose.emoji}</div>`}
        <p class="muted pose-legend">схема · А світліший · Б темніший · ${pose.emoji}</p>
        <div class="tag">${'🔥'.repeat(pose.level)} · ${['', 'легко', 'середньо', 'для сміливих'][pose.level]}</div>
        <div class="text">${pose.name}</div>
        <p class="pose-how">${pose.how}</p>
        <p class="pose-line"><b>Чому варто:</b> ${pose.why}</p>
        <p class="pose-line"><b>Порада:</b> ${pose.tip}</p>
        <div class="row">
          <button class="btn ghost ${saved.fav.includes(pose.name) ? 'picked' : ''}" id="fav">❤️ В обране</button>
          <button class="btn ghost ${saved.tried.includes(pose.name) ? 'picked' : ''}" id="tried">✅ Спробували</button>
        </div>
      </div>
      <div class="row">
        <button class="btn ghost" id="prev" aria-label="Попередня">‹</button>
        <button class="btn primary" id="rand">🎲 Випадкова</button>
        <button class="btn ghost" id="next" aria-label="Наступна">›</button>
      </div>` : '<div class="card small"><div class="text">В обраному поки порожньо. Натисніть ❤️ на позі, щоб додати.</div></div>'}
    <p class="note">Слухайте тіла одне одного: якщо щось незручно чи боляче — зупиніться й поміняйте позу.</p>
  `);
  on('[data-back]', home);
  on('[data-filter]', (e) => poses(e.currentTarget.dataset.filter, 0));
  if (!pose) return;

  const go = (i) => poses(filter, (i + list.length) % list.length);
  const toggle = (key) => {
    const set = new Set(saved[key]);
    if (set.has(pose.name)) set.delete(pose.name);
    else set.add(pose.name);
    store('poses', { ...saved, [key]: [...set] });
    poses(filter, filter === 'fav' && key === 'fav' ? 0 : idx);
  };
  on('#prev', () => go(idx - 1));
  on('#next', () => go(idx + 1));
  on('#rand', () => go(Math.floor(Math.random() * list.length)));
  on('#fav', () => toggle('fav'));
  on('#tried', () => toggle('tried'));
}

// Тягне картку правди або дії потрібного рівня, не змінюючи обраний гравцями рівень.
function drawAt(level, type) {
  const saved = state.level;
  state.level = level;
  const text = fill(draw(type));
  state.level = saved;
  return text;
}

// ----- Гаряча бомба -----

function bomb() {
  const fuse = 20000 + Math.random() * 40000; // вибух через 20–60 секунд, гравці не знають коли
  const startedAt = performance.now();

  function boom() {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 600]);
    render(`
      ${header('Гаряча бомба')}
      <div class="card hot">
        <div class="bomb boom">💥</div>
        <div class="text">БАХ! Бомба вибухнула в руках: ${esc(me())}</div>
        <div class="who">Тепер ${esc(partner())} обирає фант</div>
      </div>
      <button class="btn primary" id="toForfeit">До фанту 😏</button>
    `);
    on('[data-back]', home);
    on('#toForfeit', () => forfeit(state.turn, bomb));
  }

  function turn() {
    render(`
      ${header('Гаряча бомба')}
      ${levelChips()}
      <div class="card">
        <div class="bomb" id="bomb">💣</div>
        <div class="tag">Бомба в руках: ${esc(me())}</div>
        <div class="text">${drawAt(state.level, Math.random() < 0.5 ? 'truth' : 'dare')}</div>
        <div class="who">Відповідай чи виконуй — і швидше передавай телефон!</div>
      </div>
      <button class="btn primary" id="pass">✅ Готово — передаю: ${esc(partner())}</button>
    `);
    bindCommon(turn);
    on('#pass', () => {
      nextTurn();
      turn();
    });

    // Що ближче вибух, то швидше «цокає» бомба.
    const el = $('#bomb');
    const tick = setInterval(() => {
      const left = 1 - (performance.now() - startedAt) / fuse;
      if (left <= 0) {
        clearInterval(tick);
        boom();
        return;
      }
      el.style.animationDuration = `${Math.max(0.12, left)}s`;
    }, 200);
    onLeave(() => clearInterval(tick));
  }

  turn();
}

// ----- Роздягання -----

function strip() {
  const clothes = [5, 5];

  function setupScreen() {
    render(`
      ${header('Роздягання')}
      <div class="card small">
        <div class="tag">👕 Скільки на кому речей?</div>
        <div class="who">Відмовився(лася) від завдання — знімаєш одну. Хто перший залишиться без нічого, отримує фант.</div>
      </div>
      ${state.names.map((n, i) => `
        <div class="stepper">
          <b>${esc(n)}</b>
          <button class="icon-btn" data-step="${i}" data-d="-1" aria-label="Менше">−</button>
          <span id="c${i}">${clothes[i]}</span>
          <button class="icon-btn" data-step="${i}" data-d="1" aria-label="Більше">+</button>
        </div>`).join('')}
      ${levelChips()}
      <button class="btn primary" id="start">Почати</button>
    `);
    bindCommon(setupScreen);
    on('[data-step]', (e) => {
      const i = Number(e.currentTarget.dataset.step);
      clothes[i] = Math.min(12, Math.max(1, clothes[i] + Number(e.currentTarget.dataset.d)));
      $(`#c${i}`).textContent = clothes[i];
    });
    on('#start', () => {
      state.turn = 0;
      round();
    });
  }

  function round() {
    const type = Math.random() < 0.5 ? 'truth' : 'dare';
    render(`
      ${header('Роздягання')}
      ${scoreboard(clothes.map((c) => `👕×${c}`))}
      <div class="card">
        <div class="tag">${type === 'dare' ? '🔥 Дія' : '💬 Правда'} · ${LEVELS[state.level].emoji} · для ${esc(me())}</div>
        <div class="text">${fill(draw(type))}</div>
        ${type === 'dare' ? '<div class="timer"></div><button class="btn ghost" id="timer">⏱ Таймер 60 с</button>' : ''}
      </div>
      <div class="row">
        <button class="btn ghost" id="refuse">👕 Відмова — знімаю річ</button>
        <button class="btn ok" id="done">✅ Виконано</button>
      </div>
    `);
    on('[data-back]', home);
    on('#timer', () => startTimer(60));
    on('#done', () => {
      nextTurn();
      round();
    });
    on('#refuse', () => {
      clothes[state.turn] -= 1;
      if (clothes[state.turn] <= 0) return naked();
      nextTurn();
      round();
    });
  }

  function naked() {
    render(`
      ${header('Роздягання')}
      <div class="card hot">
        <div class="pose-emoji">🔥</div>
        <div class="text">${esc(me())} — повністю без одягу!</div>
        <div class="who">А тепер ${esc(partner())} обирає фант</div>
      </div>
      <button class="btn primary" id="toForfeit">До фанту 😏</button>
    `);
    on('[data-back]', home);
    on('#toForfeit', () => forfeit(state.turn, home));
  }

  setupScreen();
}

// ----- Ескалація -----

function escalation() {
  const order = ['romantic', 'flirty', 'spicy', 'wild'];
  const PER = 5; // карток на кожному рівні
  const seconds = [30, 60, 90, 120];
  let n = 0;
  state.turn = 0;

  function step() {
    if (n >= PER * order.length) return finale();
    const stage = Math.floor(n / PER);
    const level = order[stage];
    const type = Math.random() < 0.5 ? 'truth' : 'dare';
    render(`
      ${header('Ескалація')}
      <div class="progress"><i style="width:${(n / (PER * order.length)) * 100}%"></i></div>
      <div class="stages">${order.map((l, i) => `<span class="${i <= stage ? 'on' : ''}">${LEVELS[l].emoji}</span>`).join('')}</div>
      <div class="card ${stage === 3 ? 'hot' : ''}">
        <div class="tag">${LEVELS[level].emoji} ${LEVELS[level].name} · ${n % PER + 1} / ${PER} · ${type === 'dare' ? 'дія' : 'правда'}</div>
        <div class="text">${drawAt(level, type)}</div>
        <div class="who">для ${esc(me())}</div>
        ${type === 'dare' ? `<div class="timer"></div><button class="btn ghost" id="timer">⏱ Таймер ${seconds[stage]} с</button>` : ''}
      </div>
      <div class="row">
        <button class="btn ghost" id="skip">${stage === 3 ? 'Пропуск = зніми річ 👕' : 'Пропустити'}</button>
        <button class="btn ok" id="done">✅ Далі</button>
      </div>
    `);
    on('[data-back]', home);
    on('#timer', () => startTimer(seconds[stage]));
    const next = () => {
      n += 1;
      nextTurn();
      step();
    };
    on('#skip', next);
    on('#done', next);
  }

  function finale() {
    render(`
      ${header('Ескалація')}
      <div class="card hot">
        <div class="pose-emoji">😈</div>
        <div class="text">Ви пройшли всі чотири рівні</div>
        <div class="who">Гру закінчено. Далі — лише ви двоє.</div>
      </div>
      <button class="btn primary" id="poses">🔥 Обрати позу на сьогодні</button>
      <button class="btn ghost" data-back>На головну</button>
    `);
    on('[data-back]', home);
    on('#poses', () => poses());
  }

  step();
}

Object.assign(GAMES, { poses: () => poses(), bomb, strip, escalation });
