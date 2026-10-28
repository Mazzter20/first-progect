// Вібромасажер. Вібрацію дозволяє лише Chrome на Android (у звичайній вкладці, не у вбудованому фреймі).
// Телефон не вміє міняти силу вібрації, тому силу імітуємо ШІМ: короткі імпульси з паузами між ними.

const VIBE_MODES = {
  steady: { name: 'Постійно', icon: '〰️', shape: () => 1 },
  pulse: { name: 'Пульс', icon: '💓', shape: (t) => (t % 600 < 300 ? 1 : 0) },
  wave: { name: 'Хвиля', icon: '🌊', shape: (t) => 0.2 + 0.8 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 2400)) },
  heart: {
    name: 'Серцебиття',
    icon: '❤️',
    shape: (t) => {
      const p = t % 1200;
      return p < 120 || (p > 260 && p < 380) ? 1 : 0;
    },
  },
};

const PWM_MS = 50; // довжина одного циклу «імпульс + пауза»
const CHUNK_MS = 3000; // скільки мілісекунд вібрації замовляємо за один виклик

// Будує шаблон для navigator.vibrate: [вібрація, пауза, вібрація, пауза, …].
function vibePattern(level, mode, speed, from) {
  const out = [0];
  const add = (isOn, ms) => {
    if (ms <= 0) return;
    const last = out.length - 1;
    if ((last % 2 === 0) === isOn) out[last] += ms;
    else out.push(ms);
  };
  for (let t = 0; t < CHUNK_MS; t += PWM_MS) {
    const k = level * VIBE_MODES[mode].shape((from + t) * speed);
    const on = k < 0.03 ? 0 : Math.max(8, Math.round(PWM_MS * k));
    add(true, on);
    add(false, PWM_MS - on);
  }
  return out;
}

