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
    button.dataset.musicControl = 'launch';
    button.disabled = launching;
    return button;
  }
  function sourcePicker() {
    const sources = media.sources || [];
    const current = sources.find(source => source.id === media.sourceId);
    const group = el('div','music-sources');
    group.setAttribute('role','group');
    group.setAttribute('aria-label','Источник воспроизведения');
    const auto = btn('Автоматический выбор источника','А',() => selectSource('',''));
    auto.dataset.musicControl = 'auto';
    auto.setAttribute('aria-pressed',String(!pin));
    group.append(auto);
    if (sources.length) {
      const index = pin ? sources.indexOf(current) : -1;
      const next = sources[index < 0 ? Math.max(0,sources.indexOf(current)) : (index + 1) % sources.length];
      const label = pin && current ? 'Источник: ' + current.label + (current !== next ? '. Переключить на ' + next.label : '')
        : 'Выбрать источник: ' + next.label;
      const cycle = btn(label,'⇄',() => selectSource(next.app,next.id));
      cycle.dataset.musicControl = 'source';
      cycle.setAttribute('aria-pressed',String(Boolean(pin && current)));
      group.append(cycle);
    }
    const launch = launchButton();
    launch.textContent = '↗';
    group.append(launch);
    return group;
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
    const fraction = (slider.valueAsNumber - Number(slider.min)) / (Number(slider.max) - Number(slider.min)) || 0;
    slider.style.setProperty('--progress', (100 * fraction) + '%');
  }
  function timeline(data, commit) {
    const line = el('div','music-timeline');
    line.dataset.start = data.start;
    const slider = el('input');
    slider.type = 'range';
    slider.dataset.musicControl = 'seek';
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
  // The record runs at 33⅓ rpm, so a full turn corresponds to 1.8 seconds.
  function scrubRecord(record,line) {
    const slider = line.querySelector('input');
    let drag;
    function pointerAngle(event) {
      const x = event.clientX - drag.x, y = event.clientY - drag.y;
      return Math.hypot(x,y) < 10 ? null : Math.atan2(y,x);
    }
    record.onpointerdown = event => {
      if (drag || event.button !== 0) return;
      const box = record.getBoundingClientRect();
      drag = {id:event.pointerId, x:box.x + box.width / 2, y:box.y + box.height / 2,
        start:slider.valueAsNumber, seconds:slider.valueAsNumber, rotation:0, moved:false};
      drag.angle = pointerAngle(event);
      if (drag.angle === null) { drag = null; return; }
      line.dataset.drag = '1';
      record.dataset.scrub = 'true';
      record.setPointerCapture(event.pointerId);
    };
    record.onpointermove = event => {
      if (drag?.id !== event.pointerId) return;
      const angle = pointerAngle(event);
      if (angle === null) { drag.angle = null; return; }
      const delta = drag.angle === null ? 0 : angle - drag.angle;
      const turn = Math.atan2(Math.sin(delta),Math.cos(delta)) / (2 * Math.PI);
      drag.angle = angle;
      drag.rotation += 360 * turn;
      drag.seconds = Math.min(Number(slider.max), Math.max(Number(slider.min), drag.seconds + 1.8 * turn));
      drag.moved ||= Math.abs(drag.rotation) > 1;
      record.style.setProperty('--record-scrub', drag.rotation + 'deg');
      paint(line,drag.seconds);
    };
    function finish(event) {
      if (drag?.id !== event.pointerId) return;
      if (event.type === 'pointerup' && drag.moved) slider.onchange();
      else paint(line,drag.start);
      drag = null;
      delete line.dataset.drag;
      delete record.dataset.scrub;
      record.style.removeProperty('--record-scrub');
    }
    record.onpointerup = record.onpointercancel = record.onlostpointercapture = finish;
    record.classList.add('music-record-seek');
  }
  function trackIdentity(item) {
    return JSON.stringify([item.status,item.sourceId,item.trackKey,item.title,item.artist,item.cover]);
  }
  let changingTrack = false, renderedRevision = 0;
  function redrawMusic(fadeIn = false) {
    const focused = document.activeElement;
    const control = focused?.closest('.card[data-id="music"]') ? focused.dataset.musicControl : '';
    const oldRecord = document.querySelector('.music-record-label');
    const spin = oldRecord?.getAnimations()[0]?.currentTime;
    const wasPlaying = oldRecord?.closest('.system-track')?.dataset.playing;
    drawOne('music');
    const newRecord = document.querySelector('.music-record-label');
    const track = newRecord?.closest('.system-track');
    if (!fadeIn && spin != null && newRecord) {
      const animation = newRecord.getAnimations()[0];
      if (animation) animation.currentTime = spin;
      if (wasPlaying && wasPlaying !== track.dataset.playing) {
        const playing = track.dataset.playing === 'true';
        track.querySelector('.music-tonearm').animate(
          [{transform:playing ? 'rotate(-8deg)' : 'rotate(11deg)'},{transform:playing ? 'rotate(11deg)' : 'rotate(-8deg)'}],
          {duration:500,easing:'cubic-bezier(.77,0,.175,1)'});
      }
    }
    if (control) document.querySelector('.card[data-id="music"] [data-music-control="' + control + '"]')?.focus({preventScroll:true});
    if (fadeIn) document.querySelector('.card[data-id="music"] .inside')?.animate(
      [{opacity:0},{opacity:1}],{duration:220,easing:'cubic-bezier(0.23,1,0.32,1)'});
  }
  function update(next) {
    const {position, ...details} = next;
    const {position: previousPosition, ...previous} = media;
    const changedTrack = renderedRevision !== revision || trackIdentity(media) !== trackIdentity(next);
    media = next;
    if (changingTrack) return;
    if (changedTrack || JSON.stringify(details) !== JSON.stringify(previous)) {
      const panel = document.querySelector('.card[data-id="music"] .inside');
      if (changedTrack && panel && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        changingTrack = true;
        const fade = panel.animate([{opacity:1},{opacity:0}],{duration:120,easing:'ease-in',fill:'forwards'});
        const finish = () => {
          changingTrack = false;
          fade.cancel();
          redrawMusic(true);
        };
        fade.finished.then(finish,finish);
        return;
      }
      return redrawMusic();
    }
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
        if (queued && !changingTrack && queued.generation === next.generation) {
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
    if (!port || (action !== 'read' && (changingTrack || sentRevision !== revision))) return;
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
    renderedRevision = revision;
    start();
    if (media.status !== 'active') {
      if (media.status === 'idle') {
        if (state.track && !pin && !media.sources?.length) {
          n.append(launchButton());
          return false;
        }
        const empty = el('div','music-empty');
        if (media.sources?.length) empty.append(sourcePicker());
        else empty.append(launchButton());
        n.append(empty);
        return true;
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
    row.dataset.playing = String(Boolean(media.playing));
    const art = el('div','system-cover');
    art.setAttribute('aria-hidden','true');
    const record = el('div','music-record');
    const label = el('div','music-record-label','♫');
    record.append(label);
    art.append(record,el('span','music-tonearm'));
    if (media.cover) {
      const img = el('img');
      img.alt = '';
      img.src = media.cover;
      label.replaceChildren(img);
    }
    const body = el('div','system-track-body');
    const title = el('strong','',media.title || 'Медиаплеер');
    title.title = title.textContent;
    body.append(title);
    if (media.artist) body.append(el('span','muted',media.artist));
    const buttons = el('div','system-controls');
    const toggle = media.playing ? 'pause' : 'play';
    for (const [key,label,symbol] of [['previous','Предыдущий трек','⏮'],[toggle,media.playing?'Пауза':'Воспроизвести',media.playing?'Ⅱ':'▶'],['next','Следующий трек','⏭']]) {
      const control = btn(label,symbol,()=>send(key),key === toggle ? 'play' : '');
      control.dataset.musicControl = key === toggle ? 'playback' : key;
      control.disabled = !media[key];
      buttons.append(control);
    }
    const meter = el('div','music-meter');
    meter.setAttribute('aria-hidden','true');
    for (let i = 0; i < 5; i++) meter.append(el('i'));
    row.append(art,body,meter,buttons,sourcePicker());
    if (media.end > media.start) {
      const trackKey = media.trackKey;
      const range = timeline(media, seconds => send('seek',{seconds,trackKey}));
      row.append(range);
      if (media.seek) scrubRecord(record,range);
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

