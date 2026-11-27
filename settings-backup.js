'use strict';

// Shared with the one-time exporter for installations that predate the backup buttons.
const TodayIsBackup = (() => {
  const limit = 15 * 1024 * 1024;
  const accountKey = 'gntdCloudProfile';
  const deviceKeys = ['todayis.deviceWallpaper', 'todayIsLayouts'];
  const historyKey = 'todayis.searchHistory';
  const types = {
    widgetScale:'number', bookmarkSource:'string', bookmarkFolder:'string', clock:'object',
    order:'array', hidden:'array', tiles:'object', theme:'string', wall:'string', engine:'string',
    alignX:'string', alignY:'string', manage:'boolean', musicTint:'boolean', track:'string',
    trackName:'string', quote:'object', weather:'object', accentMode:'string', accentColor:'string',
    positions:'object', weatherCity:'string'
  };
  const recordTypes = ['tasks','events','cities','linkCategories','siteTiles'];
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const pick = (data, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(data,key)).map(key => [key,data[key]]));
  const dashboard = data => Object.fromEntries(Object.entries(data).filter(([key]) => key.startsWith('gntd.')));
  const fail = () => { throw Error('Это не поддерживаемый файл настроек Today Is'); };

  function validate(backup) {
    if (!object(backup) || backup.format !== 'todayis-settings' || backup.version !== 1 ||
        !object(backup.dashboard) || !object(backup.local) ||
        !Array.isArray(backup.searchHistory) || backup.searchHistory.length > 20 ||
        backup.searchHistory.some(item => typeof item !== 'string' || item.length > 10000)) fail();
    function safe(value, depth = 0) {
      if (depth > 30) fail();
      if (value && typeof value === 'object') for (const [key,child] of Object.entries(value)) {
        if (['__proto__','prototype','constructor'].includes(key)) fail();
        safe(child,depth+1);
      }
    }
    safe(backup);
    for (const [key,value] of Object.entries(backup.dashboard)) {
      const [prefix,type,id,...rest] = key.split('.');
      if (prefix !== 'gntd' || rest.length || !type) fail();
      if (recordTypes.includes(type)) {
        if (!id || !/^[\w-]+$/.test(id) || !object(value) || value.id !== id) fail();
      } else {
        if (id || !Object.hasOwn(types,type)) fail();
        if (types[type] === 'array' ? !Array.isArray(value) : types[type] === 'object' ? !object(value) : typeof value !== types[type]) fail();
      }
    }
    if (Object.keys(backup.local).some(key => !deviceKeys.includes(key))) fail();
    const photo = backup.local['todayis.deviceWallpaper'];
    if (photo !== undefined && (!object(photo) || typeof photo.name !== 'string' ||
        typeof photo.image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo.image))) fail();
    const layouts = backup.local.todayIsLayouts;
    if (layouts !== undefined && (!Array.isArray(layouts) || layouts.length > 3 || layouts.some(slot => slot !== null && !object(slot)))) fail();
    // Exercise the installed version's normalizers before any storage mutation.
    if (typeof unpack === 'function') {
      unpack(backup.dashboard);
      for (const slot of layouts || []) if (slot) normalize(slot);
    }
    return backup;
  }

  async function capture() {
    const local = await chrome.storage.local.get(null);
    const data = local[accountKey]?.data ?? await chrome.storage.sync.get(null);
    let history = [];
    try { history = JSON.parse(localStorage.getItem(historyKey) || '[]'); } catch {}
    return parse(JSON.stringify({format:'todayis-settings', version:1, createdAt:new Date().toISOString(),
      extensionVersion:chrome.runtime.getManifest().version, dashboard:dashboard(data),
      local:pick(local,deviceKeys), searchHistory:Array.isArray(history) ? history.filter(v=>typeof v==='string').slice(0,20) : []}));
  }

  function parse(text) {
    if (new TextEncoder().encode(text).length > limit) throw Error('Файл больше 15 МБ');
    try { return validate(JSON.parse(text)); }
    catch { throw Error('Не удалось прочитать конфиг. Выберите JSON-файл настроек Today Is'); }
  }

  async function replace(area, before, next, keys) {
    if (Object.keys(next).length) await area.set(next);
    const remove = keys.filter(key => Object.hasOwn(before,key) && !Object.hasOwn(next,key));
    if (remove.length) await area.remove(remove);
  }

  async function restore(value) {
    const incoming = parse(JSON.stringify(value));
    return navigator.locks.request('todayis.deviceWallpaper', () =>
      navigator.locks.request('today-is-layout-slots', () =>
        navigator.locks.request('gntd-write', async () => {
          const local = await chrome.storage.local.get(null);
          const account = local[accountKey];
          const before = account?.data ?? await chrome.storage.sync.get(null);
          const oldHistory = localStorage.getItem(historyKey);
          const next = {...Object.fromEntries(Object.entries(before).filter(([key])=>!key.startsWith('gntd.'))),...incoming.dashboard};
          const nextLocal = {...incoming.local, ...(account ? {[accountKey]:{...account,data:next}} : {})};
          const localKeys = [...deviceKeys,...(account ? [accountKey] : [])];
          try {
            await replace(chrome.storage.local,local,nextLocal,localKeys);
            if (!account) await replace(chrome.storage.sync,before,next,Object.keys(before).filter(key=>key.startsWith('gntd.')));
            localStorage.setItem(historyKey,JSON.stringify(incoming.searchHistory));
          } catch (error) {
            try {
              await replace(chrome.storage.local,nextLocal,pick(local,localKeys),localKeys);
              if (!account) await replace(chrome.storage.sync,next,before,Object.keys(next).filter(key=>key.startsWith('gntd.')));
              if (oldHistory === null) localStorage.removeItem(historyKey); else localStorage.setItem(historyKey,oldHistory);
            } catch { throw Error('Не удалось восстановить предыдущие настройки. Сохраните файлы конфигурации и повторите загрузку'); }
            throw Error('Настройки не загружены. Предыдущее состояние восстановлено. ' + error.message);
          }
          if (account) scheduleCloud();
        })));
  }

  function download(backup, suffix = '') {
    const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = 'TodayIs-settings-' + new Date().toISOString().slice(0,10) + suffix + '.json';
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(href),60000);
  }
  return {capture,parse,restore,download,limit};
})();

