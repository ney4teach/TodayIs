const systemMusic = (() => {
  let port, timer, queued, pending = false;
  let media = {status: 'connecting'};
  const pinKey = 'gntd-music-pinned-app';
  let pin = localStorage.getItem(pinKey) || '', handle = '', revision = 0, sentRevision = 0;
  function selectSource(app, id) {
    pin = app;
    handle = id;
    revision++;
    queued = null;
    if (pin) localStorage.setItem(pinKey,pin);
    else localStorage.removeItem(pinKey);
    if (!pending) schedule(0);
  }
  window.addEventListener('storage', event => {
    if (event.key === pinKey) selectSource(event.newValue || '', '');
  });
  let launching = false;
  async function launchYandex() {
    if (launching) return;
    launching = true;
    drawOne('music');
    try {
      const reply = await chrome.runtime.sendNativeMessage('gntd.media',{action:'launchYandex'});
      if (reply?.app) selectSource(reply.app,'');
      toast(reply?.message || reply?.detail || 'Обновите компонент через media-host/install.cmd');
    } catch {
      toast('Для запуска подключите компонент через media-host/install.cmd');
    } finally {
      launching = false;
      drawOne('music');
    }
  }
  function launchButton() {
    const label = launching ? 'Запускаем…' : 'Включить Яндекс Музыку';
    const button = btn(label,label,launchYandex);
    button.disabled = launching;
    return button;
  }
  function sourcePicker() {
    const select = el('select','music-source');
    select.setAttribute('aria-label','Источник воспроизведения');
    select.title = 'Выбрать и закрепить источник';
    const sources = media.sources || [];
    const active = sources.find(s => s.id === media.sourceId);
    select.add(new Option(active && !pin ? 'Авто · ' + active.label : 'Автоматически',''));
    for (const source of sources) select.add(new Option(source.label,source.id));
    if (pin && !active) {
      select.add(new Option('Выберите источник','waiting'));
      select.lastChild.disabled = true;
    }
    select.add(new Option('Включить Яндекс Музыку','launch-yandex'));
    select.value = pin ? active?.id || 'waiting' : '';
    select.onchange = () => {
      if (select.value === 'launch-yandex') { launchYandex(); return; }
      const source = sources.find(s => s.id === select.value);
      selectSource(source?.app || '',source?.id || '');
    };
    return select;
  }
  function clock(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2,'0');
  }
  function paint(line, seconds) {
    const slider = line.querySelector('input');
    slider.value = seconds;
    const display = clock(seconds - Number(line.dataset.start));
    line.querySelector('output').textContent = display;
    slider.setAttribute('aria-valuetext',display);
    const fraction = (slider.valueAsNumber - Number(slider.min)) / (Number(slider.max) - Number(slider.min));
    slider.style.setProperty('--progress', (100 * fraction) + '%');
  }
  function timeline(data, commit) {
    const line = el('div','music-timeline');
    line.dataset.start = data.start;
    const slider = el('input');
    slider.type = 'range';
    slider.min = data.seek ? data.lower : data.start;
    slider.max = data.seek ? data.upper : data.end;
    slider.step = 'any';
    slider.disabled = !data.seek;
    slider.setAttribute('aria-label','Позиция воспроизведения');
    line.append(el('output'),slider,el('span','',clock(data.end - data.start)));
    slider.onpointerdown = () => { line.dataset.drag = '1'; };
    slider.onpointerup = slider.onpointercancel = slider.onblur = () => { delete line.dataset.drag; };
    slider.oninput = () => paint(line,slider.valueAsNumber);
    slider.onchange = () => commit(slider.valueAsNumber);
    paint(line,data.position);
    return line;
  }
  function update(next) {
    const {position, ...details} = next;
    const {position: previousPosition, ...previous} = media;
    media = next;
    if (JSON.stringify(details) !== JSON.stringify(previous)) return drawOne('music');
    const line = document.querySelector('.system-track .music-timeline');
    if (line && !line.dataset.drag && position !== previousPosition) paint(line,position);
  }
  function stop() {
    clearTimeout(timer);
    timer = null;
    if (port) port.disconnect();
    handle = '';
    queued = null;
    port = null;
    pending = false;
  }
  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(poll, delay);
  }
  function poll() {
    if (document.hidden || !document.querySelector('.card[data-id="music"]')) return stop();
    if (!port) {
      const connection = chrome.runtime.connectNative('gntd.media');
      port = connection;
      connection.onMessage.addListener(next => {
        if (connection !== port) return;
        pending = false;
        if (sentRevision !== revision) { schedule(0); return; }
        if (pin && next.sourceId) handle = next.sourceId;
        if (pin && next.sources && !next.sources.some(s => s.app === pin)) handle = '';
        if (next.accepted === false) toast('Плеер отклонил команду');
        update(next);
        if (queued && queued.generation === next.generation) {
          const {action, payload} = queued;
          queued = null;
          send(action, payload);
        } else {
          queued = null;
          schedule(1200);
        }
      });
      connection.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        if (connection !== port) return;
        queued = null;
        handle = '';
        port = null;
        pending = false;
        update({status: 'offline'});
        schedule(15000);
      });
    }
    send('read');
  }
  function send(action, payload = {}) {
    if (!port || (action !== 'read' && sentRevision !== revision)) return;
    if (pending) {
      if (action !== 'read') queued = {action, payload, generation: media.generation};
      return;
    }
    clearTimeout(timer);
    pending = true;
    sentRevision = revision;
    port.postMessage({action, pin, handle, ...payload, generation: media.generation});
  }
  function start() {
    if (!document.hidden && !port && timer == null) schedule(0);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else schedule(0);
  });
  window.addEventListener('pagehide', stop);

  function render(n) {
    start();
    const card = n.closest('.card');
    const tinted = media.status === 'active' && state.musicTint !== false && /^#[0-9a-f]{6}$/i.test(media.tint);
    card.classList.toggle('music-tinted',!!tinted);
    if (tinted) card.style.setProperty('--cover-color',media.tint);
    else card.style.removeProperty('--cover-color');
    if (media.status !== 'active') {
      if (pin && media.status === 'idle') {
        n.append(el('span','muted','Закреплённый источник недоступен'),sourcePicker());
        return true;
      }
      if (media.status === 'idle') {
        n.append(launchButton());
        return !state.track;
      }
      if (state.track) return false;
      const labels = { idle: 'Сейчас ничего не играет', connecting: 'Ищем плеер…',
        offline: 'Подключить плееры Windows', error: media.detail || 'Системный плеер недоступен' };
      n.append(media.status === 'offline'
        ? btn(labels.offline, labels.offline, musicSettings)
        : el('span','muted',labels[media.status]));
      return true;
    }
    const row = el('div','system-track');
    const art = el('div','system-cover','♫');
    if (media.cover) {
      const img = el('img');
      img.alt = '';
      img.src = media.cover;
      art.replaceChildren(img);
    }
    const body = el('div','system-track-body');
    const title = el('strong','',media.title || 'Медиаплеер');
    title.title = title.textContent;
    body.append(title);
    if (media.artist) body.append(el('span','muted',media.artist));
    const buttons = el('div','system-controls');
    const toggle = media.playing ? 'pause' : 'play';
    for (const [key,label,symbol] of [['previous','Предыдущий трек','⏮'],[toggle,media.playing?'Пауза':'Воспроизвести',media.playing?'Ⅱ':'▶'],['next','Следующий трек','⏭']]) {
      if (media[key]) buttons.append(btn(label,symbol,()=>send(key),key === toggle ? 'play' : ''));
    }
    if (media.sources) buttons.append(sourcePicker());
    body.append(buttons);
    row.append(art,body);
    if (media.end > media.start) {
      const trackKey = media.trackKey;
      row.append(timeline(media, seconds => send('seek',{seconds,trackKey})));
    }
    n.append(row);
    return true;
  }
  function localTimeline(n) {
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    const line = timeline({start:0,lower:0,upper:audio.duration,end:audio.duration,position:audio.currentTime,seek:true},
      seconds => { audio.currentTime = seconds; });
    line.classList.add('local-timeline');
    n.append(line);
  }
  return {render,localTimeline,paint};
})();

