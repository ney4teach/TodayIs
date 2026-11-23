'use strict';

const webDashboardKey = 'todayis.dashboard';

async function cloudAccount() { return undefined; }

function dashboardData() {
  try {
    return JSON.parse(localStorage.getItem(webDashboardKey)) || {};
  } catch {
    return {};
  }
}

function writeDashboard(_account, set, remove) {
  if (!Object.keys(set).length && !remove.length) return;
  const data = Object.assign(dashboardData(), set);
  for (const key of remove) delete data[key];
  localStorage.setItem(webDashboardKey, JSON.stringify(data));
}

window.addEventListener('storage', event => {
  if (event.key === webDashboardKey) refresh().catch(() => toast('Ошибка чтения настроек'));
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./mobile-worker.js').catch(error => {
    console.warn('Не удалось включить офлайн-режим Today Is', error);
  });
}
