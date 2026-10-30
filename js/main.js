// Старт: відновлюємо гравців, рівень і вкладку з минулого разу.

state.names = store('names') || ['', ''];
state.genders = store('genders') || ['m', 'f'];
if (!Array.isArray(state.genders) || state.genders.length !== 2) state.genders = ['m', 'f'];
state.level = LEVELS[store('level')] ? store('level') : 'romantic';
state.tab = TABS.some(([key]) => key === store('tab')) ? store('tab') : 'games';

function boot() {
  if (state.level === 'wild' && !wildConsentOk) {
    confirmWildLevel(home, () => {
      state.level = 'spicy';
      store('level', 'spicy');
      home();
    });
  } else {
    home();
  }
}

if (state.names[0] && state.names[1] && store('adult')) boot();
else setup();