function backupFields(section) {
  const box = el('div','settings-backup');box.id='settings-backup';box.tabIndex=-1;
  box.append(el('h3','','Настройки в файле'),el('p','muted','Сохраните оформление, виджеты, смены, закладки, обои и раскладки. Работает без входа в аккаунт.'));
  const actions = el('div','backup-actions');
  const status = el('small',''); status.setAttribute('role','status');
  const save = btn('Скачать настройки','↓ Скачать настройки',async()=>{
    save.disabled=true;
    try { TodayIsBackup.download(await TodayIsBackup.capture()); status.textContent='Файл передан браузеру для скачивания'; }
    catch(e) { status.textContent=e.message; }
    finally { save.disabled=false; }
  });
  const picker = el('input'); picker.type='file'; picker.accept='.json,application/json'; picker.hidden=true;
  const load = btn('Загрузить с ПК','↑ Загрузить с ПК',()=>{picker.value='';picker.click()});
  picker.onchange=async()=>{
    const file=picker.files?.[0]; if(!file)return;
    try {
      if(file.size>TodayIsBackup.limit)throw Error('Файл больше 15 МБ');
      const backup=TodayIsBackup.parse(await file.text());
      box.replaceChildren(el('h3','','Загрузить настройки?'),el('p','','Оформление и данные виджетов будут заменены настройками из файла «'+file.name+'». Перед заменой скачаем резервную копию текущего состояния. Если вы вошли в аккаунт, изменения также синхронизируются с облаком.'));
      const confirm=btn('Заменить настройки','Загрузить и применить',async()=>{
        confirm.disabled=true; cancel.disabled=true;
        try {
          TodayIsBackup.download(await TodayIsBackup.capture(),'-before-import');
          await TodayIsBackup.restore(backup);
          location.reload();
        } catch(e) { status.textContent=e.message; confirm.disabled=false; cancel.disabled=false; }
      });
      const cancel=btn('Отменить загрузку','Отмена',()=>{box.remove();backupFields(section)});
      box.append(confirm,cancel,status);cancel.focus();
    }catch(e){status.textContent=e.message;}
  };
  actions.append(save,load);box.append(actions,picker,status,el('small','muted','Вход в аккаунт и подключение музыкального приложения на новом устройстве настраиваются отдельно.'));
  section.append(box);
}
