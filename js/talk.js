// «Розмови по душах» і редактор власних карток.

function deep() {
  const cards = DATA.deep.flatMap((stage, i) => shuffle(stage.questions).map((q) => ({ q, stage: i })));
  let idx = 0;

  function card() {
    if (idx >= cards.length) return finale();
    const { q, stage } = cards[idx];
    render(`
      ${header('Розмови по душах')}
      <div class="progress"><i style="width:${(idx / cards.length) * 100}%"></i></div>
      <div class="card">
        <div class="tag">🕯️ Етап ${stage + 1} · ${DATA.deep[stage].name} · ${idx + 1} / ${cards.length}</div>
        <div class="text">${fill(q)}</div>
        <div class="who">Першим(ою) відповідає ${esc(me())}, потім ${esc(partner())}. Не поспішайте.</div>
      </div>
      <div class="row">
        <button class="btn ghost" id="skip">Пропустити</button>
        <button class="btn primary" id="next">Далі</button>
      </div>
      <p class="note">Слухайте не перебиваючи й не оцінюючи. Тут немає правильних відповідей.</p>
    `);
    on('[data-back]', home);
    const next = () => {
      idx += 1;
      nextTurn();
      card();
    };
    on('#next', next);
    on('#skip', next);
  }

  function finale() {
    render(`
      ${header('Розмови по душах')}
      <div class="card">
        <div class="tag">🕯️ Фінал</div>
        <div class="text">Сядьте навпроти й мовчки дивіться одне одному в очі 4 хвилини</div>
        <div class="who">Спершу буде смішно й незручно. Це нормально — просто залишайтеся поруч.</div>
        <div class="timer"></div>
        <button class="btn primary" id="go">⏱ Почати 4 хвилини</button>
      </div>
      <button class="btn ghost" data-back>На головну</button>
    `);
    on('[data-back]', home);
    on('#go', (e) => {
      e.currentTarget.hidden = true;
      startTimer(240);
    });
  }

  card();
}

const CUSTOM_TYPES = {
  truth: 'Правда',
  dare: 'Дія',
  never: 'Я ніколи не…',
  quiz: 'Квіз',
};

function custom(type = 'truth') {
  const list = customCards(type, state.level);

  render(`
    ${header('Мої картки')}
    <div class="levels">${Object.entries(CUSTOM_TYPES).map(([key, name]) => `
      <button class="chip ${key === type ? 'active' : ''}" data-type="${key}">${name}</button>`).join('')}
    </div>
    ${levelChips()}
    <form class="field" id="addForm">
      <label for="cardText">Нова картка: ${CUSTOM_TYPES[type]} · ${LEVELS[state.level].emoji} ${LEVELS[state.level].name}</label>
      <input id="cardText" maxlength="160" autocomplete="off" placeholder="Напр.: Поцілуй {p} у ніс">
      <p class="muted">Напишіть {p} там, де має бути ім’я партнера.</p>
      <button class="btn primary" type="submit">Додати</button>
    </form>
    <div class="match-list">
      ${list.length ? list.map((t, i) => `
        <div class="match custom-row"><span>${esc(t)}</span><button class="icon-btn" data-del="${i}" aria-label="Видалити">✕</button></div>
      `).join('') : '<p class="muted center">Тут поки порожньо. Ваші картки з’являтимуться в іграх разом зі звичайними.</p>'}
    </div>
  `);
  bindCommon(() => custom(type));
  on('[data-type]', (e) => custom(e.currentTarget.dataset.type));

  const save = (items) => {
    const all = store('custom') || {};
    all[type] = all[type] || {};
    all[type][state.level] = items;
    store('custom', all);
    state.decks = {};
    custom(type);
  };

  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#cardText').value.trim();
    if (text) save(list.concat(text));
  });
  on('[data-del]', (e) => save(list.filter((_, i) => i !== Number(e.currentTarget.dataset.del))));
}

Object.assign(GAMES, { deep, custom: () => custom() });
