'use strict';

const wallpaperEditor = (() => {
  const storageKey = 'todayis.wallpaperGallery';
  const legacyKey = 'todayis.deviceWallpaper';
  const activeKey = 'gntd.wallpaperActive';
  const prefix = 'gntd.wallpaperItem.';
  const imagePattern = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
  const defaults = {mirror:false, zoom:100, x:50, y:50, dark:0, blur:0, filter:'none', strength:100, parallax:false, parallaxStrength:45};
  const filters = {
    none:['Без фильтра',()=> ''],
    warm:['Тёплый',s=>`sepia(${.45*s}) saturate(${1+.25*s})`],
    cool:['Холодный',s=>`sepia(${.35*s}) hue-rotate(${185*s}deg) saturate(${1+.25*s})`],
    mono:['Чёрно-белый',s=>`grayscale(${s})`],
    sepia:['Сепия',s=>`sepia(${s})`],
    film:['Плёнка',s=>`sepia(${.24*s}) contrast(${1+.24*s}) saturate(${1-.25*s})`],
    soft:['Мягкий',s=>`contrast(${1-.22*s}) brightness(${1+.12*s})`],
    vivid:['Яркий',s=>`saturate(${1+.65*s}) contrast(${1+.12*s})`],
    muted:['Приглушённый',s=>`saturate(${1-.65*s})`]
  };
  const ranges = [
    ['zoom','Приближение',100,250,'%'],['x','Положение по горизонтали',0,100,'%'],
    ['y','Положение по вертикали',0,100,'%'],['dark','Затемнение',0,80,'%'],
    ['blur','Размытие',0,24,' пкс'],['strength','Сила фильтра',0,100,'%'],
    ['parallaxStrength','Сила параллакса',0,100,'%']
  ];
  let records = {}, legacy, draft, accountOwner;

  function adjustments(value) {
    const result = {...defaults};
    result.mirror = value?.mirror === true;
    result.parallax = value?.parallax === true;
    if (Object.hasOwn(filters,value?.filter)) result.filter = value.filter;
    for (const [key,,min,max] of ranges) {
      if (Number.isFinite(value?.[key])) result[key] = Math.max(min,Math.min(max,value[key]));
    }
    return result;
  }

  function source(item) {
    if (typeof item?.image === 'string' && imagePattern.test(item.image)) return item.image;
    if (item?.wall && Object.hasOwn(wallpaperNames,item.wall)) return 'wallpapers/'+item.wall+'.svg';
    return url(item?.wall);
  }

  function current() {
    if (Object.hasOwn(records,activeKey)) return records[prefix+records[activeKey]];
    if (legacy) return {...legacy,id:'legacy'};
    return state.wall ? {id:state.wall,wall:state.wall} : undefined;
  }

  function image() { return source(draft?.item ?? current()); }

  const scenes = new Map();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let moving, pointer = {x:0,y:0}, motionFrame = 0;

  async function horizonLayers(address) {
    const response = await fetch(address);
    if (!response.ok) return null;
    const svg = new DOMParser().parseFromString(await response.text(),'image/svg+xml').documentElement;
    const front = svg.querySelector('#wallpaper-foreground');
    if (!front) return null;
    const foreground = svg.cloneNode(false);
    foreground.append(front);
    const data = node=>'data:image/svg+xml,'+encodeURIComponent(new XMLSerializer().serializeToString(node));
    return {background:data(svg),foreground:data(foreground)};
  }

  function getScene(address) {
    const cached = scenes.get(address);
    if (cached) return cached;
    const scene = {layers:null, pending:true};
    if (scenes.size===2) scenes.delete(scenes.keys().next().value);
    scenes.set(address,scene);
    const prepare = address==='wallpapers/horizon.svg' ? horizonLayers : wallpaperDepth.prepare;
    prepare(address).then(layers=>{scene.layers=layers}).catch(()=>{}).finally(()=>{
      scene.pending = false;
      if (image()===address) draw();
    });
    return scene;
  }

  function paintMotion() {
    motionFrame = 0;
    if (!moving) return;
    const {stage,strength,mirror} = moving;
    const amount = Math.min(12,Math.min(innerWidth,innerHeight)*.02)*strength/100;
    stage.style.setProperty('--parallax-x',pointer.x*amount*(mirror?-1:1)+'px');
    stage.style.setProperty('--parallax-y',pointer.y*amount+'px');
  }

  function resetPointer() {
    pointer = {x:0,y:0};
    if (!motionFrame && moving) motionFrame = requestAnimationFrame(paintMotion);
  }

  window.addEventListener('pointermove',event=>{
    if (!moving || event.pointerType==='touch') return;
    pointer = {x:2*event.clientX/innerWidth-1,y:2*event.clientY/innerHeight-1};
    if (!motionFrame) motionFrame = requestAnimationFrame(paintMotion);
  },{passive:true,capture:true});
  window.addEventListener('pointerout',event=>{ if (!event.relatedTarget) resetPointer(); },{passive:true});
  window.addEventListener('blur',resetPointer);
  window.addEventListener('resize',resetPointer);
  reducedMotion.addEventListener('change',draw);

  function drawParallax(background,address,settings) {
    const scene = settings.parallax && address && !reducedMotion.matches ? getScene(address) : null;
    const layers = scene?.layers;
    const enabled = Boolean(layers && settings.parallaxStrength);
    draft?.updateParallax?.(scene);
    let stage = background.firstElementChild;
    if (!enabled) {
      if (stage) stage.hidden = true;
      if (moving) resetPointer();
      moving = null;
      return false;
    }
    if (!stage) {
      stage = el('div');
      stage.id = 'wallpaper-parallax';
      stage.append(el('div','wallpaper-parallax-background'),el('div','wallpaper-parallax-foreground'));
      background.append(stage);
    }
    if (stage.scene !== scene) {
      stage.firstElementChild.style.backgroundImage = 'url('+JSON.stringify(layers.background)+')';
      stage.lastElementChild.style.backgroundImage = 'url('+JSON.stringify(layers.foreground)+')';
      stage.scene = scene;
      pointer = {x:0,y:0};
    }
    stage.hidden = false;
    moving = {stage,strength:settings.parallaxStrength,mirror:settings.mirror};
    if (!motionFrame) motionFrame = requestAnimationFrame(paintMotion);
    return true;
  }


  function draw() {
    const background = document.getElementById('wallpaper-image');
    const settings = adjustments((draft?.item ?? current())?.settings);
    const address = image();
    const layered = drawParallax(background,address,settings);
    background.style.backgroundImage = address && !layered ? 'url('+JSON.stringify(address)+')' : '';
    background.style.backgroundPosition = (settings.mirror ? 100-settings.x : settings.x)+'% '+settings.y+'%';
    const zoom = settings.zoom/100 * (1+settings.blur/110);
    background.style.transform = `translate(${(50-settings.x)*(zoom-1)}%, ${(50-settings.y)*(zoom-1)}%) scale(${zoom*(settings.mirror?-1:1)}, ${zoom})`;
    background.style.filter = [`blur(${settings.blur}px)`,filters[settings.filter][1](settings.strength/100)].join(' ');
    background.parentElement.style.setProperty('--wallpaper-dark',address ? settings.dark/100 : 0);
  }

  function pick(data) {
    return Object.fromEntries(Object.entries(data ?? {}).filter(([key])=>key===activeKey || key.startsWith(prefix)));
  }

  async function load(account,isCurrent) {
    const local = await chrome.storage.local.get([storageKey,legacyKey]);
    if (!isCurrent()) return false;
    const next = account ? pick(account.data) : local[storageKey] ?? {};
    const changed = JSON.stringify(next)!==JSON.stringify(records) || account?.owner!==accountOwner ||
      local[legacyKey]?.image!==legacy?.image;
    if (draft && account?.owner!==accountOwner) {
      draft = null;
      if (dialog.open && activeDialog==='wallpaper-editor') dialog.close();
    }
    records = next;
    legacy = local[legacyKey];
    accountOwner = account?.owner;
    return changed;
  }

  function checkSize(data) {
    if (new TextEncoder().encode(JSON.stringify(pick(data))).length > 350*1024)
      throw Error('Галерея заполнена. Удалите одно из фото и попробуйте снова.');
    if (new TextEncoder().encode(JSON.stringify(snapshot(data))).length > 512*1024)
      throw Error('В облачном профиле недостаточно места для обоев.');
  }

  async function save(set,remove=[],expectedOwner=accountOwner) {
    await cloudLock(async()=>{
      const account = await cloudAccount();
      if (account?.owner!==expectedOwner) throw Error('Профиль изменился. Откройте настройки обоев снова.');
      const data = account?.data ?? (await chrome.storage.local.get(storageKey))[storageKey] ?? {};
      const next = {...data,...set};
      for (const key of remove) delete next[key];
      checkSize(next);
      if (account) await writeDashboard(account,set,remove);
      else await chrome.storage.local.set({[storageKey]:next});
    });
    await refresh();
  }

  async function prepare(file, name=file.name) {
    const address = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = address;
      try { await image.decode(); }
      catch { throw Error('Не удалось открыть фото. Выберите JPG, PNG или WebP.'); }
      const canvas = el('canvas');
      let size = Math.min(1,1920/Math.max(image.naturalWidth,image.naturalHeight));
      while (size > 0) {
        canvas.width = Math.max(1,Math.round(image.naturalWidth*size));
        canvas.height = Math.max(1,Math.round(image.naturalHeight*size));
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        const encoded = canvas.toDataURL('image/webp',.8);
        if (encoded.length <= 105*1024) return {id:crypto.randomUUID(),name:String(name).slice(0,150),image:encoded};
        size *= .8;
      }
      throw Error('Не удалось подготовить фото.');
    } finally {
      URL.revokeObjectURL(address);
    }
  }

  async function fromLegacy(photo) {
    return {...await prepare(await (await fetch(photo.image)).blob(),photo.name),id:'legacy'};
  }

  async function localImport() {
    const local = await chrome.storage.local.get([storageKey,legacyKey]);
    const data = pick(local[storageKey]);
    if (local[legacyKey] && !Object.hasOwn(data,activeKey)) {
      const item = await fromLegacy(local[legacyKey]);
      data[prefix+item.id] = item;
      data[activeKey] = item.id;
    }
    return data;
  }

  async function mergeLocal(account) {
    const data = await localImport();
    if (account.data['gntd.wall'] && !Object.hasOwn(account.data,activeKey))
      delete data[activeKey];
    const set = Object.fromEntries(Object.entries(data).filter(([key])=>!Object.hasOwn(account.data,key)));
    if (!Object.keys(set).length) return;
    checkSize({...account.data,...set});
    await writeDashboard(account,set,[]);
  }

  async function migrateLegacy(account) {
    if (Object.hasOwn(account.data,activeKey)) return;
    const photo = (await chrome.storage.local.get(legacyKey))[legacyKey];
    if (!photo) return;
    const item = await fromLegacy(photo);
    const set = {[activeKey]:item.id,[prefix+item.id]:item};
    checkSize({...account.data,...set});
    await writeDashboard(account,set,[]);
  }

  async function select(item) {
    try {
      const set = {[activeKey]:item?.id ?? ''};
      if (item && !records[prefix+item.id]) set[prefix+item.id] = item;
      await save(set);
    } catch(error) { toast(error.message); }
  }

  async function link(value) {
    const wall = url(value);
    if (!wall) return toast('Введите адрес HTTP или HTTPS');
    const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(wall));
    const id = 'url-'+Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
    edit(records[prefix+id] ?? {id,wall});
  }

  function fieldsForSettings() {
    const selected = current();
    const section = el('section','wallpaper-section');
    const custom = el('form','settings-url');
    const address = input(url(selected?.wall),'url');
    address.required = true;
    address.placeholder = 'https://…';
    const label = el('label','field','Ссылка на обои');
    label.append(address);
    const openLink = el('button','','Открыть в редакторе');
    openLink.type = 'submit';
    custom.append(label,openLink);
    custom.onsubmit = event=>{event.preventDefault();link(address.value).catch(error=>toast(error.message))};

    const choices = el('select');
    choices.id = 'settings-wallpaper';
    const options = [...Object.entries(wallpaperNames),['custom','По ссылке']];
    if (selected?.image) options.push(['photo','Фото из галереи']);
    for (const [id,name] of options) {
      const option = el('option','',name);
      option.value = id;
      choices.append(option);
    }
    const value = selected?.image ? 'photo' : url(selected?.wall) ? 'custom' : selected?.wall ?? '';
    choices.value = value;
    custom.hidden = value!=='custom';
    choices.onchange = ()=>{
      const id = choices.value;
      custom.hidden = id!=='custom';
      if (id==='custom') address.focus();
      else if (id!=='photo') select(id ? records[prefix+id] ?? {id,wall:id} : null);
    };
    const sourceLabel = el('label','field','Обои');
    sourceLabel.append(choices);
    section.append(sourceLabel,custom);
    if (source(selected)) section.append(btn('Редактировать обои','Редактировать обои',()=>edit(selected),'wallpaper-edit'));

    const title = el('h4','','Галерея фото');
    const picker = el('input','wallpaper-file');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.setAttribute('aria-label','Добавить фото');
    const upload = el('label','wallpaper-add');
    upload.append(picker,el('span','','Добавить фото'));
    picker.onchange = async()=>{
      const file = picker.files[0];
      if (!file) return;
      const owner = accountOwner;
      picker.disabled = true;
      try {
        const item = await prepare(file);
        if (picker.isConnected && owner===accountOwner) edit(item);
      } catch(error) { toast(error.message); }
      finally { picker.value=''; picker.disabled=false; }
    };
    section.append(title,upload);

    const photos = Object.values(records).filter(item=>item?.image && source(item));
    if (legacy && !records[prefix+'legacy'] && (!accountOwner || !Object.hasOwn(records,activeKey))) photos.unshift({...legacy,id:'legacy'});
    if (photos.length) {
      const gallery = el('div','wallpaper-gallery');
      for (const item of photos) {
        const row = el('div','wallpaper-photo');
        const active = item.id===selected?.id;
        const choose = btn('Выбрать фото '+item.name,'',()=>edit(item),'wallpaper-photo-choice');
        choose.setAttribute('aria-pressed',String(active));
        const thumbnail = el('img');
        thumbnail.src = source(item);
        thumbnail.alt = '';
        choose.append(thumbnail,el('span','',item.name || 'Фото'));
        row.append(choose);
        if (!active && records[prefix+item.id]) row.append(btn('Удалить фото '+item.name,'Удалить',async()=>{
          try {
            await save({},[prefix+item.id]);
            if (item.id==='legacy' && !accountOwner) await chrome.storage.local.remove(legacyKey);
          }
          catch(error) { toast(error.message); }
        }));
        gallery.append(row);
      }
      section.append(gallery);
    }
    fields.append(section);
  }

  function repaint() {
    draw();
    if (typeof updateAccent==='function') updateAccent();
  }

  function cancel() {
    if (!draft) return;
    draft = null;
    repaint();
  }

  function edit(item) {
    if (!source(item)) return;
    const owner = accountOwner;
    const initial = adjustments(item.settings);
    const session = {item:{...item,settings:initial}};
    draft = session;
    modal('Редактор обоев','wallpaper-editor');
    const form = el('form','wallpaper-controls');
    const mirror = input('','checkbox');
    mirror.checked = initial.mirror;
    const mirrorLabel = el('label','wallpaper-mirror','Отразить по горизонтали');
    mirrorLabel.prepend(mirror);
    const select = el('select');
    for (const [key,[label]] of Object.entries(filters)) {
      const option = el('option','',label);
      option.value = key;
      select.append(option);
    }
    const filterLabel = el('label','field','Цветовой фильтр');
    filterLabel.append(select);
    const sliders = new Map();
    const parallax = input('','checkbox');
    const parallaxLabel = el('label','wallpaper-mirror','Параллакс');
    parallaxLabel.prepend(parallax);
    const parallaxStatus = el('p','wallpaper-parallax-status');
    parallaxStatus.setAttribute('role','status');
    const parallaxOptions = el('div','wallpaper-parallax-options');
    parallaxOptions.append(parallaxStatus);
    form.append(mirrorLabel,parallaxLabel,parallaxOptions,filterLabel);
    for (const [key,label,min,max,unit] of ranges) {
      const slider = input('','range');
      slider.min = min;
      slider.max = max;
      const output = el('span','wallpaper-value');
      output.setAttribute('aria-hidden','true');
      slider.setAttribute('aria-label',label);
      const row = el('label','wallpaper-slider');
      row.append(el('span','',label),output,slider);
      sliders.set(key,{slider,output,unit});
      (key==='parallaxStrength' ? parallaxOptions : form).append(row);
    }
    session.updateParallax = scene=>{
      const requested = session.item.settings.parallax;
      const reduced = reducedMotion.matches;
      const status = reduced ? 'Анимация отключена системной настройкой уменьшения движения.'
        : scene?.pending ? 'Анализируем фото…'
        : scene?.layers ? 'Подвигайте курсором, чтобы увидеть глубину.'
        : 'Передний план не удалось выделить. Фото останется статичным.';
      parallaxOptions.hidden = !requested;
      if (requested && parallaxStatus.textContent!==status) parallaxStatus.textContent = status;
      const strength = sliders.get('parallaxStrength').slider;
      strength.disabled = !requested || !(scene?.layers || reduced);
    };
    function update() {
      const next = session.item.settings;
      mirror.checked = next.mirror;
      parallax.checked = next.parallax;
      select.value = next.filter;
      for (const [key,{slider,output,unit}] of sliders) {
        slider.value = next[key];
        output.textContent = next[key]+unit;
        slider.setAttribute('aria-valuetext',output.textContent);
      }
      sliders.get('strength').slider.disabled = next.filter==='none';
      repaint();
    }
    form.oninput = ()=>{
      session.item.settings = {mirror:mirror.checked,filter:select.value,parallax:parallax.checked};
      for (const [key,{slider}] of sliders) session.item.settings[key] = slider.valueAsNumber;
      update();
    };
    const reset = btn('Сбросить настройки','Сбросить настройки',()=>{ session.item.settings={...defaults}; update(); });
    const back = btn('Отмена','Отмена',()=>{ cancel(); showSettings('appearance','#settings-wallpaper'); });
    reset.type = back.type = 'button';
    const apply = el('button','wallpaper-apply','Применить');
    apply.type = 'submit';
    const actions = el('div','wallpaper-actions');
    actions.append(reset,back,apply);
    form.append(actions);
    form.onsubmit = async event=>{
      event.preventDefault();
      if (form.inert) return;
      form.inert = true;
      try {
        if (item.id==='legacy') {
          const converted = await fromLegacy(item);
          session.item = {...converted,settings:session.item.settings};
        }
        if (draft!==session) return;
        await save({[activeKey]:item.id,[prefix+item.id]:session.item},[],owner);
        if (draft===session) {
          cancel();
          showSettings('appearance','#settings-wallpaper');
        }
      } catch(error) { toast(error.message); }
      finally { form.inert = false; }
    };
    fields.append(form);
    const hint = el('p','wallpaper-hint','Изменения видны за виджетами и сохраняются после применения.');
    form.prepend(hint);
    update();
    mirror.focus();
  }

  return {storageKey,legacyKey,activeKey,prefix,pick,image,draw,load,localImport,mergeLocal,migrateLegacy,fieldsForSettings,cancel};
})();
