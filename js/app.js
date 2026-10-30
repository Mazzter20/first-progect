const app = document.getElementById('app');

const state = {
  names: ['', ''],
  // 'm' — хлопець, 'f' — дівчина. Потрібно, щоб картки не були «дивними».
  genders: ['m', 'f'],
  level: 'romantic',
  turn: 0,
  scores: [0, 0],
  decks: {},
  tab: 'games',
  // Статистика поточної сесії (підсумок вечора).
  session: { cards: 0, dares: 0, truths: 0, forfeits: 0, games: 0 },
};

let timerId = null;
let cleanups = [];
// За сесію показуємо попередження про стоп-слово лише раз.
let wildConsentOk = false;

// ---------- Утиліти ----------

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    return null;
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Тягне картку з колоди без повторів, доки колода не закінчиться.
// Власні картки гравців: { truth: { romantic: [...] }, ... }.
function customCards(type, level) {
  const custom = store('custom') || {};
  return (custom[type] && custom[type][level]) || [];
}

function draw(type) {
  const key = `${type}.${state.level}`;
  if (!state.decks[key] || state.decks[key].length === 0) {
    const base = (DATA[type] && DATA[type][state.level]) || [];
    const pack = base.concat(customCards(type, state.level));
    if (!pack.length) {
      return type === 'wyr'
        ? ['Немає карток на цьому рівні', 'Додайте свої у «Мої картки»']
        : 'Немає карток на цьому рівні. Додайте свої у «Мої картки» або оберіть інший рівень.';
    }
    state.decks[key] = shuffle(pack);
  }
  return state.decks[key].pop();
}

