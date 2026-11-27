'use strict';
document.getElementById('export-settings').onclick = async function () {
  this.disabled = true;
  const status = document.getElementById('export-status');
  try {
    TodayIsBackup.download(await TodayIsBackup.capture());
    status.textContent = 'Файл передан браузеру для скачивания. Сохраните его до смены папки.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    this.disabled = false;
  }
};