function vibe() {
  const supported = typeof navigator.vibrate === 'function';
  let level = 0;
  let mode = 'steady';
  let speed = 1;
  let clock = 0;
  let chunkId = null;
  let lastKick = 0;
  let wake = null;

  render(`
    ${header('Вібромасажер')}
    <div class="note warn" id="vwarn" ${supported ? 'hidden' : ''}>
      Цей браузер не вміє вібрувати. Відкрийте гру в Chrome на Android.
      На iPhone вебсторінки вібрацію не підтримують.
    </div>
    <div class="vtrack" id="vtrack" role="slider" aria-label="Сила вібрації" aria-valuemin="0" aria-valuemax="100" tabindex="0">
      <div class="vfill" id="vfill"></div>
      <div class="vlevel" id="vlevel">Вимк.</div>
      <div class="vthumb" id="vthumb"></div>
    </div>
    <p class="muted center">Тягніть повзунок угору, щоб увімкнути</p>
    <div class="modes">
      ${Object.entries(VIBE_MODES).map(([key, m]) => `
        <button class="chip ${key === mode ? 'active' : ''}" data-mode="${key}">${m.icon}<br>${m.name}</button>
      `).join('')}
    </div>
    <div class="row">
      <button class="btn ghost" id="vspeed">Швидкість x1</button>
      <button class="btn ghost" id="vlock">🔒 Заблокувати</button>
    </div>
    <button class="btn" id="vstop">⏹ Стоп</button>
    <div class="lock" id="lock" hidden>
      <p>Екран заблоковано, щоб випадкові дотики нічого не змінили</p>
      <button class="unlock" id="unlock">🔓</button>
      <p class="muted">Утримуйте 2 секунди, щоб розблокувати</p>
    </div>
  `);
  on('[data-back]', home);

  const track = $('#vtrack');
  const thumb = $('#vthumb');

  function warnBlocked() {
    const warn = $('#vwarn');
    warn.textContent = 'Браузер заблокував вібрацію. Відкрийте гру як звичайний сайт (GitHub Pages) у Chrome на Android.';
    warn.hidden = false;
  }

  function buzz() {
    if (!supported) return;
    if (level <= 0) {
      navigator.vibrate(0);
      return;
    }
    const ok = navigator.vibrate(vibePattern(level, mode, speed, clock));
    if (ok === false) warnBlocked();
  }

  // Перезапускає замовлення вібрації: одразу і далі кожні CHUNK_MS.
  function restart() {
    clearInterval(chunkId);
    chunkId = null;
    buzz();
    if (level <= 0) return;
    chunkId = setInterval(() => {
      clock += CHUNK_MS;
      buzz();
    }, CHUNK_MS);
  }

  function keepAwake(onScreen) {
    if (onScreen && !wake && navigator.wakeLock) {
      navigator.wakeLock.request('screen').then((w) => { wake = w; }).catch(() => {});
    }
    if (!onScreen && wake) {
      wake.release().catch(() => {});
      wake = null;
    }
  }

  function show() {
    const free = track.clientHeight - thumb.offsetHeight;
    thumb.style.bottom = `${level * free}px`;
    $('#vfill').style.height = `${level * free + thumb.offsetHeight / 2}px`;
    $('#vlevel').textContent = level > 0 ? `${Math.round(level * 100)}%` : 'Вимк.';
    track.setAttribute('aria-valuenow', Math.round(level * 100));
    track.style.setProperty('--lvl', level);
    track.classList.toggle('active', level > 0);
  }

  function setLevel(value, force) {
    level = Math.round(Math.min(1, Math.max(0, value)) * 20) / 20;
    show();
    keepAwake(level > 0);
    // Під час перетягування не смикаємо мотор частіше, ніж раз на 150 мс.
    const now = performance.now();
    if (force || now - lastKick > 150 || level === 0) {
      lastKick = now;
      restart();
    }
  }

  const fromPointer = (e) => {
    const r = track.getBoundingClientRect();
    const free = r.height - thumb.offsetHeight;
    return (r.bottom - e.clientY - thumb.offsetHeight / 2) / free;
  };
  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    track.setPointerCapture(e.pointerId);
    setLevel(fromPointer(e));
  });
  track.addEventListener('pointermove', (e) => { if (dragging) setLevel(fromPointer(e)); });
  track.addEventListener('pointerup', (e) => {
    dragging = false;
    setLevel(fromPointer(e), true);
  });
  track.addEventListener('pointercancel', () => { dragging = false; });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') setLevel(level + 0.05, true);
    if (e.key === 'ArrowDown') setLevel(level - 0.05, true);
  });

  on('[data-mode]', (e) => {
    mode = e.currentTarget.dataset.mode;
    app.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    if (level === 0) setLevel(0.5, true);
    else restart();
  });
  on('#vspeed', (e) => {
    speed = speed === 3 ? 1 : speed + 1;
    e.currentTarget.textContent = `Швидкість x${speed}`;
    restart();
  });
  on('#vstop', () => setLevel(0, true));

  // Блокування: оверлей ловить усі дотики, знімається утриманням кнопки.
  const lock = $('#lock');
  let holdId = null;
  on('#vlock', () => { lock.hidden = false; });
  const unlockBtn = $('#unlock');
  unlockBtn.addEventListener('pointerdown', () => {
    unlockBtn.classList.add('holding');
    holdId = setTimeout(() => {
      lock.hidden = true;
      unlockBtn.classList.remove('holding');
    }, 2000);
  });
  const cancelHold = () => {
    clearTimeout(holdId);
    unlockBtn.classList.remove('holding');
  };
  unlockBtn.addEventListener('pointerup', cancelHold);
  unlockBtn.addEventListener('pointerleave', cancelHold);
  lock.addEventListener('contextmenu', (e) => e.preventDefault());

  // Коли вкладка ховається, Android сам зупиняє вібрацію — відновлюємо її після повернення.
  const onVisibility = () => {
    if (document.hidden) {
      clearInterval(chunkId);
      chunkId = null;
    } else {
      wake = null;
      keepAwake(level > 0);
      restart();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  onLeave(() => {
    clearInterval(chunkId);
    clearTimeout(holdId);
    if (supported) navigator.vibrate(0);
    keepAwake(false);
    document.removeEventListener('visibilitychange', onVisibility);
  });

  show();
}

GAMES.vibe = vibe;