// Скидає колоди поточного рівня (кнопка «нова колода»).
function reshuffleDecks() {
  Object.keys(state.decks).forEach((k) => {
    if (k.endsWith(`.${state.level}`)) delete state.decks[k];
  });
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const $ = (selector) => app.querySelector(selector);

const me = () => state.names[state.turn];
const partner = () => state.names[1 - state.turn];
const genderMe = () => state.genders[state.turn] || 'm';
const genderPartner = () => state.genders[1 - state.turn] || 'f';

// Літери українського слова (для регулярних виразів: \b з кирилицею не працює).
const LETTERS = 'а-яіїєґА-ЯІЇЄҐ\'’';

// Займенники про партнера: «він/вона», «він(вона)», «його/її»… — обираємо за статтю партнера.
const PARTNER_PRONOUNS = [
  ['він', 'вона'], ['його', 'її'], ['йому', 'їй'], ['ним', 'нею'], ['нього', 'неї'], ['ньому', 'ній'],
];

// Слова, жіночу форму яких не вивести за правилом.
const IRREGULAR_FEMININE = {
  'міг': 'могла', 'зміг': 'змогла', 'допоміг': 'допомогла', 'ліг': 'лягла', 'ніс': 'несла',
  'пішов': 'пішла', 'прийшов': 'прийшла', 'вийшов': 'вийшла', 'зайшов': 'зайшла',
  'твій': 'твоя', 'мій': 'моя', 'свій': 'своя', 'весь': 'уся', 'один': 'одна',
};

const sameCase = (model, word) => (model[0] === model[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word);

// Жіноча форма за підказкою в дужках: зробив(ла), закохався(лася), готовий(а), вдячний(на), збудженим(ою), голого(у).
function feminine(base, hint) {
  const irregular = IRREGULAR_FEMININE[base.toLowerCase()];
  if (irregular) return sameCase(base, irregular);
  switch (hint) {
    case 'ла':
      return /в$/.test(base) ? `${base.slice(0, -1)}ла` : `${base}ла`;
    case 'лася':
      return /вся$/.test(base) ? `${base.slice(0, -3)}лася` : `${base.replace(/ся$/, '')}лася`;
    case 'а':
    case 'на':
      return /ий$/.test(base) ? `${base.slice(0, -2)}а` : `${base}а`;
    case 'ою':
      return /[иі]м$/.test(base) ? `${base.slice(0, -2)}ою` : `${base}ою`;
    case 'у':
      return /ого$/.test(base) ? `${base.slice(0, -3)}у` : `${base}у`;
    default:
      return base + hint;
  }
}

// Підставляє стать: займенники, закінчення і анатомічні варіанти (мінет/куні тощо).
// Закінчення в дужках узгоджуються з тим, хто виконує дію: за замовчуванням — той, чий хід,
// але якщо щойно перед словом ішлося про партнера ({p}, «він/вона»), — партнер.
function genderize(text) {
  const gMe = genderMe();
  const gP = genderPartner();
  const pick2 = (m, f, who) => (who === 'm' ? m : f);

  let t = String(text);

  // 1. Займенники про партнера — через «/» чи в дужках, у будь-якому порядку («він/вона», «її/його»).
  const cap = (w) => w[0].toUpperCase() + w.slice(1);
  PARTNER_PRONOUNS.forEach(([m, f]) => {
    [[m, f], [f, m]].forEach(([first, second]) => {
      const re = new RegExp(`(?<![${LETTERS}])(${first}|${cap(first)})(?:\\/|\\()${second}\\)?(?![${LETTERS}])`, 'g');
      t = t.replace(re, (full, word) => sameCase(word, pick2(m, f, gP)));
    });
  });

  // 2. Закінчення в дужках. Ідемо по тексту зліва направо й відстежуємо, про кого мова.
  const token = new RegExp(`\\{p\\}|\\{me\\}|[,.!?:;—«»]|([${LETTERS}]+)\\(([${LETTERS}/]+)\\)|[${LETTERS}]+`, 'g');
  let subject = 'me';
  let distance = 0; // слів від останньої згадки партнера
  t = t.replace(token, (tok, base, hint) => {
    if (tok === '{p}') { subject = 'partner'; distance = 0; return tok; }
    if (tok === '{me}') { subject = 'me'; return tok; }
    if (/^[,.!?:;—«»]$/.test(tok)) { subject = 'me'; return tok; } // розділовий знак — нова частина речення
    if (!base) {
      const word = tok.toLowerCase();
      if (word === 'він' || word === 'вона') { subject = 'partner'; distance = 0; }
      else if (word === 'ти') subject = 'me';
      else if (subject === 'partner' && ++distance > 4) subject = 'me';
      return tok;
    }
    const who = subject === 'partner' ? gP : gMe;
    if (subject === 'partner') distance = 0;
    if (hint.includes('/') && hint !== 'ла/ло') {
      const [mForm, fForm] = hint.split('/');
      return base + (who === 'm' ? mForm : fForm);
    }
    return who === 'm' ? base : feminine(base, hint === 'ла/ло' ? 'ла' : hint);
  });

  // 3. Анатомія / акти щодо тіла партнера.
  t = t
    .replace(/мінет\s*\/\s*кунілінгус/gi, pick2('мінет', 'кунілінгус', gP))
    .replace(/кунілінгус\s*\/\s*мінет/gi, pick2('мінет', 'кунілінгус', gP))
    .replace(/член\s*\/\s*клітор/gi, pick2('член', 'клітор', gP))
    .replace(/клітор\s*\/\s*член/gi, pick2('член', 'клітор', gP))
    .replace(/член\s*\/\s*пальці/gi, pick2('член', 'пальці', gP))
    .replace(/головку\s*\/\s*клітор/gi, pick2('головку', 'клітор', gP))
    .replace(/клітор\s*\/\s*головку/gi, pick2('головку', 'клітор', gP))
    .replace(/яйця\s*\/\s*зовнішні губи/gi, pick2('яйця', 'зовнішні губи', gP))
    .replace(/груди\s*\/\s*соски/gi, 'соски');

  // Анатомія щодо себе ({me}), якщо явно «твій/твоя».
  t = t
    .replace(/твій член\s*\/\s*клітор/gi, pick2('твій член', 'твій клітор', gMe))
    .replace(/свій член\s*\/\s*клітор/gi, pick2('свій член', 'свій клітор', gMe));

  // Ролі в тексті фантів тощо.
  t = t
    .replace(/переможець/g, pick2('переможець', 'переможниця', gP))
    .replace(/Переможець/g, pick2('Переможець', 'Переможниця', gP));

  return t;
}

// Як fill(), але без HTML-екранування — для тексту на canvas.
function plain(text) {
  return genderize(String(text)).replaceAll('{p}', partner()).replaceAll('{me}', me());
}

function fill(text) {
  return esc(genderize(String(text))).replaceAll('{p}', esc(partner())).replaceAll('{me}', esc(me()));
}

function trackCard(type) {
  state.session.cards += 1;
  if (type === 'dare') state.session.dares += 1;
  if (type === 'truth') state.session.truths += 1;
  if (type === 'forfeit') state.session.forfeits += 1;
}

function nextTurn() {
  state.turn = 1 - state.turn;
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

// Реєструє функцію, яка зупинить анімації, таймери та звук, коли гравці підуть з екрана.
function onLeave(fn) {
  cleanups.push(fn);
}

function render(html) {
  stopTimer();
  const pending = cleanups;
  cleanups = [];
  pending.forEach((fn) => fn());
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

function on(selector, handler) {
  app.querySelectorAll(selector).forEach((el) => el.addEventListener('click', handler));
}

// ---------- Спільні шматки інтерфейсу ----------

function header(title) {
  return `
    <div class="top">
      <button class="icon-btn" data-back aria-label="Назад">‹</button>
      <h2>${title}</h2>
      <span style="width:44px"></span>
    </div>`;
}

function levelChips() {
  return `<div class="levels">${Object.entries(LEVELS).map(([key, l]) => `
    <button class="chip ${key === state.level ? 'active' : ''}" data-level="${key}">
      ${l.emoji}<br>${l.name}
    </button>`).join('')}</div>`;
}

function scoreboard(labels = state.scores) {
  return `<div class="score">${state.names.map((n, i) => `
    <div class="${i === state.turn ? 'turn' : ''}">${esc(n)}<span>${labels[i]}</span></div>
  `).join('')}</div>`;
}

// Екран згоди перед рівнем «Шалено»: стоп-слово, згода обох, можливість повернутися.
function confirmWildLevel(onAccept, onCancel) {
  if (wildConsentOk) {
    onAccept();
    return;
  }
  render(`
    <div class="hero">
      <div class="logo">😈</div>
      <h1>Рівень «Шалено»</h1>
      <p class="muted">Найвідвертіший режим. Перед стартом — короткі правила.</p>
    </div>
    <div class="card">
      <div class="text" style="font-size:17px;line-height:1.45">
        <p><b>Стоп-слово обов’язкове.</b> Оберіть разом слово (наприклад «червоний» або «стоп»). Після нього гра одразу зупиняється — без питань і образ.</p>
        <p style="margin-top:12px"><b>Тільки за згодою обох.</b> Будь-яку картку можна пропустити. Нічого не робимо «через силу».</p>
        <p style="margin-top:12px"><b>Після гри</b> — вода, обійми, перевірка, що всім ок.</p>
      </div>
    </div>
    <div class="field">
      <label for="stopword">Ваше стоп-слово (необов’язково зберегти)</label>
      <input id="stopword" type="text" placeholder="наприклад: червоний" value="${esc(store('stopword') || '')}" maxlength="40">
    </div>
    <button class="btn primary" id="ok">Ми готові · увімкнути Шалено</button>
    <button class="btn ghost" id="back">Назад до інших рівнів</button>
  `);
  on('#ok', () => {
    const w = (app.querySelector('#stopword').value || '').trim();
    if (w) store('stopword', w);
    wildConsentOk = true;
    onAccept();
  });
  on('#back', () => onCancel());
}

function setLevel(key, redraw) {
  if (key === 'wild' && !wildConsentOk) {
    confirmWildLevel(() => {
      state.level = 'wild';
      store('level', 'wild');
      redraw();
    }, redraw);
    return;
  }
  state.level = key;
  store('level', key);
  redraw();
}

// Підключає кнопку «назад» та перемикач рівня; onLevel перемальовує поточну гру.
function bindCommon(onLevel) {
  on('[data-back]', home);
  on('[data-level]', (e) => {
    setLevel(e.currentTarget.dataset.level, onLevel);
  });
}

function startTimer(seconds) {
  const el = app.querySelector('.timer');
  const format = (sec) => (seconds >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : sec);
  let left = seconds;
  stopTimer();
  el.textContent = format(left);
  timerId = setInterval(() => {
    left -= 1;
    el.textContent = left > 0 ? format(left) : '⏰ Час!';
    if (left <= 0) {
      stopTimer();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }, 1000);
}

// ---------- Екрани ----------

function genderPick(i, current) {
  return `
    <div class="gender-row" data-gi="${i}">
      <button type="button" class="chip gender ${current === 'm' ? 'active' : ''}" data-g="m">👦 Хлопець</button>
      <button type="button" class="chip gender ${current === 'f' ? 'active' : ''}" data-g="f">👧 Дівчина</button>
    </div>`;
}

function setup() {
  const g = state.genders;
  render(`
    <div class="hero">
      <div class="logo">💞</div>
      <h1>Гра для пари</h1>
      <p class="muted">Правда чи дія, квіз, «Я ніколи не…» та інше</p>
    </div>
    <div class="field">
      <label for="n1">Гравець 1</label>
      <input id="n1" maxlength="20" placeholder="Ім’я" value="${esc(state.names[0])}">
      ${genderPick(0, g[0])}
    </div>
    <div class="field">
      <label for="n2">Гравець 2</label>
      <input id="n2" maxlength="20" placeholder="Ім’я" value="${esc(state.names[1])}">
      ${genderPick(1, g[1])}
    </div>
    <p class="muted center">Стать потрібна, щоб завдання не були дивними (мінет/куні, займенники тощо).</p>
    <label class="check">
      <input type="checkbox" id="adult" ${store('adult') ? 'checked' : ''}>
      <span>Нам обом виповнилося 18 років, і ми граємо за взаємною згодою.</span>
    </label>
    <div class="spacer"></div>
    <p class="error" id="error" hidden></p>
    <button class="btn primary" id="go">Почати гру</button>
  `);

  on('.gender-row .chip', (e) => {
    const row = e.currentTarget.closest('.gender-row');
    const i = Number(row.dataset.gi);
    const gVal = e.currentTarget.dataset.g;
    state.genders[i] = gVal;
    row.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.g === gVal));
  });

  on('#go', () => {
    const n1 = app.querySelector('#n1').value.trim();
    const n2 = app.querySelector('#n2').value.trim();
    const error = app.querySelector('#error');
    error.hidden = false;
    if (!n1 || !n2) return (error.textContent = 'Введіть імена обох гравців');
    if (!app.querySelector('#adult').checked) return (error.textContent = 'Гра призначена лише для дорослих 18+');
    state.names = [n1, n2];
    store('names', state.names);
    store('genders', state.genders);
    store('adult', true);
    home();
  });
}

const TABS = [
  ['games', '💞', 'Ігри'],
  ['desires', '🃏', 'Бажання'],
  ['mini', '🕹️', 'Міні-ігри'],
];

function tabBar() {
  return `<nav class="tabs">${TABS.map(([key, icon, label]) => `
    <button class="${key === state.tab ? 'active' : ''}" data-tab="${key}">
      <span>${icon}</span>${label}
    </button>`).join('')}</nav>`;
}

function tile(game, cls, emoji, title, sub) {
  return `
    <button class="game ${cls}" data-game="${game}">
      <span class="emoji">${emoji}</span>
      <span><b>${title}</b><small>${sub}</small></span>
    </button>`;
}

function gamesTab() {
  return `
    <div class="hero">
      <h1>15+ ігор<br>для пари</h1>
      <p class="muted">Сотні карток · чотири рівні · один телефон</p>
    </div>
    ${levelChips()}
    <div class="games">
      ${tile('tod', 'g1 wide', '🎭', 'Правда чи дія', 'Чесні відповіді та сміливі завдання')}
      ${tile('escalation', 'g5 wide', '📈', 'Ескалація', 'Від ніжного до шаленого: рівень росте сам')}
      ${tile('quiz', 'g2', '🧠', 'Квіз для пари', 'Наскільки добре ви знаєте одне одного?')}
      ${tile('never', 'g3', '🙈', 'Я ніколи не…', 'Зізнання без осуду')}
      ${tile('wyr', 'g4', '⚖️', 'Що б ти обрав(ла)?', 'Перевірте вашу сумісність')}
      ${tile('dice', 'g5', '🎲', 'Кубики пристрасті', 'Дія + місце + час')}
      ${tile('wheel', 'g6', '🎡', 'Колесо', 'Крути й виконуй')}
      ${tile('roulette', 'g7', '👆', 'Рулетка дотику', 'Пальці на екран — хтось обраний')}
      ${tile('massage', 'g8', '💆', 'Релакс-масаж', 'Покроково, з таймером і звуком')}
      ${tile('vibe', 'g9', '📳', 'Вібромасажер', 'Сила й ритм вібрації · Android')}
      ${tile('bomb', 'g3', '💣', 'Гаряча бомба', 'Передавай, поки не вибухнула')}
      ${tile('strip', 'g1', '👕', 'Роздягання', 'Відмова — мінус річ')}
      ${tile('poses', 'g9 wide', '🔥', 'Пози', '36 поз зі схемами А/Б: від легких до сміливих')}
      ${tile('deep', 'g2 wide', '🕯️', 'Розмови по душах', '30 питань у трьох етапах — від легкого до найособистішого')}
      ${tile('custom', 'g7 wide', '✍️', 'Мої картки', 'Додайте власні питання й завдання в ігри')}
    </div>
    ${state.level === 'wild' ? `
    <div class="note warn">
      😈 <b>Шалено</b> — максимальний рівень. Перед грою домовтеся про стоп-слово: після нього все
      зупиняється без питань. Пропуск завдання коштує однієї речі одягу, а кожна четверта картка — подвійна.
    </div>` : `
    <div class="note">
      🛑 Будь-яке завдання можна пропустити. Слово «стоп» означає стоп — граємо лише в межах,
      комфортних для вас обох.
    </div>`}
    ${state.session.cards > 0 ? `
    <button class="btn ghost" data-game="sessionSummary">📊 Підсумок вечора · ${state.session.cards} карток</button>
    ` : ''}`;
}

function desiresTab() {
  return `
    <div class="big-icon">🃏</div>
    <h1>Чого хочете ви обоє?</h1>
    <ol class="steps">
      <li><b>1</b>Кожен по черзі гортає ідеї для побачень і близькості</li>
      <li><b>2</b>Відповідає чесно: так, можливо чи ні</li>
      <li><b>3</b>Гра покаже лише те, що хочете ви обоє</li>
    </ol>
    ${levelChips()}
    <button class="btn primary" data-game="desires">Почати з партнером</button>
    <p class="note">«Ні» партнера ніхто не побачить — у результатах лише збіги.</p>`;
}

function miniTab() {
  return `
    <div class="hero">
      <h1>Міні-ігри</h1>
      <p class="muted">Удвох на одному телефоні. Хто програв — отримує фант 😏</p>
    </div>
    <div class="games">
      ${tile('hockey', 'g4', '🏒', 'Аерохокей', 'До 7 голів')}
      ${tile('hippos', 'g5', '🦛', 'Щасливі бегемоти', 'Хто з’їсть більше кульок')}
      ${tile('reaction', 'g6', '⚡', 'Хто швидший', 'Тисни першим, коли загориться')}
      ${tile('tug', 'g1', '🪢', 'Перетягування', 'Тапай швидше за партнера')}
      ${tile('draw', 'g2 wide', '🎨', 'Малюй і вгадуй', 'Один малює слово, інший вгадує')}
    </div>`;
}

function home() {
  const body = { games: gamesTab, desires: desiresTab, mini: miniTab }[state.tab]();
  render(`
    <div class="top">
      <span style="width:44px"></span>
      <h2>${esc(state.names[0])} 💞 ${esc(state.names[1])}</h2>
      <button class="icon-btn" id="edit" aria-label="Змінити гравців">⚙️</button>
    </div>
    ${body}
    <div class="tab-space"></div>
    ${tabBar()}
  `);

  on('#edit', setup);
  on('[data-tab]', (e) => {
    state.tab = e.currentTarget.dataset.tab;
    store('tab', state.tab);
    home();
  });
  on('[data-level]', (e) => {
    setLevel(e.currentTarget.dataset.level, home);
  });
  on('[data-game]', (e) => {
    state.turn = 0;
    state.scores = [0, 0];
    GAMES[e.currentTarget.dataset.game]();
  });
}

// ----- Правда чи дія -----

function tod() {
  render(`
    ${header('Правда чи дія')}
    ${levelChips()}
    ${scoreboard()}
    <div class="card">
      <div class="tag">Хід гравця</div>
      <div class="text">${esc(me())}</div>
      <div class="who">Обирай: правда чи дія?</div>
    </div>
    <div class="row">
      <button class="btn truth" data-pick="truth">Правда</button>
      <button class="btn dare" data-pick="dare">Дія</button>
    </div>
    <button class="btn ghost" data-pick="random">🎲 Випадково</button>
    <button class="btn ghost" id="reshuffle">🔄 Нова колода</button>
  `);
  bindCommon(tod);
  on('[data-pick]', (e) => {
    let type = e.currentTarget.dataset.pick;
    if (type === 'random') type = pick(['truth', 'dare']);
    todCard(type);
  });
  on('#reshuffle', () => {
    reshuffleDecks();
    const who = app.querySelector('.who');
    if (who) who.textContent = 'Колоду перемішано — обирай знову';
  });
}

// after — екран, куди повернутися після картки (за замовчуванням — до вибору «правда чи дія»).
function todCard(type, after = tod) {
  const isDare = type === 'dare';
  const wild = state.level === 'wild';
  // На рівні «Шалено» кожна четверта картка подвійна, а пропуск коштує речі одягу.
  const double = wild && Math.random() < 0.25;
  const seconds = wild ? 120 : 60;
  trackCard(type);
  render(`
    ${header('Правда чи дія')}
    ${scoreboard()}
    <div class="card ${double ? 'hot' : ''}">
      <div class="tag">${isDare ? '🔥 Дія' : '💬 Правда'} · ${LEVELS[state.level].emoji}</div>
      ${double ? `<div class="badge">🔥 Подвійно: ${isDare ? 'вдвічі довше або двічі поспіль' : 'відповідай у деталях і дивись в очі'} · +2</div>` : ''}
      <div class="text">${fill(draw(type))}</div>
      <div class="who">для ${esc(me())}</div>
      ${isDare ? `<div class="timer"></div><button class="btn ghost" id="timer">⏱ Таймер ${wild ? '2 хв' : '60 с'}</button>` : ''}
    </div>
    <div class="row">
      <button class="btn ghost" id="skip">${wild ? 'Пропуск = зніми річ 👕' : 'Пропустити'}</button>
      <button class="btn ok" id="done">✅ Виконано +${double ? 2 : 1}</button>
    </div>
    ${wild ? `<p class="muted center">Стоп-слово${store('stopword') ? ` «${esc(store('stopword'))}»` : ''} діє завжди — після нього гра зупиняється без питань.</p>` : ''}
  `);
  on('[data-back]', home);
  on('#timer', () => startTimer(seconds));
  on('#skip', () => { nextTurn(); after(); });
  on('#done', () => { state.scores[state.turn] += double ? 2 : 1; nextTurn(); after(); });
}

// ----- Квіз -----

function quiz() {
  render(`
    ${header('Квіз для пари')}
    ${levelChips()}
    ${scoreboard()}
    <div class="card">
      <div class="tag">🧠 ${esc(me())}, вгадай</div>
      <div class="text">${fill(draw('quiz'))}</div>
      <div class="who">Відповідай уголос, а ${esc(partner())} скаже, чи ти вгадав(ла)</div>
    </div>
    <div class="row">
      <button class="btn ghost" id="no">❌ Ні</button>
      <button class="btn ok" id="yes">✅ Вгадав(ла) +1</button>
    </div>
    <button class="btn ghost" id="finish">🏁 Завершити — фант тому, хто програв</button>
  `);
  bindCommon(quiz);
  on('#finish', () => forfeitBy(state.scores, home));
  on('#no', () => { nextTurn(); quiz(); });
  on('#yes', () => { state.scores[state.turn] += 1; nextTurn(); quiz(); });
}

// ----- Я ніколи не… -----

function never() {
  const statement = draw('never');
  const did = [false, false];

  render(`
    ${header('Я ніколи не…')}
    ${levelChips()}
    ${scoreboard()}
    <div class="card">
      <div class="tag">🙈 Хто робив — зізнайтеся</div>
      <div class="text">${fill(statement)}</div>
      <div class="who">Рахунок — скільки разів ви «вже робили»</div>
    </div>
    <div class="row">
      ${state.names.map((n, i) => `<button class="btn" data-did="${i}">🙋 ${esc(n)}</button>`).join('')}
    </div>
    <button class="btn primary" id="next">Далі</button>
  `);
  bindCommon(never);
  on('[data-did]', (e) => {
    const i = Number(e.currentTarget.dataset.did);
    did[i] = !did[i];
    e.currentTarget.classList.toggle('picked', did[i]);
  });
  on('#next', () => {
    did.forEach((d, i) => { if (d) state.scores[i] += 1; });
    nextTurn();
    never();
  });
}

// ----- Що б ти обрав(ла)? -----

function wyr() {
  const [a, b] = draw('wyr');
  const choices = [];
  // Тут рахунок — це кількість збігів, однаковий для обох гравців.
  const rounds = state.scores[1];
  const matches = state.scores[0];
  const percent = rounds ? Math.round((matches / rounds) * 100) : 0;

  const ask = () => {
    const who = state.names[choices.length];
    app.querySelector('.who').innerHTML = choices.length === 0
      ? `Обирає ${esc(who)}`
      : `${esc(state.names[0])} обрав(ла) 🤫 Тепер обирає ${esc(who)}`;
  };

  render(`
    ${header('Що б ти обрав(ла)?')}
    ${levelChips()}
    <div class="score"><div>Сумісність<span>${percent}%</span></div><div>Раундів<span>${rounds}</span></div></div>
    <div class="card">
      <div class="tag">⚖️ Що б ти обрав(ла)?</div>
      <button class="option" data-opt="0">${fill(a)}</button>
      <div class="or">АБО</div>
      <button class="option" data-opt="1">${fill(b)}</button>
      <div class="who"></div>
    </div>
    <div id="result"></div>
  `);
  bindCommon(wyr);
  ask();

  on('[data-opt]', (e) => {
    if (choices.length >= 2) return;
    choices.push(Number(e.currentTarget.dataset.opt));
    if (choices.length < 2) return ask();

    const same = choices[0] === choices[1];
    state.scores[1] += 1;
    if (same) state.scores[0] += 1;
    app.querySelectorAll('[data-opt]').forEach((btn, i) => {
      const who = state.names.filter((_, p) => choices[p] === i).map(esc).join(' і ');
      if (who) btn.innerHTML += `<br><small class="muted">${who}</small>`;
    });
    app.querySelector('.who').textContent = same ? '💞 Ви думаєте однаково!' : '😏 Протилежності притягуються';
    app.querySelector('#result').innerHTML = '<button class="btn primary" id="next">Далі</button>';
    on('#next', wyr);
  });
}

// ----- Кубики пристрасті -----

function dice() {
  render(`
    ${header('Кубики пристрасті')}
    ${levelChips()}
    <div class="card">
      <div class="tag">🎲 ${esc(me())} → ${esc(partner())}</div>
      <div class="dice">
        <div class="die">?</div>
        <div class="die">?</div>
        <div class="die">?</div>
      </div>
      <div class="who">Кидай кубики!</div>
    </div>
    <button class="btn primary" id="roll">Кинути кубики</button>
  `);
  bindCommon(dice);

  on('#roll', (e) => {
    const btn = e.currentTarget;
    const card = app.querySelector('.card');
    const dieEls = app.querySelectorAll('.die');
    const { actions, zones, times } = DATA.dice;
    const randomFaces = () => [
      pick(actions[state.level]),
      fill(pick(zones[state.level])),
      pick(times),
    ];

    btn.disabled = true;
    app.querySelector('.tag').innerHTML = `🎲 ${esc(me())} → ${esc(partner())}`;
    card.classList.add('rolling');
    const spin = setInterval(() => {
      randomFaces().forEach((f, i) => { dieEls[i].innerHTML = f; });
    }, 90);

    setTimeout(() => {
      clearInterval(spin);
      card.classList.remove('rolling');
      const [action, zone, time] = randomFaces();
      dieEls[0].innerHTML = action;
      dieEls[1].innerHTML = zone;
      dieEls[2].innerHTML = time;
      app.querySelector('.who').innerHTML =
        `${esc(me())}: ${action.toLowerCase()} ${zone} — ${time}`;
      nextTurn();
      btn.disabled = false;
      btn.textContent = `Хід: ${me()} — кинути`;
    }, 900);
  });
}

function sessionSummary() {
  const s = state.session;
  const tried = (store('poses') || {}).tried || [];
  render(`
    ${header('Підсумок вечора')}
    <div class="card">
      <div class="tag">📊 Ця сесія</div>
      <div class="text">${esc(state.names[0])} 💞 ${esc(state.names[1])}</div>
      <div class="who">
        Карток: <b>${s.cards}</b><br>
        Правда: <b>${s.truths}</b> · Дія: <b>${s.dares}</b><br>
        Фантів: <b>${s.forfeits}</b><br>
        Поз у «спробували»: <b>${tried.length}</b> / ${(DATA.poses || []).length}
      </div>
    </div>
    <p class="muted center">${state.genders[0] === 'm' ? '👦' : '👧'} ${esc(state.names[0])} · ${state.genders[1] === 'm' ? '👦' : '👧'} ${esc(state.names[1])}</p>
    <div class="row">
      <button class="btn ghost" id="resetSession">Скинути лічильник</button>
      <button class="btn primary" data-back>На головну</button>
    </div>
  `);
  on('[data-back]', home);
  on('#resetSession', () => {
    state.session = { cards: 0, dares: 0, truths: 0, forfeits: 0, games: 0 };
    sessionSummary();
  });
}

const GAMES = { tod, quiz, never, wyr, dice, sessionSummary };
