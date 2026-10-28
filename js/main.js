// Старт: відновлюємо гравців, рівень і вкладку з минулого разу.

state.names = store('names') || ['', ''];
state.level = LEVELS[store('level')] ? store('level') : 'romantic';
state.tab = TABS.some(([key]) => key === store('tab')) ? store('tab') : 'games';

if (state.names[0] && state.names[1] && store('adult')) home();
else setup();
