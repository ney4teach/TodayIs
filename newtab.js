'use strict';
const $ = s => document.querySelector(s);
const board = $('#board'), dialog = $('#dialog'), fields = $('#fields');
const names = {greeting:'Приветствие',clock:'Часы',search:'Поиск',weather:'Погода',bookmarks:'Закладки',calendar:'Календарь',tasks:'Задачи',quote:'Цитата',music:'Музыка',system:'Система'};
const ids = Object.keys(names), widths = {xs:1,sm:2,md:3,lg:4,xl:6}, gap = 16, rows = 5;
const engines = {Google:'https://www.google.com/search?q=',Яндекс:'https://yandex.ru/search/?text=',DuckDuckGo:'https://duckduckgo.com/?q='};
const quotes = ['Большие дела начинаются с маленького шага.','Оставь сегодня место для любопытства.','Иногда лучшая идея приходит во время прогулки.','Даже короткая пауза помогает увидеть больше.','У каждого дела есть первый черновик.','Найди время для того, что хочется запомнить.'];
const paths={engineGoogle:'M20 12h-8m8 0v2a8 8 0 1 1-2.4-7.7',engineYandex:'M15.5 21V3H12a4.5 4.5 0 0 0 0 9h3.5M12 12l-5 9',engineDuck:'M8 20l2-5a5 5 0 1 1 7.5-4.3l3 1.3-3.5 2-2 .2L17 20M13.8 9h.1',engineCheck:'m5 12 4 4L19 6',searchChevron:'m6 9 6 6 6-6',searchMic:'M9 9V5a3 3 0 0 1 6 0v4a3 3 0 0 1-6 0z M5 9a7 7 0 0 0 14 0m-7 7v5m-3 0h6',searchArrow:'M4 12h15m-6-6 6 6-6 6',appearance:'M12 3a9 9 0 1 0 0 18c3 0 3-2 2-3s-1-3 1-3h2a5 5 0 0 0 4-5c0-4-4-7-9-7z M7 11h.1 M10 7h.1 M15 8h.1',account:'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21a8 8 0 0 1 16 0',clock:'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',weather:'M6 18a5 5 0 0 1 0-10 7 7 0 0 1 13 2 4 4 0 0 1 0 8Z',bookmarks:'M6 4h12v17l-6-4-6 4Z',calendar:'M3 6h18v15H3z M3 10h18 M7 3v5m10-5v5',tasks:'M3 6l2 2 3-4m3 3h10 M3 15l2 2 3-4m3 3h10',quote:'M4 11h6v7H3v-6q0-5 6-7 M15 11h6v7h-7v-6q0-5 6-7',music:'M9 17V6l11-3v12 M9 17a3 2 0 1 1-6 0 3 2 0 0 1 6 0 M20 15a3 2 0 1 1-6 0 3 2 0 0 1 6 0',system:'M6 6h12v12H6z M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',manage:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',sort:'M3 5h17M3 11h12M3 17h6m8-3 3 4 3-4m-3-5v9',settings:'M4 6h16M4 12h16M4 18h16 M9 3v6m7 0v6m-8 0v6'};
function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n}
function icon(key){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [k,v] of Object.entries({viewBox:'0 0 24 24',class:'ico',fill:'none',stroke:'currentColor','stroke-width':1.6,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':true}))n.setAttribute(k,v);const p=document.createElementNS(n.namespaceURI,'path');p.setAttribute('d',paths[key]);n.append(p);return n}
function btn(label,txt,fn,cls=''){const b=el('button',cls,txt);b.type='button';b.title=label;b.setAttribute('aria-label',label);b.onclick=fn;return b}
function link(label,url){const a=el('a','',label);a.href=url;return a}
function url(v){try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
function one(v,options,d){return options.includes(v)?v:d}
function day(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function defaults(id){return {size:['greeting','search'].includes(id)?'lg':'sm',rows:['bookmarks','calendar','tasks'].includes(id)?2:1}}
const sizeLimits = {
  greeting:[2,1], clock:[2,1], search:[3,1,1], weather:[2,1],
  bookmarks:[2,2], calendar:[2,2], tasks:[2,1], quote:[1,1],
  music:[2,1], system:[1,1]
};
function sizesFor(id) {
  const [minWidth,minHeight,maxHeight=3]=sizeLimits[id];
  return Object.entries(widths).filter(([,w])=>w>=minWidth).flatMap(([size])=>
    Array.from({length:maxHeight-minHeight+1},(_,i)=>({size,rows:minHeight+i})));
}
function fits(rect, others, cols=6) {
  const {x,y,w,h}=rect;
  return x>=0 && y>=0 && x+w<=cols && !Object.values(others).some(p=>
    x<p.x+p.w && x+w>p.x && y<p.y+p.h && y+h>p.y);
}
function packAll(s,cols=6) {
  const out={}, pending=[];
  for(const id of s.order) {
    if(s.hidden.includes(id))continue;
    const t=s.tiles[id], w=Math.min(cols,widths[t.size]), h=t.rows;
    const saved=s.positions?.[id];
    if(Number.isInteger(saved?.x) && Number.isInteger(saved?.y) &&
       saved.y<=1000 && fits({...saved,w,h},out,cols))out[id]={...saved,w,h};
    else pending.push({id,w,h});
  }
  for(const {id,w,h} of pending) {
    let y=0,x=0;
    while(!fits({x,y,w,h},out,cols)) {
      if(++x+w>cols){x=0;y++}
    }
    out[id]={x,y,w,h};
  }
  return out;
}
function cleanPositions(raw) {
  return Object.fromEntries(ids.filter(id=>Number.isInteger(raw?.[id]?.x) &&
    Number.isInteger(raw?.[id]?.y) && raw[id].x>=0 && raw[id].x<6 &&
    raw[id].y>=0 && raw[id].y<=1000).map(id=>[id,{x:raw[id].x,y:raw[id].y}]));
}
function layoutSnapshot(s) {
  return {order:[...s.order],hidden:[...s.hidden],positions:cleanPositions(s.positions),alignX:s.alignX,alignY:s.alignY,
    tiles:Object.fromEntries(ids.map(id=>[id,{size:s.tiles[id].size,rows:s.tiles[id].rows}]))};
}
function applyLayout(s, snapshot) {
  s.order=snapshot.order;
  s.hidden=snapshot.hidden;
  s.positions=snapshot.positions;
  s.alignX=snapshot.alignX??s.alignX;
  s.alignY=snapshot.alignY??s.alignY;
  for(const id of ids)Object.assign(s.tiles[id],snapshot.tiles[id]);
}
let edit=null;
const clockCities = {
  local:'Местное время', 'Europe/Kaliningrad':'Калининград', 'Europe/Moscow':'Москва',
  'Asia/Yekaterinburg':'Екатеринбург', 'Asia/Novosibirsk':'Новосибирск',
  'Asia/Irkutsk':'Иркутск', 'Asia/Vladivostok':'Владивосток', 'Europe/London':'Лондон',
  'Europe/Paris':'Париж', 'Asia/Dubai':'Дубай', 'Asia/Tokyo':'Токио', 'America/New_York':'Нью-Йорк'
};
const clockActivityCenters = [['mascot','Маскот'],['logo','Логотип'],['none','Пустой центр']];
const clockActivityImages = {mascot:'icons/clock-mascot.webp',logo:'icons/clock-logo.webp'};
function clockOptions(raw = {}) {
  const cities = ['local', ...Object.keys(clockCities).filter(zone => zone !== 'local' && Array.isArray(raw?.cities) && raw.cities.includes(zone))];
  return {
    face:one(raw?.face,['digital','analog'],'digital'),
    cities,
    zone:one(raw?.zone,cities,'local'),
    activityCenter:one(raw?.activityCenter,clockActivityCenters.map(([value])=>value),'none')
  };
}
const widgetScaleRange = {min:60, max:100, step:5};

function normalizeWidgetScale(value) {
  const {min,max,step} = widgetScaleRange;
  if (!Number.isFinite(value)) return max;
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

const accentPalette = {
  '#6366f1':'Индиго', '#1683d8':'Синий', '#0e9384':'Бирюзовый',
  '#439258':'Зелёный', '#c77916':'Янтарный', '#d24d67':'Розовый', '#a057cf':'Фиолетовый'
};
const defaultAccent = '#6366f1';
let sampledWallpaper = '';
let wallpaperAccent = defaultAccent;

function applyAccent() {
  const color = state.accentMode === 'wallpaper' ? wallpaperAccent : state.accentColor;
  document.body.style.setProperty('--accent', color);
  const [r,g,b] = color.slice(1).match(/../g).map(channel => {
    const value = parseInt(channel,16)/255;
    return value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4;
  });
  document.body.style.setProperty('--accent-ink', .2126*r+.7152*g+.0722*b > .179 ? '#000' : '#fff');
}

async function sampleWallpaper(wall) {
  try {
    const image = new Image();
    if (url(wall)) image.crossOrigin = 'anonymous';
    image.src = wall;
    await image.decode();
    const canvas = el('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d');
    context.drawImage(image,0,0,32,32);
    const pixels = context.getImageData(0,0,32,32).data;
    const colors = new Map();
    for (let i=0;i<pixels.length;i+=4) {
      const rgb = [pixels[i],pixels[i+1],pixels[i+2]];
      const min = Math.min(...rgb), max = Math.max(...rgb);
      if (pixels[i+3]<128 || max<48 || min>225 || max-min<24) continue;
      const key = rgb.map(channel=>channel>>5).join(',');
      const group = colors.get(key) || [0,0,0,0];
      group[0]++;
      rgb.forEach((channel,index)=>group[index+1]+=channel);
      colors.set(key,group);
    }
    const dominant = [...colors.values()].sort((a,b)=>b[0]-a[0])[0];
    if (dominant) return '#'+dominant.slice(1).map(sum=>Math.round(sum/dominant[0]).toString(16).padStart(2,'0')).join('');
  } catch {
    // Some image servers allow display but block reading pixels.
  }
  return defaultAccent;
}

function updateAccent() {
  const wall = state.accentMode === 'wallpaper' ? wallpaperUrl() : '';
  if (wall !== sampledWallpaper) {
    sampledWallpaper = wall;
    wallpaperAccent = defaultAccent;
    if (wall) sampleWallpaper(wall).then(color=>{
      if (wall !== sampledWallpaper) return;
      wallpaperAccent = color;
      applyAccent();
    });
  }
  applyAccent();
}

function normalize(raw={}){raw=raw&&typeof raw==='object'?raw:{};const list=v=>Array.isArray(v)?[...new Set(v.filter(id=>ids.includes(id)))]:[];
 const s={widgetScale:normalizeWidgetScale(raw.widgetScale),bookmarkSource:one(raw.bookmarkSource,['custom','browser'],'custom'),bookmarkFolder:typeof raw.bookmarkFolder==="string"?raw.bookmarkFolder:"",clock:clockOptions(raw.clock),order:[...new Set([...list(raw.order),...ids])],hidden:list(raw.hidden),tiles:{},theme:one(raw.theme,['dark','light','system'],'dark'),wall:typeof raw.wall==='string'?raw.wall:'',engine:one(raw.engine,Object.keys(engines),'Google'),alignX:one(raw.alignX,['start','center','end'],'center'),alignY:one(raw.alignY,['start','center','end'],'center'),manage:raw.manage===true,musicTint:raw.musicTint!==false,track:url(raw.track),trackName:String(raw.trackName||'').slice(0,120),tasks:[],events:[],quote:raw.quote||{},weather:raw.weather||{}};
 for(const id of ids){const t=raw.tiles?.[id]||{},d=defaults(id);s.tiles[id]={size:one(t.size,Object.keys(widths),d.size),rows:one(t.rows,[1,2,3],d.rows),text:t.text===true};if(id==='greeting'){s.tiles[id].nickname=typeof t.nickname==='string'?t.nickname.trim().slice(0,40):'';s.tiles[id].showDate=t.showDate!==false}}
 s.tasks=normalizeTaskRecords(raw.tasks);
 s.events=(Array.isArray(raw.events)?raw.events:[]).filter(r=>r&&typeof r.id==='string'&&typeof r.text==='string'&&r.text.trim()&&/^\d{4}-\d\d-\d\d$/.test(r.date)).map(normalizeCalendarEvent).filter(Boolean);
 s.accentMode=one(raw.accentMode,['manual','wallpaper'],'manual');
 s.accentColor=one(raw.accentColor,Object.keys(accentPalette),defaultAccent);
 Object.assign(s, normalizeCustomBookmarks(raw));
 s.cities=Array.isArray(raw.cities)?raw.cities.filter(validWeatherCity):[];
 s.weatherCity=s.cities.some(c=>c.id===raw.weatherCity)?raw.weatherCity:'auto';
 s.manage=false;
 s.positions=cleanPositions(raw.positions);
 for(const id of ids) {
   const t=s.tiles[id], options=sizesFor(id);
   if(!options.some(p=>p.size===t.size && p.rows===t.rows)) {
     const [minWidth,minHeight,maxHeight=3]=sizeLimits[id];
     if(widths[t.size]<minWidth)t.size=options[0].size;
     t.rows=Math.max(minHeight,Math.min(maxHeight,t.rows));
   }
 }
 return s;
}
let state=normalize(),pos={},gesture=null,syncStatus='Чтение…',timer,month=new Date(),cpu='…',memory='',musicError='',activeDialog='';
const audio=new Audio();audio.preload='none';
function toast(msg){$('#notice').textContent=msg;clearTimeout(timer);timer=setTimeout(()=>$('#notice').textContent='',2800)}
const recordCollections=['tasks','events','cities','linkCategories','siteTiles'];
function unpack(data){const raw={};for(const [k,v] of Object.entries(data)){if(k.startsWith('gntd.')){const [,type,id]=k.split('.');if(id&&recordCollections.includes(type))(raw[type]??=[]).push(v);else raw[type]=v}}for(const k of ['tasks','events'])raw[k]?.sort((a,b)=>String(a?.id).localeCompare(String(b?.id)));return normalize(raw)}
function flatten(s){const out={};for(const [k,v] of Object.entries(s)){if(recordCollections.includes(k))v.forEach(r=>out['gntd.'+k+'.'+r.id]=r);else out['gntd.'+k]=v}return out}
async function change(fn){try{await navigator.locks.request('gntd-write',async()=>{const account=await cloudAccount(),raw=await dashboardData(account),s=unpack(raw),before=structuredClone(flatten(s));fn(s);if(!packAll(s))throw Error('Для такого размера нет места');const after=flatten(normalize(s)),set={},remove=[];
 for(const [k,v] of Object.entries(after))if(JSON.stringify(before[k])!==JSON.stringify(v))set[k]=v;
 for(const k of Object.keys(before))if(!(k in after))remove.push(k);
 await writeDashboard(account,set,remove);await refresh()});return true}catch(e){toast(e.message);syncStatus='Ошибка сохранения';updateStatus()}}
let widgetScalePreview = null;

function updateWidgetScale() {
  const scale = widgetScalePreview ?? state.widgetScale;
  cancelGesture();
  board.style.setProperty('--widget-scale', String(scale / 100));
  layout();

  const slider = fields.querySelector('#widget-scale');
  if (slider) {
    const label = scale + ' %';
    slider.value = scale;
    slider.setAttribute('aria-valuetext', label);
    fields.querySelector('#widget-scale-value').textContent = label;
  }
}

function widgetScaleField() {
  const fieldBox = el('div', 'widget-scale');
  const header = el('div', 'row');
  const label = el('label', '', 'Размер всех виджетов');
  label.htmlFor = 'widget-scale';
  const slider = input('', 'range');
  slider.id = label.htmlFor;
  const {min,max,step} = widgetScaleRange;
  Object.assign(slider, {min,max,step});
  const value = el('span', 'muted');
  value.id = 'widget-scale-value';
  header.append(label, value);
  fieldBox.append(header, slider);
  fields.append(fieldBox);
  updateWidgetScale();

  let pending = null;
  slider.oninput = () => {
    pending = null;
    widgetScalePreview = slider.valueAsNumber;
    updateWidgetScale();
  };
  slider.onchange = async () => {
    const edit = {value:slider.valueAsNumber};
    pending = edit;
    await change(s => { s.widgetScale = edit.value; });
    if (pending !== edit || !slider.isConnected) return;
    pending = null;
    widgetScalePreview = null;
    updateWidgetScale();
  };
  slider.onpointercancel = () => {
    widgetScalePreview = null;
    updateWidgetScale();
  };
}

function columns(){return board.clientWidth<560?3:board.clientWidth<880?4:6}
function metrics(){
  const cols=columns();
  return {cw:(board.clientWidth-(cols-1)*gap)/cols,rh:Math.max(110,(document.documentElement.clientHeight-130-(rows-1)*gap)/rows)};
}
function box(p){const {cw,rh}=metrics();return {left:p.x*(cw+gap),top:p.y*(rh+gap),width:p.w*(cw+gap)-gap,height:p.h*(rh+gap)-gap}}
function place(n,r){for(const [k,v] of Object.entries(r))n.style[k]=v+'px'}
function layout(){
  const cols=columns(), {cw,rh}=metrics();
  pos=packAll(edit||state,cols);
  const end=Math.max(rows,...Object.values(pos).map(p=>p.y+p.h+(edit?1:0)));
  board.style.minHeight=(end*(rh+gap)-gap)+'px';
  board.style.setProperty('--step-x',(cw+gap)+'px');
  board.style.setProperty('--step-y',(rh+gap)+'px');
  for(const n of board.querySelectorAll('.card'))if(pos[n.dataset.id])place(n,box(pos[n.dataset.id]));
}
function cap(id,extra){const n=el('div','cap');n.append(icon(id),el('span','',names[id]));if(extra)n.append(extra);return n}
function modal(title,key){
  if (widgetScalePreview !== null) {
    widgetScalePreview = null;
    updateWidgetScale();
  }
 if(key!=='settings'){
   dialog.querySelector('.settings-navigation')?.remove();
   fields.hidden=false;
 }
 activeDialog=key;dialog.dataset.view=key;dialog.querySelector('h2').textContent=title;fields.replaceChildren();if(!dialog.open)dialog.showModal()}
function field(label,input){const l=el('label','field',label);l.append(input);fields.append(l)}
function input(value='',type='text'){const n=el('input');n.type=type;n.value=value;return n}
function formSave(label,fn){const form=el('form');form.style.display='contents';form.append(...fields.childNodes);const b=el('button','',label);b.type='submit';form.append(b);fields.append(form);form.onsubmit=e=>{e.preventDefault();fn()}}
function musicSettings(){showSettings('music')}
function musicFields(){
  fields.append(el('strong','','Медиаплееры Windows'),el('div','muted','Один раз запустите media-host/install.cmd из папки установленного расширения. Виджет подключится автоматически.'));
  fields.append(el('strong','','Аудиофайл на случай, когда нет активного плеера'));
  const title=input(state.trackName),src=input(state.track,'url');title.maxLength=120;field('Название',title);field('Ссылка на аудиофайл',src);formSave('Сохранить',()=>{if(src.value&&!url(src.value)){src.setCustomValidity('Укажите HTTP или HTTPS');src.reportValidity();src.setCustomValidity('');return}change(s=>{s.track=url(src.value);s.trackName=title.value.trim()});showSettings('widgets')})}
function weatherText(code){if(code===0)return 'Ясно';if(code<=3)return 'Облачно';if(code<=48)return 'Туман';if(code<=57)return 'Морось';if(code<=67)return 'Дождь';if(code<=77)return 'Снег';if(code<=82)return 'Ливень';if(code<=86)return 'Снегопад';return 'Гроза'}

const clockFormats = new Map();
function updateClock(display, now = new Date()) {
  const {zone,face} = state.clock;
  if (!clockFormats.has(zone)) {
    clockFormats.set(zone,new Intl.DateTimeFormat('ru-RU',{
      hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:zone==='local'?undefined:zone
    }));
  }
  const time = clockFormats.get(zone).format(now);
  const date=display.parentElement?.querySelector('.clock-date');
  if (date) date.textContent=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',timeZone:zone==='local'?undefined:zone}).format(now);
  if (face === 'digital') {
    display.textContent = time;
  } else {
    const [hour,minute] = time.split(':').map(Number);
    display.style.setProperty('--hour',(hour%12*30+minute/2)+'deg');
    display.style.setProperty('--minute',(minute*6)+'deg');
    display.setAttribute('aria-label',clockCities[zone]+', '+time);
  }
}
function renderClock(container) {
  const n = el("div","clock-left");
  container.append(n,activityButton());
  const {face,cities,zone} = state.clock;
  const display = el('div',face==='digital'?'time':'clock-dial');
  display.dataset.clockDisplay = '';
  if (face === 'analog') {
    display.setAttribute('role','img');
    display.append(el('i','hour-hand'),el('i','minute-hand'));
  }
  n.append(display);
  n.append(el('small','clock-date'));
  updateClock(display);
  if (cities.length > 1) {
    const next = btn('Следующий город. Сейчас '+clockCities[zone],clockCities[zone]+' ›',()=>change(s=>{
      const clock = s.clock;
      clock.zone = clock.cities[(clock.cities.indexOf(clock.zone)+1)%clock.cities.length];
    }),'clock-city');
    n.append(next);
  }
}
// Match complete domain labels, including subdomains. Unknown sites keep their time.
const activityCategories = [
  {name:'Медиа и игры',tone:'media',domains:'youtube.com youtu.be twitch.tv rutube.ru kinopoisk.ru okko.tv ivi.ru netflix.com spotify.com music.yandex.ru music.yandex.com store.steampowered.com steamcommunity.com'},
  {name:'Работа и учёба',tone:'work',domains:'github.com gitlab.com stackoverflow.com developer.mozilla.org notion.so notion.site figma.com docs.google.com drive.google.com calendar.google.com disk.yandex.ru tracker.yandex.ru wikipedia.org stepik.org coursera.org chatgpt.com'},
  {name:'Общение',tone:'social',domains:'vk.com vk.ru ok.ru telegram.org t.me whatsapp.com discord.com reddit.com x.com mail.google.com mail.yandex.ru e.mail.ru teams.microsoft.com slack.com'},
  {name:'Другое',tone:'other',domains:''}
].map(group=>({...group,domains:group.domains.split(' ').filter(Boolean)}));

function activityBreakdown(rows) {
  const groups=activityCategories.map(category=>({...category,sites:[],time:0}));
  let total=0;
  for (const [site,time] of rows) {
    const host=site.toLowerCase().replace(/\.$/,'');
    const group=groups.find(g=>g.domains.some(d=>host===d || host.endsWith('.'+d))) || groups.at(-1);
    group.sites.push([site,time]);
    group.time+=time;
    total+=time;
  }
  return {groups,total};
}

function activityRing(groups,total) {
  const mosaic=el('span','activity-mosaic');
  mosaic.setAttribute('aria-hidden','true');
  const visible=groups.filter(group=>group.time>0).sort((a,b)=>b.time-a.time);
  let x=0, y=0, width=100, height=100, remaining=total;
  for (const [index,group] of visible.entries()) {
    const block=el('span','activity-mosaic-block');
    block.style.setProperty('--tile-color',`var(--activity-${group.tone})`);
    const fraction=group.time/remaining;
    const vertical=index%2===0;
    const blockWidth=vertical?width*fraction:width;
    const blockHeight=vertical?height:height*fraction;
    Object.assign(block.style,{left:x+'%',top:y+'%',width:blockWidth+'%',height:blockHeight+'%'});
    mosaic.append(block);
    if (vertical) { x+=blockWidth; width-=blockWidth; }
    else { y+=blockHeight; height-=blockHeight; }
    remaining-=group.time;
  }
  const source=clockActivityImages[state.clock.activityCenter];
  if (source) {
    const image=el('img','activity-center-image');
    image.dataset.center=state.clock.activityCenter;
    image.src=source;
    image.alt='';
    image.draggable=false;
    if (state.clock.activityCenter==='mascot') {
      const peek=el('span','activity-peek');
      peek.append(image);
      const largest=mosaic.querySelector('.activity-mosaic-block');
      if (largest) largest.append(peek);
    } else {
      mosaic.append(image);
    }
  }
  return mosaic;
}

const activityPeriods = [
  [1,'24 часа','За последние 24 часа'],
  [7,'7 дней','За последние 7 дней'],
  [30,'Месяц','За последние 30 дней']
];
let activityData, activityPeriod = 1, activityRequest = 0;
function duration(ms) {
  const minutes = Math.floor(ms/60000);
  if (!minutes) return ms ? Math.max(1,Math.floor(ms/1000))+' с' : '0 мин';
  if (minutes < 60) return minutes+' мин';
  return Math.floor(minutes/60)+' ч'+(minutes%60?' '+minutes%60+' мин':'');
}
function paintActivity(button) {
  const rows=activityData?.summaries[1];
  const {groups,total}=activityBreakdown(rows || []);
  const value=rows?duration(total):'—';
  const copy=el('span','activity-copy');
  copy.append(el('strong','',value),el('small','','на сайтах'));
  button.replaceChildren(activityRing(groups,total,value),copy);
  button.title='Время на сайтах за последние 24 часа · '+value;
  button.setAttribute('aria-label',button.title+'. Открыть категории и сайты');
}
function activityDetails() {
  modal('Активность на сайтах','activity');
  const periods=el('div','activity-periods');
  periods.setAttribute('role','group');
  periods.setAttribute('aria-label','Период статистики');
  for (const [days,label] of activityPeriods) {
    const control=btn(label,label,()=>{
      activityPeriod=days;
      paintActivityReport();
    });
    control.dataset.days=days;
    control.setAttribute('aria-controls','activity-report');
    periods.append(control);
  }
  const report=el('div','activity-report');
  report.id='activity-report';
  fields.append(periods,report);
  paintActivityReport();
}
function paintActivityReport() {
  const report=fields.querySelector('.activity-report');
  const expanded=new Set(Array.from(report.querySelectorAll('.activity-group[open]'),node=>node.dataset.name));
  const focused=document.activeElement?.matches('.activity-heading')?document.activeElement.parentElement.dataset.name:null;
  const rows=activityData?.summaries[activityPeriod];
  const {groups,total}=activityBreakdown(rows || []);
  for (const control of fields.querySelectorAll('.activity-periods button')) {
    control.setAttribute('aria-pressed',String(Number(control.dataset.days)===activityPeriod));
  }
  const [, , label]=activityPeriods.find(([days])=>days===activityPeriod);
  const hero=el('div','activity-summary'), copy=el('div','activity-summary-copy');
  const value=rows?duration(total):'—';
  copy.setAttribute('aria-live','polite');
  copy.append(el('small','',label),el('strong','',value));
  hero.append(activityRing(groups,total,value),copy);
  report.replaceChildren(hero);
  if (rows && activityPeriod>1 && activityData.now-activityData.since<activityPeriod*86400000) {
    const since=new Date(activityData.since).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
    report.append(el('small','activity-note','История пока доступна с '+since));
  }
  if (!total) {
    const message=rows?'За этот период активности пока нет.':activityData===undefined?'Загружаем статистику…':'Статистика сейчас недоступна.';
    report.append(el('p','activity-note muted',message));
    return;
  }
  for (const group of groups.filter(group=>group.time).sort((a,b)=>b.time-a.time)) {
    const section=el('details','activity-group');
    section.dataset.name=group.name;
    section.style.setProperty('--arc',`var(--activity-${group.tone})`);
    const head=el('summary','activity-heading');
    const share=100*group.time/total;
    head.append(el('span','activity-key',group.name),el('strong','',duration(group.time)),el('small','',share<1?'<1%':Math.round(share)+'%'));
    section.append(head);
    section.open=expanded.has(group.name);
    for (const [host,time] of group.sites) {
      const row=el('div','activity-site');
      row.append(el('span','',host),el('span','',duration(time)));section.append(row);
    }
    report.append(section);
    if (focused===group.name) head.focus({preventScroll:true});
  }
}
async function refreshActivity() {
  const revision=++activityRequest;
  let data;
  try { data=await globalThis.chrome?.runtime?.sendMessage({type:'activity-summary',periods:true}) } catch {}
  if (revision!==activityRequest) return;
  activityData=activityPeriods.every(([days])=>Array.isArray(data?.summaries?.[days]))?data:null;
  const button=board.querySelector('.activity-button');
  if (button) paintActivity(button);
  if (dialog.open && activeDialog==='activity') paintActivityReport();
}
function activityButton() {
  const button=btn('Активность за 24 часа','',activityDetails,'activity-button');
  button.setAttribute('aria-haspopup','dialog');
  paintActivity(button);refreshActivity();
  return button;
}
document.addEventListener('visibilitychange',()=>{
  if (!document.hidden && board.querySelector('.activity-button')) refreshActivity();
});
setInterval(()=>{if (!document.hidden && board.querySelector('.activity-button')) refreshActivity()},60000);
function clockFields() {
  const preview=el('div','clock-settings-preview');
  preview.setAttribute('aria-label','Предпросмотр часов');
  const card=el('div','card');
  card.dataset.id='clock';
  const inside=el('div','inside');
  card.append(inside);
  preview.append(card);
  renderClock(inside);
  const {groups,total}=activityBreakdown([['github.com',4800000],['youtube.com',2880000],['t.me',1920000]]);
  const copy=el('span','activity-copy');
  copy.append(el('strong','',duration(total)),el('small','','на сайтах'));
  inside.querySelector('.activity-button').replaceChildren(activityRing(groups,total),copy);
  preview.append(el('small','clock-preview-caption','Пример данных активности'));
  for (const button of inside.querySelectorAll('button')) button.disabled=true;
  fields.append(preview);

  function choices(title,key,options,visual) {
    const section=el('fieldset','clock-choices');
    section.append(el('legend','',title));
    const list=el('div','clock-choice-grid');
    for (const [value,label] of options) {
      const item=el('label','clock-choice');
      const radio=input('','radio');
      radio.name='clock-'+key;
      radio.value=value;
      radio.checked=state.clock[key]===value;
      radio.onchange=async()=>{
        await change(s=>s.clock[key]=value);
        fields.querySelector('input[name="clock-'+key+'"][value="'+value+'"]')?.focus({preventScroll:true});
      };
      item.append(radio,visual(value),el('span','clock-choice-label',label));
      list.append(item);
    }
    section.append(list);
    fields.append(section);
  }
  choices('Циферблат','face',[['digital','Цифровой'],['analog','Стрелочный']],value=>{
    const sample=el('span','clock-face-sample');
    if (value==='digital') sample.append(el('span','clock-sample-digital','10:08'));
    else {
      const dial=el('span','clock-dial');
      dial.style.setProperty('--hour','304deg');
      dial.style.setProperty('--minute','48deg');
      dial.append(el('i','hour-hand'),el('i','minute-hand'));
      sample.append(dial);
    }
    return sample;
  });
  choices('На диаграмме','activityCenter',clockActivityCenters.map(([value,label])=>[value,value==='none'?'Без изображения':label]),value=>{
    const sample=el('span','clock-image-sample');
    if (value==='none') {
      const {groups,total}=activityBreakdown([['github.com',50],['youtube.com',30],['t.me',20]]);
      const mosaic=activityRing(groups,total);
      mosaic.querySelector('.activity-peek,.activity-center-image')?.remove();
      sample.append(mosaic);
    } else {
      const image=el('img');
      image.src=clockActivityImages[value];
      image.alt='';
      image.draggable=false;
      sample.append(image);
    }
    return sample;
  });
  const group=el('fieldset','clock-city-choices');
  group.append(el('legend','','Города'));
  group.append(el('p','muted clock-settings-hint','Местное время включено всегда. Выбранные города переключаются в виджете.'));
  const list=el('div','clock-city-grid');
  for (const [zone,name] of Object.entries(clockCities)) {
    if (zone==='local') continue;
    const label=el('label','clock-city-choice'), toggle=input('','checkbox');
    toggle.checked=state.clock.cities.includes(zone);
    toggle.onchange=async()=>{
      await change(s=>{
        s.clock.cities=toggle.checked?[...s.clock.cities,zone]:s.clock.cities.filter(v=>v!==zone);
      });
      Array.from(fields.querySelectorAll('.clock-city-choice input')).find(node=>node.dataset.zone===zone)?.focus({preventScroll:true});
    };
    toggle.dataset.zone=zone;
    label.append(toggle,el('span','',name));
    list.append(label);
  }
  group.append(list);
  fields.append(group);
}
const greetingScenes = {morning:'Доброе утро', day:'Добрый день', evening:'Добрый вечер', night:'Доброй ночи'};
const greetingDate = new Intl.DateTimeFormat('ru', {weekday:'long', day:'numeric', month:'long'});
const compactGreetingDate = new Intl.DateTimeFormat('ru', {day:'numeric', month:'short'});
function updateGreeting(n, now) {
  if (!n) return;
  const hour = now.getHours();
  const scene = hour < 5 || hour >= 23 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'day' : 'evening';
  n.dataset.scene = scene;
  const nickname = state.tiles.greeting.nickname;
  n.querySelector('.greet-message').textContent = greetingScenes[scene] + (nickname ? ',' : '');
  const date = n.querySelector('.greet-date');
  const fullDate = greetingDate.format(now);
  date.title = fullDate;
  date.querySelector('.greet-date-full').textContent = fullDate;
  date.querySelector('.greet-date-short').textContent = compactGreetingDate.format(now);
  date.dateTime = day(now);
}
function renderGreeting(n, now) {
  const copy = el('div', 'greet-copy');
  const title = el('div', 'greet-title');
  const nickname = state.tiles.greeting.nickname;
  title.append(el('span', 'greet-message'));
  if (nickname) title.append(' ', el('span', 'greet-name', nickname));
  const date = el('time', 'greet-date');
  date.append(el('span', 'greet-date-full'), el('span', 'greet-date-short'));
  date.hidden = !state.tiles.greeting.showDate;
  copy.append(title, date);
  const art = el('div', 'greet-art');
  art.setAttribute('aria-hidden', 'true');
  for (const scene of Object.keys(greetingScenes)) {
    const picture = el('img', 'greet-picture');
    picture.dataset.scene = scene;
    picture.alt = '';
    picture.src = 'wallpapers/greeting/' + scene + '.jpg';
    art.append(picture);
  }
  n.append(copy, art);
  updateGreeting(n, now);
}


function positionSearchPanel(form, panel, minimumWidth = 260, preferredHeight = 240) {
  const rect = form.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, minimumWidth), 420, window.innerWidth - 16);
  const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
  const below = window.innerHeight - rect.bottom;
  const above = rect.top;
  const openAbove = below < preferredHeight && above > below;
  panel.style.width = width + 'px';
  panel.style.left = left + 'px';
  panel.style.top = openAbove ? 'auto' : (rect.bottom + 6) + 'px';
  panel.style.bottom = openAbove ? (window.innerHeight - rect.top + 6) + 'px' : 'auto';
  panel.style.maxHeight = Math.min(320, Math.max(0, (openAbove ? above : below) - 14)) + 'px';
}

function searchAddress(value) {
  const explicit = /^https?:\/\//i.test(value);
  if (/\s|\\/.test(value)) return '';
  if (!explicit && !/^(?:[\p{L}\p{N}-]+\.)+(?:[\p{L}\p{N}-]{2,}|\d)(?::\d+)?(?:[/?#]|$)/u.test(value)) return '';
  const host = value.split(/[/:?#]/, 1)[0];
  if (!explicit && /^[\d.]+$/.test(host) && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return '';
  try {
    const address = new URL(explicit ? value : 'https://' + value);
    return address.username || address.password || (!explicit && !/\.[a-z]/i.test(address.hostname) && !/^\d+(\.\d+){3}$/.test(address.hostname)) ? '' : address.href;
  } catch {
    return '';
  }
}

function searchSuggestions(value, history, sites) {
  const term = value.trim().toLowerCase();
  if (!term) return [];
  const recent = history.filter(item => item.toLowerCase().includes(term)).slice(0, 4)
    .map(title => ({title, kind:'История'}));
  const matches = [];
  const seen = new Set();
  for (const site of sites) {
    if (!((site.title || '') + ' ' + site.url).toLowerCase().includes(term)) continue;
    const href = searchAddress(site.url);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    matches.push({title:site.title || site.url, kind:'Закладка', href});
    if (matches.length === 4) break;
  }
  return [...recent, ...matches];
}

function addSearchSuggestions(form, query, readHistory, choose) {
  const list = el('ul', 'search-history-panel search-suggestions');
  list.id = 'todayis-search-suggestions';
  list.setAttribute('popover', 'manual');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Подсказки поиска');
  query.setAttribute('role', 'combobox');
  query.setAttribute('aria-controls', list.id);
  query.setAttribute('aria-autocomplete', 'list');
  query.setAttribute('aria-expanded', 'false');

  let items = [];
  let selected = -1;
  function close() {
    if (list.matches(':popover-open')) list.hidePopover();
    query.setAttribute('aria-expanded', 'false');
    query.removeAttribute('aria-activedescendant');
    selected = -1;
  }
  function show() {
    if (document.activeElement !== query) return;
    const sites = [...state.siteTiles, ...bookmarkSites];
    items = searchSuggestions(query.value, readHistory(), sites);
    if (!items.length) return close();
    selected = -1;
    query.removeAttribute('aria-activedescendant');
    list.replaceChildren(...items.map((item, index) => {
      const row = el('li', 'search-suggestion');
      row.id = list.id + '-' + index;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.append(el('span', 'search-suggestion-title', item.title), el('small', '', item.kind));
      row.addEventListener('pointerdown', event => event.preventDefault());
      row.addEventListener('click', () => choose(item));
      return row;
    }));
    positionSearchPanel(form, list);
    if (!list.matches(':popover-open')) list.showPopover();
    query.setAttribute('aria-expanded', 'true');
  }
  query.addEventListener('input', show);
  query.addEventListener('blur', close);
  query.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape' && list.matches(':popover-open')) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (!list.matches(':popover-open')) show();
    if (!list.matches(':popover-open')) return;
    event.preventDefault();
    const previous = list.children[selected];
    if (previous) previous.setAttribute('aria-selected', 'false');
    const step = event.key === 'ArrowDown' ? 1 : -1;
    selected = selected === -1 && step === -1 ? items.length - 1 : (selected + step + items.length) % items.length;
    const row = list.children[selected];
    row.setAttribute('aria-selected', 'true');
    query.setAttribute('aria-activedescendant', row.id);
    row.scrollIntoView({block:'nearest'});
  });
  return {list, close, selectedItem: () => items[selected]};
}

function addSearchHistory(form, query) {
  const key = 'todayis.searchHistory';
  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      return Array.isArray(saved) ? saved.filter(item => typeof item === 'string' && item.trim()).slice(0, 20) : [];
    } catch {
      return [];
    }
  }
  function save(items) {
    try {
      if (items.length) localStorage.setItem(key, JSON.stringify(items));
      else localStorage.removeItem(key);
    } catch {
      // Searching remains available when local storage is blocked.
    }
  }

  const trigger = el('button', 'search-history-trigger');
  trigger.type = 'button';
  trigger.title = 'История поиска';
  trigger.setAttribute('aria-label', 'История поиска');
  trigger.append(icon('clock'));

  const panel = el('section', 'search-history-panel');
  panel.setAttribute('popover', 'auto');
  panel.setAttribute('aria-label', 'История поиска');
  trigger.popoverTargetElement = panel;

  function render() {
    const items = read();
    const header = el('header', 'search-history-header');
    header.append(el('strong', '', 'История поиска'));
    if (items.length) {
      const clear = el('button', '', 'Очистить');
      clear.type = 'button';
      clear.onclick = () => {
        save([]);
        render();
        panel.focus();
      };
      header.append(clear);
    }
    panel.replaceChildren(header);
    if (!items.length) {
      panel.append(el('p', 'search-history-empty', 'Здесь появятся отправленные запросы'));
      return;
    }
    const list = el('ul', 'search-history-list');
    for (const item of items) {
      const row = el('li');
      const reuse = el('button', 'search-history-query', item);
      reuse.type = 'button';
      reuse.title = item;
      reuse.onclick = () => {
        query.value = item;
        panel.hidePopover();
        query.focus();
      };
      const remove = el('button', 'search-history-remove', '×');
      remove.type = 'button';
      remove.title = 'Удалить запрос';
      remove.setAttribute('aria-label', 'Удалить запрос: ' + item);
      remove.onclick = () => {
        save(read().filter(value => value !== item));
        render();
        (panel.querySelector('.search-history-remove') || panel).focus();
      };
      row.append(reuse, remove);
      list.append(row);
    }
    panel.append(list);
  }

  panel.tabIndex = -1;
  panel.addEventListener('beforetoggle', event => {
    if (event.newState !== 'open') return;
    render();
    positionSearchPanel(form, panel);
  });
  function remember(value) {
    save([value, ...read().filter(item => item !== value)].slice(0, 20));
  }
  return {trigger, panel, read, remember};
}


function searchSpring(stiffness, damping, duration) {
  const decay = damping / 2;
  const frequency = Math.sqrt(stiffness - decay ** 2);
  return Array.from({length:31}, (_, index) => {
    if (index === 30) return 1;
    const time = duration * index / 30000;
    return 1 - Math.exp(-decay * time) * (Math.cos(frequency * time) + decay / frequency * Math.sin(frequency * time));
  });
}

function springySearchField(query) {
  const field = el('div', 'search-spring-field');
  const label = el('span', 'search-spring-label');
  const layer = el('span', 'search-spring-layer');
  label.setAttribute('aria-hidden', 'true');
  layer.setAttribute('aria-hidden', 'true');
  field.append(label, query, layer);

  // DesignBookmark's input-caret and input-morph spring tokens.
  const caretSpring = searchSpring(700, 32, 360);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let previous = query.value;
  let typing;
  function clearTyping() {
    typing?.cancel();
    field.classList.remove('spring-typing');
    layer.replaceChildren();
  }
  function sync() {
    clearTyping();
    field.classList.toggle('has-query', query.value.length > 0);
    previous = query.value;
  }
  query.addEventListener('focus', sync);
  query.addEventListener('blur', sync);
  query.addEventListener('pointerdown', clearTyping);
  query.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.key.length > 1) clearTyping();
  });
  query.addEventListener('compositionstart', clearTyping);
  query.addEventListener('input', event => {
    const before = previous;
    sync();
    const value = query.value;
    const character = event.data;
    if (reduced.matches || event.isComposing || event.inputType !== 'insertText'
      || !character || [...character].length !== 1 || !/^[\p{L}\p{N} ]$/u.test(character)
      || value !== before + character || query.selectionStart !== value.length
      || query.selectionEnd !== value.length || query.scrollLeft) return;
    const glyph = el('span', 'search-spring-glyph', character);
    const caret = el('span', 'search-spring-caret');
    layer.append(document.createTextNode(before), glyph, caret);
    if (layer.scrollWidth > layer.clientWidth) return clearTyping();

    field.classList.add('spring-typing');
    glyph.animate([
      {transform:'translateY(14px) rotate(-16deg) scale(.5)', opacity:0, filter:'blur(3px)', offset:0},
      {transform:'translateY(-3px) rotate(4deg) scale(1.1)', opacity:1, offset:.55},
      {transform:'translateY(1px) rotate(-1deg) scale(.98)', offset:.8},
      {transform:'none', offset:1}
    ], {duration:500, easing:'cubic-bezier(.2,.8,.2,1)'});
    const advance = glyph.offsetWidth;
    caret.animate(caretSpring.map(progress => ({transform:'translateX(' + advance * (progress - 1) + 'px)'})), {duration:360});
    typing = layer.animate([{opacity:1}, {opacity:1}], {duration:500});
    typing.onfinish = clearTyping;
  });
  return {field, label};
}


function searchEngineIcon(name) {
  return icon({Google:'engineGoogle', Яндекс:'engineYandex', DuckDuckGo:'engineDuck'}[name]);
}

function addSearchEnginePicker(initialEngine, onChange) {
  const names = Object.keys(engines);
  const picker = el('button', 'search-picker');
  picker.type = 'button';
  picker.setAttribute('aria-haspopup', 'menu');
  picker.setAttribute('aria-controls', 'todayis-search-engines');
  picker.setAttribute('aria-expanded', 'false');
  const menu = el('div', 'search-history-panel search-engine-menu');
  menu.id = 'todayis-search-engines';
  menu.setAttribute('popover', 'auto');
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Поисковые системы');
  picker.popoverTargetElement = menu;

  const highlight = el('div', 'search-engine-highlight');
  highlight.setAttribute('aria-hidden', 'true');
  menu.append(highlight);
  let value = initialEngine;
  let motion;
  let opening;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // DesignBookmark select-open and select-hl.
  const openSpring = searchSpring(360, 24, 380);
  const highlightSpring = searchSpring(620, 34, 280);
  const rows = names.map(name => {
    const row = el('button', 'search-engine-option');
    row.type = 'button';
    row.tabIndex = -1;
    row.setAttribute('role', 'menuitemradio');
    row.append(searchEngineIcon(name), el('span', '', name), icon('engineCheck'));
    menu.append(row);
    row.addEventListener('pointerenter', () => moveHighlight(row));
    row.addEventListener('focus', () => moveHighlight(row));
    row.addEventListener('click', () => {
      setEngine(name);
      menu.hidePopover();
      picker.focus();
    });
    return row;
  });

  function setEngine(name) {
    value = name;
    picker.title = 'Поисковик: ' + name;
    picker.setAttribute('aria-label', 'Выбрать поисковик. Сейчас ' + name);
    picker.replaceChildren(searchEngineIcon(name), icon('searchChevron'));
    rows.forEach((row, index) => row.setAttribute('aria-checked', String(names[index] === name)));
    onChange(name);
  }

  function moveHighlight(row, animate = true) {
    const to = row.offsetTop;
    const transform = getComputedStyle(highlight).transform;
    const from = transform === 'none' ? to : new DOMMatrix(transform).m42;
    highlight.style.transform = 'translateY(' + to + 'px)';
    highlight.style.height = row.offsetHeight + 'px';
    motion?.cancel();
    if (animate && !reduced.matches && from !== to) {
      motion = highlight.animate(highlightSpring.map(progress => ({
        transform:'translateY(' + (from + (to - from) * progress) + 'px)'
      })), {duration:280});
    }
  }

  menu.addEventListener('beforetoggle', event => {
    const open = event.newState === 'open';
    picker.setAttribute('aria-expanded', String(open));
    if (open) positionSearchPanel(picker, menu, 196, 154);
    else opening?.cancel();
  });
  menu.addEventListener('toggle', event => {
    if (event.newState !== 'open') return;
    const selected = rows[names.indexOf(value)];
    moveHighlight(selected, false);
    selected.focus({preventScroll:true});
    if (!reduced.matches) {
      const direction = menu.style.bottom === 'auto' ? -1 : 1;
      opening = menu.animate(openSpring.map(progress => ({
        transform:'translateY(' + direction * 9 * (1 - progress) + 'px) scale(' + (.94 + .06 * progress) + ')',
        opacity:Math.min(1, progress * 2)
      })), {duration:380});
    }
  });
  menu.addEventListener('pointerleave', () => {
    moveHighlight(rows.includes(document.activeElement) ? document.activeElement : rows[names.indexOf(value)]);
  });
  function openWithArrow(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!menu.matches(':popover-open')) menu.showPopover({source:picker});
  }
  picker.addEventListener('keydown', openWithArrow);
  menu.addEventListener('keydown', event => {
    const index = rows.indexOf(document.activeElement);
    const last = rows.length - 1;
    const next = {ArrowDown:(index + 1) % rows.length, ArrowUp:(index + last) % rows.length, Home:0, End:last}[event.key];
    if (next !== undefined) {
      event.preventDefault();
      rows[next].focus();
    } else if (event.key === 'Tab') {
      menu.hidePopover();
      picker.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      menu.hidePopover();
      picker.focus();
    }
  });
  setEngine(initialEngine);
  return {picker, menu, get value() {return value;}};
}

function renderSearch(container) {
  const form = el('form', 'search-bar');
  form.setAttribute('role', 'search');

  const query = input('', 'search');
  const {field, label} = springySearchField(query);
  query.autocomplete = 'off';
  query.setAttribute('aria-label', 'Поисковый запрос');
  const engine = addSearchEnginePicker(state.engine, name => {
    label.textContent = 'Поиск в ' + name;
  });

  const mic = el('button', 'search-mic');
  mic.type = 'button';
  mic.setAttribute('aria-label', 'Голосовой ввод');
  mic.setAttribute('aria-pressed', 'false');
  mic.title = 'Голосовой ввод';
  mic.append(icon('searchMic'));

  const submit = el('button', 'search-submit');
  submit.type = 'submit';
  submit.setAttribute('aria-label', 'Искать');
  submit.title = 'Искать';
  submit.append(icon('searchArrow'));

  const status = el('span', 'search-status');
  status.setAttribute('role', 'status');
  let statusTimer;
  function announce(message = '', persistent = false) {
    clearTimeout(statusTimer);
    status.textContent = message;
    if (message && !persistent) statusTimer = setTimeout(() => { status.textContent = ''; }, 5000);
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let active;
  if (!Recognition) {
    mic.disabled = true;
    mic.title = 'Голосовой ввод недоступен в этом браузере';
  }
  mic.addEventListener('click', () => {
    if (active) {
      active.stop();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = document.documentElement.lang || navigator.language;
    active = recognition;
    mic.setAttribute('aria-pressed', 'true');
    announce('Включаем микрофон…', true);
    recognition.onaudiostart = () => announce('Слушаю…', true);
    recognition.onresult = event => {
      if (!form.isConnected) return;
      query.value = event.results[event.resultIndex][0].transcript.trim();
      announce();
      query.focus();
      query.dispatchEvent(new Event('input'));
    };
    recognition.onerror = event => {
      const errors = {
        'not-allowed': 'Разрешите доступ к микрофону в Chrome',
        'service-not-allowed': 'Распознавание речи недоступно',
        'audio-capture': 'Микрофон недоступен',
        'no-speech': 'Речь не распознана. Попробуйте ещё раз',
        network: 'Сервис распознавания недоступен'
      };
      announce(errors[event.error] || 'Не удалось распознать речь');
    };
    recognition.onend = () => {
      active = null;
      mic.setAttribute('aria-pressed', 'false');
      if (['Включаем микрофон…', 'Слушаю…'].includes(status.textContent)) announce();
    };
    try {
      recognition.start();
    } catch {
      recognition.onend();
      announce('Не удалось включить микрофон');
    }
  });

  const {trigger, panel, read, remember} = addSearchHistory(form, query);
  function choose(item) {
    suggestions.close();
    const href = item.href || searchAddress(item.title);
    if (href) location.assign(href);
    else {
      remember(item.title);
      location.assign(engines[engine.value] + encodeURIComponent(item.title));
    }
  }
  const suggestions = addSearchSuggestions(form, query, read, choose);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = query.value.trim();
    const item = suggestions.selectedItem();
    if (item || value) choose(item || {title:value});
    else query.focus();
  });
  form.append(engine.picker, field, trigger, mic, submit, engine.menu, panel, suggestions.list);
  container.append(form, status);
}

function contents(id,n){const now=new Date();
 switch(id){
 case 'greeting':renderGreeting(n,now);break
 case 'clock':renderClock(n);break;
 case 'search': renderSearch(n); break;
 case 'weather':renderWeather(n);break
 case 'bookmarks':renderBookmarks(n);break;
 case 'calendar':calendar(n);break;case 'tasks':tasks(n);break;
 case 'quote':n.append(cap(id),el('p','quote','«'+(quotes[state.quote.index]||quotes[0])+'»'));break;
 case 'music':{n.append(cap(id));if(systemMusic.render(n))break;const r=el('div','music');r.append(btn(audio.paused?'Воспроизвести':'Пауза',audio.paused?'▶':'Ⅱ',async()=>{if(!state.track)return musicSettings();if(!audio.paused)return audio.pause();if(audio.src!==state.track)audio.src=state.track;try{await audio.play()}catch{musicError='Источник недоступен';drawOne(id)}},'play'),el('span','',musicError||state.trackName||(state.track?'Мой трек':'Выбрать трек')));n.append(r);systemMusic.localTimeline(n);break}
 case 'system':n.append(cap(id));for(const [k,v] of [['CPU',cpu],['Загрузка CPU','—'],...(memory?[['Память',memory]]:[])]){const line=el('div','stat');line.append(el('small','',k),el('span','',v));n.append(line)}break}}
function drawOne(id){const card=board.querySelector('[data-id="'+id+'"]');if(!card)return;const n=card.querySelector('.inside');n.replaceChildren();contents(id,n)}
const deviceWallpaperKey = 'todayis.deviceWallpaper';
let deviceWallpaper = null;

function wallpaperUrl(){return deviceWallpaper?.image || (Object.hasOwn(wallpaperNames,state.wall)&&state.wall?'wallpapers/'+state.wall+'.svg':url(state.wall))}

function updateDeviceWallpaper(photo) {
  deviceWallpaper = photo ?? null;
  const wall = wallpaperUrl();
  document.body.style.backgroundImage = wall ? 'url('+JSON.stringify(wall)+')' : '';
  updateAccent();
  if (dialog.open && activeDialog === 'settings' && ['', 'appearance'].includes(settingsPage)) showSettings(settingsPage);
}

async function prepareWallpaper(file) {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    try { await image.decode(); }
    catch { throw Error('Не удалось открыть фото. Выбери JPG, PNG или WebP.') }
    const canvas = el('canvas');
    const scale = Math.min(1,2560/Math.max(image.naturalWidth,image.naturalHeight));
    canvas.width = Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height = Math.max(1,Math.round(image.naturalHeight*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return {name:file.name.slice(0,150), image:canvas.toDataURL('image/webp',.82)};
  } finally {
    URL.revokeObjectURL(source);
  }
}
const lightPreference=matchMedia('(prefers-color-scheme: light)');
function applyTheme(){
  document.body.classList.toggle('light',state.theme==='light'||(state.theme==='system'&&lightPreference.matches));
}
lightPreference.addEventListener('change',applyTheme);
function draw(){cancelGesture();applyTheme();const wall=wallpaperUrl();document.body.style.backgroundImage=wall?'url('+JSON.stringify(wall)+')':'';board.style.setProperty('--board-width',state.alignX==='center'?'100%':'94%');board.style.setProperty('--board-height',state.alignY==='center'?'100%':'94%');$('#panel').style.justifyContent=state.alignX;$('#panel').style.alignItems=state.alignY;board.classList.toggle('manage',!!edit);board.replaceChildren();
 for(const id of state.order){if(state.hidden.includes(id))continue;const card=el('section','card'+(state.tiles[id].text?' text-only':''));card.dataset.id=id;card.setAttribute('aria-label',names[id]);const n=el('div','inside');card.append(n);contents(id,n);if(edit){
   n.inert=true;
   const tools=el('div','tools');
   tools.append(btn('Размер виджета','Размер',()=>showSizes(id)));
   const grip=btn('Потяни за угол, чтобы изменить размер','◢',()=>showSizes(id),'grip');
   card.append(tools,grip);
 } board.append(card)}updateWidgetScale();dock()}
function updateStatus(){const n=$('#sync');if(n)n.textContent=syncStatus}
let readRevision=0;
async function refresh(){const revision=++readRevision;const account=await cloudAccount();const next=unpack(await dashboardData(account));if(revision!==readRevision)return;const prev=state;state=next;updateAccent();syncAccentFields();if(prev.widgetScale!==next.widgetScale&&widgetScalePreview===null)updateWidgetScale();syncStatus=account?'Облачный профиль · локальная копия':'Сохранено в профиле браузера';updateStatus();if(prev.track!==next.track){audio.pause();audio.removeAttribute('src');audio.load();musicError=''}const keys=Object.keys(next).filter(k=>JSON.stringify(next[k])!==JSON.stringify(prev[k]));if(!board.children.length||keys.some(k=>['order','hidden','tiles','theme','wall','alignX','alignY','manage','positions'].includes(k)))draw();else for(const k of keys){const id=({bookmarkSource:'bookmarks',linkCategories:'bookmarks',siteTiles:'bookmarks',bookmarkFolder:'bookmarks',cities:'weather',weatherCity:'weather',events:'calendar',engine:'search',track:'music',trackName:'music',musicTint:'music'})[k]||k;if(ids.includes(id))drawOne(id)}if(keys.includes('tasks')){if(!keys.includes('events'))drawOne('calendar');renderTasksView()}if(dialog.open&&activeDialog==='bookmark-search'&&keys.some(k=>['bookmarkSource','linkCategories','siteTiles'].includes(k)))updateBookmarkResults();if(activeDialog==='settings'&&dialog.open&&keys.some(k=>({appearance:['theme','wall'],search:['engine'],widgets:['hidden','order'],account:[],clock:['clock'],bookmarks:['bookmarkFolder','bookmarkSource','linkCategories','siteTiles']}[settingsPage]||['hidden','theme','wall','engine']).includes(k)))showSettings(settingsPage)}
let dockListeners;
function dock(){
  const d=$('#dock');
  const restoreFocus=d.contains(document.activeElement);
  dockListeners?.abort();
  d.replaceChildren();
  d.classList.toggle('right',state.alignX==='start');
  d.classList.toggle('dock-editing',Boolean(edit));
  delete d.dataset.expanded;
  if(edit){
    d.append(btn('Отмена','Отмена',()=>{edit=null;draw()}),
      btn('Сохранить как раскладку','Сохранить как раскладку',()=>showSettings('layout','#layout-slots',true)),
      btn('Готово','Готово',finishLayout,'active'));
    if(restoreFocus)d.firstElementChild.focus({preventScroll:true});
    return;
  }

  let hovered=false, pinned=false;
  const actions=el('div','dock-actions');
  const drawer=el('div','dock-drawer');
  drawer.id='dock-actions';
  drawer.append(actions);
  const trigger=btn('Управление новой вкладкой','',()=>{
    pinned=!pinned;
    expand(pinned);
  },'dock-trigger');
  trigger.setAttribute('aria-controls',drawer.id);
  trigger.append(icon('manage'));
  function expand(open){
    d.dataset.expanded=String(open);
    trigger.setAttribute('aria-expanded',String(open));
    drawer.inert=!open;
  }
  function close(){
    pinned=false;
    if(actions.contains(document.activeElement))trigger.focus({preventScroll:true});
    expand(false);
  }
  function openDialog(open){
    close();
    open();
  }

  actions.append(
    btn('Изменить раскладку','Изменить раскладку',()=>{edit=normalize(state);draw()}),
    btn('Выравнивание','Выравнивание',()=>openDialog(()=>showSettings('layout','#layout-alignment'))),
    btn('Автосортировка','Автосортировка',sortLayout)
  );
  const open=btn('Настройки','Настройки',()=>openDialog(settings));
  open.prepend(icon('settings'));
  actions.append(open);
  d.append(trigger,drawer);
  expand(false);
  const {signal}=dockListeners=new AbortController();
  d.addEventListener('pointerenter',event=>{
    if(event.pointerType==='touch')return;
    hovered=true;
    expand(true);
  },{signal});
  d.addEventListener('pointerleave',event=>{
    if(event.pointerType==='touch')return;
    hovered=false;
    if(!pinned&&!actions.contains(document.activeElement))expand(false);
  },{signal});
  d.addEventListener('focusout',event=>{
    if(!d.contains(event.relatedTarget)){
      pinned=false;
      if(!hovered)expand(false);
    }
  },{signal});
  d.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!drawer.inert){
      event.preventDefault();
      close();
    }
  },{signal});
  document.addEventListener('pointerdown',event=>{
    if(!drawer.inert&&!d.contains(event.target))close();
  },{signal});
  if(restoreFocus)trigger.focus({preventScroll:true});
}
function sortLayout() {
  return change(s=>{
    const area=id=>widths[s.tiles[id].size]*s.tiles[id].rows;
    s.order.sort((a,b)=>area(b)-area(a)||ids.indexOf(a)-ids.indexOf(b));
    s.positions={};
  });
}
function selectField(label,options,value,fn){const q=el('select');for(const [k,t] of options){const o=el('option','',t);o.value=k;q.append(o)}q.value=value;q.onchange=()=>fn(q.value);field(label,q);return q}
const settingsTitles={appearance:'Оформление',search:'Поиск',widgets:'Виджеты',layout:'Раскладки',account:'Синхронизация'};
const settingsIcons={appearance:'appearance',search:'search',widgets:'manage',layout:'layout',account:'account'};
paths.layout='m12 3 9 5-9 5-9-5 9-5z M3 12l9 5 9-5 M3 16l9 5 9-5';
const widgetSettings=['greeting','clock','weather','music','bookmarks'];
const settingsOptions=[
  ['appearance','Тема','#settings-theme input:checked','светлая тёмная системная режим'],
  ['appearance','Обои','#settings-wallpaper','фон картинка изображение'],
  ['appearance','Фото с устройства','.wallpaper-file','обои загрузить выбрать фото файл картинка фон'],
  ['appearance','Ссылка на обои','.settings-url input','URL адрес картинка фон'],
  ['appearance','Акцентный цвет','#accent-mode','цвет палитра акцент по обоям'],
  ['appearance','Размер всех виджетов','#widget-scale','масштаб карточек'],
  ['search','Поисковая система','#settings-engine','яндекс google гугл duckduckgo поиск'],
  ['clock','Циферблат','[name="clock-face"]:checked','часы стрелочный аналоговый цифровой время'],
  ['clock','Изображение на диаграмме','[name="clock-activityCenter"]:checked','часы маскот логотип активность'],
  ['clock','Города и часовые пояса','.clock-city-choice input','часы город местное время'],
  ['greeting','Имя или псевдоним','#settings-nickname','ник обращение приветствие'],
  ['greeting','Показывать дату','#settings-greeting-date','число приветствие'],
  ['weather','Города для погоды','input','прогноз город добавить'],
  ['bookmarks','Источник закладок','select','сайты ссылки мои темы браузер категории'],
  ['bookmarks','Добавить тему','[aria-label="Добавить тему"]','группа категория ссылки закладки сайт'],
  ['music','Ссылка на аудиофайл','input[type="url"]','трек песня плеер музыка'],
  ['layout','Выравнивание','#layout-alignment','сетка горизонталь вертикаль центр'],
  ['layout','Автосортировка','#layout-sort','порядок сетка сортировка'],
  ['layout','Сохранить текущую раскладку','#layout-slots','пресет шаблон слот моя раскладка'],
  ['layout','Готовые раскладки','.layout-options button','пресет шаблон стандартная работа отдых'],
  ['layout','Сбросить раскладку','#layout-reset','стандартная по умолчанию восстановить сброс'],
  ['account','Состояние синхронизации','#cloud-settings','синхронизация облачный профиль последнее обновление статус аккаунт'],
  ['account','Синхронизировать сейчас','.cloud-primary[aria-label="Синхронизировать сейчас"]','синхронизация облако обмен браузеры обновить'],
  ['account','Вход и выход из аккаунта','.cloud-primary','яндекс id авторизация профиль войти выйти'],
  ['account','Скачать настройки','#settings-backup','экспорт конфиг файл резервная копия сохранить пк'],
  ['account','Загрузить с ПК','#settings-backup','импорт конфиг файл восстановить перенос настройки']
];
const wallpaperNames={'':'Без обоев',horizon:'Горизонт',aurora:'Сумерки'};
let settingsPage='';

const settingsSearchStopWords=new Set(['где','как','мне','найти','поменять','сменить','изменить']);
function settingsTerms(text) {
  return text.toLowerCase().replaceAll('ё','е').match(/[\p{L}\p{N}]+/gu) || [];
}
function findSettings(value) {
  const terms=settingsTerms(value).filter(word=>!settingsSearchStopWords.has(word));
  const sections=Object.entries(settingsTitles).map(([page,title])=>[page,title]);
  const visibility=ids.map(id=>['widgets','Показывать · '+names[id],'#visible-'+id,'скрыть включить выключить виджет']);
  const widgets=widgetSettings.map(id=>[id,names[id],null,'настроить виджет']);
  return [...sections,...settingsOptions,...widgets,...visibility]
    .map(([page,title,target,aliases=''])=>{
      const path=names[page]&&widgetSettings.includes(page)
        ? 'Виджеты · '+names[page] : settingsTitles[page];
      const titleWords=settingsTerms(title);
      const extraWords=settingsTerms(path+' '+aliases);
      const scores=terms.map(term=>titleWords.includes(term)?5
        : titleWords[0]?.startsWith(term)?4
        : titleWords.some(word=>word.startsWith(term))?3
        : extraWords.some(word=>word.startsWith(term))?2
        : titleWords.some(word=>word.includes(term))?1 : 0);
      return {page,title,target,path,score:scores.every(Boolean)?scores.reduce((a,b)=>a+b,0):0};
    })
    .filter(result=>result.score)
    .sort((a,b)=>b.score-a.score);
}
function mountSettingsNavigation() {
  const navigation=el('div','settings-navigation');
  const searchBox=el('div','settings-search');
  const query=input();
  query.autocomplete='off';
  query.spellcheck=false;
  query.setAttribute('aria-label','Поиск по настройкам');
  query.setAttribute('role','combobox');
  query.setAttribute('aria-autocomplete','list');
  query.setAttribute('aria-controls','settings-matches');
  const {field:typing,label}=springySearchField(query);
  label.textContent='Поиск по настройкам';
  const clear=btn('Очистить поиск','×',()=>{reset();query.focus()},'settings-search-clear');
  searchBox.append(icon('search'),typing,clear);
  const sections=el('nav','settings-sections');
  sections.setAttribute('aria-label','Разделы настроек');
  for(const [page,title] of Object.entries(settingsTitles)){
    const button=btn(title,title,()=>showSettings(page),'settings-section');
    button.prepend(icon(settingsIcons[page]));
    button.dataset.section=page;
    sections.append(button);
  }
  const results=el('div','settings-matches');
  results.id='settings-matches';
  results.setAttribute('role','listbox');
  results.setAttribute('aria-label','Подходящие настройки');
  const status=el('p','settings-match-status');
  status.setAttribute('role','status');
  navigation.append(searchBox,sections,results,status);
  fields.before(navigation);

  let matches=[], active=-1;
  function choose(index) {
    active=index;
    const options=Array.from(results.children);
    options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===index)));
    if(active<0)query.removeAttribute('aria-activedescendant');
    else {
      query.setAttribute('aria-activedescendant',options[active].id);
      options[active].scrollIntoView({block:'nearest'});
    }
  }
  function render() {
    const searching=Boolean(query.value.trim());
    matches=searching?findSettings(query.value):[];
    results.replaceChildren(...matches.map(({title,path},i)=>{
      const item=el('div','settings-match');
      item.id='settings-match-'+i;
      item.setAttribute('role','option');
      item.append(el('strong','',title));
      if(title!==path)item.append(el('small','',path));
      item.onmousedown=event=>event.preventDefault();
      item.onclick=()=>open(i);
      return item;
    }));
    query.setAttribute('aria-expanded',String(matches.length>0));
    clear.hidden=!query.value;
    sections.hidden=fields.hidden=searching;
    results.hidden=!matches.length;
    status.textContent=searching&&!matches.length?'Ничего не найдено':'';
    status.hidden=!status.textContent;
    choose(-1);
  }
  function reset() {
    if(query.value){
      query.value='';
      query.dispatchEvent(new Event('input'));
    }else render();
  }
  function open(index) {
    const result=matches[index];
    if(result)showSettings(result.page,result.target || '#settings-page-title',true);
  }
  query.addEventListener('input',render);
  query.addEventListener('keydown',event=>{
    if(event.isComposing)return;
    if(event.key==='Escape'&&query.value){
      event.preventDefault();
      reset();
    }else if(matches.length&&['ArrowDown','ArrowUp','Enter'].includes(event.key)){
      event.preventDefault();
      if(event.key==='Enter')open(Math.max(0,active));
      else if(active<0)choose(event.key==='ArrowDown'?0:matches.length-1);
      else choose((active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length);
    }
  });
  render();
  return {navigation,reset};
}
let settingsNavigation;

function themeFields() {
  const group=el('fieldset','settings-theme');
  group.id='settings-theme';
  group.append(el('legend','','Тема'));
  const options=el('div','settings-theme-options');
  for(const [value,title] of [['dark','Тёмная'],['light','Светлая'],['system','Системная']]){
    const label=el('label');
    const radio=input(value,'radio');
    radio.name='todayis-theme';
    radio.checked=state.theme===value;
    radio.onchange=async()=>{
      const focused=document.activeElement===radio;
      await change(s=>s.theme=value);
      if(focused&&document.activeElement===document.body&&settingsPage==='appearance'&&dialog.open){
        fields.querySelector('#settings-theme input:checked')?.focus();
      }
    };
    label.append(radio,el('span','',title));
    options.append(label);
  }
  group.append(options);
  fields.append(group);
}

function syncAccentFields() {
  const group = fields.querySelector('.accent-palette');
  if (!group) return;
  fields.querySelector('#accent-mode').value = state.accentMode;
  group.hidden = state.accentMode === 'wallpaper';
  for (const swatch of group.querySelectorAll('input')) swatch.checked = swatch.value === state.accentColor;
}

function accentFields() {
  const mode = el('select');
  mode.id = 'accent-mode';
  for (const [value,label] of [['manual','Из палитры'],['wallpaper','По обоям']]) {
    const option = el('option','',label);
    option.value = value;
    mode.append(option);
  }
  mode.onchange = async()=>{
    const value = mode.value;
    await change(s=>s.accentMode=value);
    syncAccentFields();
  };
  field('Акцентный цвет',mode);
  const palette = el('fieldset','accent-palette');
  palette.append(el('legend','','Выбрать цвет'));
  for (const [color,name] of Object.entries(accentPalette)) {
    const label = el('label','accent-swatch');
    label.title = name;
    const swatch = el('input');
    swatch.type = 'radio';
    swatch.name = 'accent-color';
    swatch.value = color;
    swatch.setAttribute('aria-label',name);
    swatch.style.setProperty('--swatch',color);
    swatch.onchange = async()=>{
      await change(s=>s.accentColor=color);
      syncAccentFields();
    };
    label.append(swatch);
    palette.append(label);
  }
  fields.append(palette);
  syncAccentFields();
}

function wallpaperFields() {
  const custom = el('form','settings-url');
  const address = input(url(state.wall),'url');
  const label = el('label','field','Ссылка на обои');
  const apply = el('button','','Применить ссылку');
  address.required = true;
  address.placeholder = 'https://…';
  apply.type = 'submit';
  label.append(address);
  custom.append(label,apply);
  const selectWallpaper = async wall=>{
    try {
      await navigator.locks.request(deviceWallpaperKey,async()=>{
        if (await change(s=>s.wall=wall)) await chrome.storage.local.remove(deviceWallpaperKey);
      });
    }
    catch { toast('Не удалось заменить фото с устройства'); }
  };
  const options = [...Object.entries(wallpaperNames),['custom','По ссылке']];
  if (deviceWallpaper) options.push(['device','Фото с устройства']);
  const current = deviceWallpaper ? 'device' : url(state.wall) ? 'custom' : state.wall;
  selectField('Обои',options,current,value=>{
    custom.hidden = value !== 'custom';
    if (value === 'custom') address.focus();
    else if (value !== 'device') selectWallpaper(value);
  }).id='settings-wallpaper';
  custom.hidden = current !== 'custom';
  custom.onsubmit = event=>{
    event.preventDefault();
    const wall = url(address.value);
    if (wall) selectWallpaper(wall);
    else toast('Введите адрес HTTP или HTTPS');
  };
  fields.append(custom);

  const upload = el('div','wallpaper-upload');
  const preview = el('span','wallpaper-preview');
  preview.setAttribute('aria-hidden','true');
  if (deviceWallpaper) {
    const image = el('img');
    image.src = deviceWallpaper.image;
    image.alt = '';
    preview.append(image);
  } else preview.append(icon('appearance'));
  const copy = el('div','wallpaper-upload-copy');
  copy.append(el('strong','','Фото с устройства'),el('small','',deviceWallpaper?.name || 'Хранится в этом браузере'));
  const picker = el('input','wallpaper-file');
  picker.type = 'file';
  picker.accept = 'image/*';
  picker.setAttribute('aria-label','Выбрать фото с устройства');
  const action = el('label','wallpaper-file-button');
  action.append(picker,el('span','',deviceWallpaper?'Заменить фото':'Выбрать фото'));
  upload.append(preview,copy,action);
  fields.append(upload);
  picker.onchange = async()=>{
    const file = picker.files[0];
    if (!file) return;
    picker.disabled = true;
    action.lastElementChild.textContent = 'Загрузка…';
    try {
      await navigator.locks.request(deviceWallpaperKey,async()=>{
        await chrome.storage.local.set({[deviceWallpaperKey]:await prepareWallpaper(file)});
      });
      if (dialog.open && settingsPage === 'appearance') fields.querySelector('.wallpaper-file')?.focus();
    } catch(error) {
      toast(error.message || 'Не удалось сохранить фото');
    } finally {
      picker.value = '';
      picker.disabled = false;
      action.lastElementChild.textContent = deviceWallpaper?'Заменить фото':'Выбрать фото';
    }
  };
}

function settings(){showSettings('appearance',null,true)}
function showSettings(page,target,fromSearch=false){
  const opening=activeDialog!=='settings'||!dialog.open;
  const navigate=opening||page!==settingsPage||target;
  let ready;
  settingsPage=page;
  const widgetPage=widgetSettings.includes(page);
  modal('Настройки','settings');
  if(!settingsNavigation?.navigation.isConnected)settingsNavigation=mountSettingsNavigation();
  if(fromSearch||opening)settingsNavigation.reset();
  const selected=widgetPage?'widgets':page;
  for(const section of settingsNavigation.navigation.querySelectorAll('[data-section]')){
    if(section.dataset.section===selected)section.setAttribute('aria-current','page');
    else section.removeAttribute('aria-current');
  }
  if(widgetPage)fields.append(btn('К списку виджетов','‹ Все виджеты',()=>{
    showSettings('widgets','[data-page="'+page+'"]');
  },'settings-back'));
  const heading=el('h3','settings-page-title',settingsTitles[page]||names[page]);
  heading.id='settings-page-title';
  heading.tabIndex=-1;
  fields.append(heading);
  if(page==='layout'){
    ready=renderLayouts();
  }else if(page==='appearance'){
    themeFields();
    wallpaperFields();
    accentFields();
    widgetScaleField();
  }else if(page==='search'){
    selectField('Поисковая система',Object.keys(engines).map(k=>[k,k]),state.engine,v=>change(s=>s.engine=v)).id='settings-engine';
  }else if(page==='widgets'){
    for(const id of state.order){
      const row=el('div','settings-widget'),toggle=input('','checkbox');
      toggle.id='visible-'+id;
      toggle.setAttribute('aria-label','Показывать виджет «'+names[id]+'»');
      const label=el('label','settings-widget-name',names[id]);
      label.htmlFor=toggle.id;
      if(paths[id])label.prepend(icon(id));
      row.append(label);
      toggle.checked=!state.hidden.includes(id);toggle.onchange=async()=>{
        const restoreFocus=document.activeElement===toggle;
        await change(s=>{s.hidden=toggle.checked?s.hidden.filter(k=>k!==id):[...new Set([...s.hidden,id])]});
        const current=fields.querySelector('#visible-'+id);
        if(current){
          current.checked=!state.hidden.includes(id);
          if(restoreFocus&&document.activeElement===document.body)current.focus();
        }
      };
      row.append(toggle);
      if(widgetSettings.includes(id)){
        const open=btn('Настроить виджет «'+names[id]+'»','Настроить',()=>showSettings(id),'widget-options');
        open.dataset.page=id;row.append(open);
      }
      fields.append(row);
    }
  }else if(page==='bookmarks'){bookmarkFields();
  }else if(page==='clock'){clockFields();
  }else if(page==='greeting'){
    const nickname=input(state.tiles.greeting.nickname);
    nickname.id='settings-nickname';
    nickname.maxLength=40;nickname.placeholder='Например, Юра';
    field('Имя или псевдоним',nickname);
    const showDate = input('', 'checkbox');
    showDate.id='settings-greeting-date';
    showDate.checked = state.tiles.greeting.showDate;
    const dateLabel = el('label', 'row');
    dateLabel.append('Показывать дату', showDate);
    fields.append(dateLabel);
    formSave('Сохранить',async()=>{
      const name=nickname.value.trim();
      await change(s=>{s.tiles.greeting.nickname=name;s.tiles.greeting.showDate=showDate.checked});
      if(state.tiles.greeting.nickname===name && state.tiles.greeting.showDate===showDate.checked && settingsPage==='greeting' && dialog.open)showSettings('widgets');
    });
  }else if(page==='music'){
    musicFields();
  }else if(page==='weather'){
    weatherCityFields();
  }else{
    const section=el('section','cloud-settings');section.id='cloud-settings';section.tabIndex=-1;fields.append(section);ready=renderCloud();backupFields(fields);
  }
  if(navigate){
    dialog.scrollTop=0;
    if(target){
      const focusTarget=()=>{
        if(!dialog.open||!heading.isConnected||fields.hidden)return;
        const destination=fields.querySelector(target+':not(:disabled)')||heading;
        if(target==='.settings-url input'&&destination!==heading){
          fields.querySelector('#settings-wallpaper').value='custom';
          destination.closest('form').hidden=false;
        }
        destination.focus({preventScroll:true});
        destination.scrollIntoView({block:'nearest'});
      };
      if(ready&&!fields.querySelector(target)){
        heading.focus({preventScroll:true});
        ready.then(()=>{if(document.activeElement===heading)focusTarget()},()=>{});
      }else focusTarget();
    }else if(widgetPage)heading.focus({preventScroll:true});
  }
}
function cancelGesture(){if(!gesture)return;const g=gesture;gesture=null;if(board.hasPointerCapture(g.pid))board.releasePointerCapture(g.pid);g.card.classList.remove('moving');g.card.style.transform='';g.ghost.remove();board.querySelector('.target')?.classList.remove('target')}
function snapshotPositions(s) {
  return cleanPositions(packAll(s,columns()));
}
function applyEdit(id,next) {
  edit.positions=snapshotPositions(edit);
  edit.positions[id]={x:next.x,y:next.y};
  if(next.size)Object.assign(edit.tiles[id],{size:next.size,rows:next.h});
  if(columns()<6)edit.order.sort((a,b)=>{
    const p=edit.positions[a],q=edit.positions[b];
    return (p?.y??Infinity)-(q?.y??Infinity)||(p?.x??0)-(q?.x??0);
  });
  layout();
}
async function finishLayout() {
  if(!edit||finishLayout.pending)return;
  finishLayout.pending=true;
  try{
    const snapshot=layoutSnapshot(edit);
    if(await change(s=>applyLayout(s,snapshot))){edit=null;draw()}
  }finally{finishLayout.pending=false}
}
function availableSizes(id) {
  const cols=columns(), {x,y}=pos[id];
  const others={...pos};
  delete others[id];
  return sizesFor(id).filter(p=>widths[p.size]<=cols).map(p=>{
    const rect={x,y,w:widths[p.size],h:p.rows,size:p.size};
    return {...rect,available:fits(rect,others,cols)};
  });
}
function showSizes(id) {
  modal('Размер · '+names[id],'layout-size');
  const list=el('div','layout-options');
  for(const p of availableSizes(id)) {
    const b=btn(p.w+' × '+p.h,p.w+' × '+p.h,()=>{applyEdit(id,p);dialog.close()},'layout-option');
    b.style.setProperty('--preview-w',p.w);
    b.style.setProperty('--preview-h',p.h);
    b.disabled=!p.available;
    if(!p.available)b.append(el('small','',p.x+p.w>columns()?'За краем':'Занято'));
    b.setAttribute('aria-pressed',String(edit.tiles[id].size===p.size&&edit.tiles[id].rows===p.h));
    list.append(b);
  }
  fields.append(list);
}
function layoutPreview(snapshot) {
  const grid=el('span','layout-preview');
  grid.setAttribute('aria-hidden','true');
  for(const p of Object.values(packAll(snapshot))){
    const cell=el('span');
    cell.style.gridArea=(p.y+1)+' / '+(p.x+1)+' / span '+p.h+' / span '+p.w;
    grid.append(cell);
  }
  return grid;
}
async function customLayouts() {
  const data=await chrome.storage.local.get('todayIsLayouts');
  return Array.from({length:3},(_,i)=>data.todayIsLayouts?.[i]||null);
}
async function renderLayouts() {
  const host=el('div','layout-library');
  fields.append(host);
  const editing=Boolean(edit);
  if(!editing){
    const alignment=el('fieldset','settings-layout-alignment');
    alignment.append(el('legend','','Выравнивание'));
    for(const [key,title,labels] of [
      ['alignX','По горизонтали',['Слева','По центру','Справа']],
      ['alignY','По вертикали',['Сверху','По центру','Снизу']]
    ]){
      const options=['start','center','end'];
      const control=el('select');
      if(key==='alignX')control.id='layout-alignment';
      control.append(...options.map((value,i)=>{
        const item=el('option','',labels[i]);item.value=value;return item;
      }));
      control.value=state[key];
      control.onchange=async()=>{
        await change(s=>s[key]=control.value);
        control.value=state[key];
      };
      const label=el('label','field',title);
      label.append(control);
      alignment.append(label);
    }
    const sort=btn('Автосортировка','Автосортировка',sortLayout);
    sort.id='layout-sort';
    alignment.append(sort);
    host.append(alignment);
    const presets=el('div','layout-options');
    for(const [title,first] of [['Стандартная',ids],['Для работы',['search','tasks','calendar','bookmarks']],['Для отдыха',['music','weather','clock','search']]]) {
      const snapshot=normalize({order:first});
      const b=btn(title,title,()=>change(s=>applyLayout(s,layoutSnapshot(snapshot))),'layout-option');
      b.prepend(layoutPreview(snapshot));
      presets.append(b);
    }
    host.append(el('h4','','Готовые раскладки'),presets);
  }
  const slotsHeading=el('h4','','Мои раскладки');
  slotsHeading.id='layout-slots';
  slotsHeading.tabIndex=-1;
  host.append(slotsHeading);
  if(editing)host.append(el('p','muted','Выбери, куда сохранить текущую раскладку.'));
  try{
    const slots=await customLayouts();
    if(!host.isConnected)return;
    slots.forEach((slot,i)=>{
      const row=el('div','layout-slot');
      row.append(el('strong','','Раскладка '+(i+1)));
      if(slot){
        const snapshot=layoutSnapshot(normalize(slot));
        snapshot.alignX=slot.alignX===undefined?undefined:snapshot.alignX;
        snapshot.alignY=slot.alignY===undefined?undefined:snapshot.alignY;
        row.append(layoutPreview(snapshot));
        if(!editing)row.append(btn('Применить раскладку '+(i+1),'Применить',()=>change(s=>applyLayout(s,snapshot))));
      }
      const save=btn('Сохранить в слот '+(i+1),slot?'Перезаписать':'Сохранить',async()=>{
        const snapshot=layoutSnapshot(edit||state);
        save.disabled=true;
        try{
          await navigator.locks.request('today-is-layout-slots',async()=>{
            const latest=await customLayouts();
            latest[i]=snapshot;
            await chrome.storage.local.set({todayIsLayouts:latest});
          });
          if(host.isConnected)showSettings('layout','#layout-slots');
          toast('Раскладка сохранена');
        }catch{toast('Не удалось сохранить раскладку');save.disabled=false}
      });
      row.append(save);
      host.append(row);
    });
  }catch{host.append(el('p','','Не удалось открыть сохранённые раскладки'))}
  if(!editing){
    const reset=btn('Сбросить раскладку','Сбросить раскладку',()=>change(s=>{
      applyLayout(s,layoutSnapshot(normalize()));
    }));
    reset.id='layout-reset';
    host.append(reset);
  }
}
board.onpointerdown=e=>{
  if(!edit||gesture||!e.isPrimary||e.button!==0)return;
  const card=e.target.closest('.card');
  if(!card||e.target.closest('.tools'))return;
  const id=card.dataset.id,ghost=el('div','ghost');
  ghost.hidden=true;
  board.append(ghost);
  gesture={pid:e.pointerId,card,id,x:e.clientX,y:e.clientY,start:pos[id],
    resize:!!e.target.closest('.grip'),ghost};
  board.setPointerCapture(e.pointerId);
};
function consider(e){
  const g=gesture;
  if(!g||e.pointerId!==g.pid)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.active&&Math.hypot(dx,dy)<4)return;
  g.active=true;
  const {cw,rh}=metrics(), cols=columns();
  const others={...pos};
  delete others[g.id];
  let next;
  if(g.resize){
    const w=g.start.w+dx/(cw+gap),h=g.start.h+dy/(rh+gap);
    const options=availableSizes(g.id);
    const distance=p=>((p.w-w)*(cw+gap))**2+((p.h-h)*(rh+gap))**2;
    next=options.sort((a,b)=>distance(a)-distance(b))[0];
  }else{
    next={...g.start,x:g.start.x+Math.round(dx/(cw+gap)),y:g.start.y+Math.round(dy/(rh+gap))};
    g.card.classList.add('moving');
    g.card.style.transform='translate('+dx+'px,'+dy+'px)';
  }
  if(!next)return;
  const allowed=next.y<=1000&&fits(next,others,cols);
  if(allowed)g.next=next;
  g.ghost.hidden=false;
  g.ghost.classList.toggle('bad',!allowed);
  g.ghost.textContent=allowed?(g.resize?next.w+' × '+next.h:''):'×';
  place(g.ghost,box(next));
}
board.onpointermove=consider;
board.onpointerup=e=>{
  if(gesture?.pid!==e.pointerId)return;
  consider(e);
  const {next,id,resize,active}=gesture;
  cancelGesture();
  if(next)applyEdit(id,next);
  if(resize&&!active)showSizes(id);
};
board.onpointercancel=cancelGesture;
board.onlostpointercapture=cancelGesture;
window.addEventListener('blur',cancelGesture);
window.addEventListener('keydown',e=>{if(e.key==='Escape')cancelGesture()});
new ResizeObserver(()=>{cancelGesture();layout()}).observe(board);
$('#close').onclick=()=>dialog.close();dialog.onclose=()=>{
  if (activeDialog.startsWith('tasks')) restoreTasksCardFocus();
  activeDialog='';
  if (widgetScalePreview !== null) {
    widgetScalePreview = null;
    updateWidgetScale();
  }
};dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}};
audio.ondurationchange=()=>drawOne('music');
audio.ontimeupdate=()=>{
  const line=board.querySelector('.local-timeline');
  if(line&&!line.dataset.drag)systemMusic.paint(line,audio.currentTime);
};
audio.onplay=audio.onpause=audio.onended=()=>drawOne('music');audio.onerror=()=>{if(audio.getAttribute('src')){musicError='Источник недоступен';drawOne('music')}};

async function systemInfo(){try{const info=await chrome.system.cpu.getInfo();cpu=info.numOfProcessors+' поток.';const platform=await chrome.runtime.getPlatformInfo();if(platform.os==='cros'){const m=await chrome.system.memory.getInfo();memory=((m.capacity-m.availableCapacity)/2**30).toFixed(1)+' / '+(m.capacity/2**30).toFixed(1)+' ГБ'}}catch{cpu='Недоступно'}drawOne('system')}
function stale(q){return !Number.isInteger(q.index)||!quotes[q.index]||!Number.isFinite(q.at)||Date.now()-q.at>=86400000||q.at>Date.now()}
function rotateQuote(){if(stale(state.quote))change(s=>{if(stale(s.quote))s.quote={index:(Number.isInteger(s.quote.index)?s.quote.index+1:Math.floor(Math.random()*quotes.length))%quotes.length,at:Date.now()}})}
async function init(){draw();if(!globalThis.chrome?.storage?.sync){syncStatus='Откройте страницу как расширение Chrome';return}initCloud();let receivedWallpaperChange=false;chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[deviceWallpaperKey]){receivedWallpaperChange=true;updateDeviceWallpaper(changes[deviceWallpaperKey].newValue)}if(area==='local'&&changes[cloudKey]){refresh();renderCloud()}if(area==='sync'&&Object.keys(changes).some(k=>k.startsWith('gntd.')))refresh().catch(()=>toast('Ошибка чтения настроек'))});
 try{const photo=(await chrome.storage.local.get(deviceWallpaperKey))[deviceWallpaperKey];if(!receivedWallpaperChange)updateDeviceWallpaper(photo);await refresh();rotateQuote()}catch{syncStatus='Ошибка чтения настроек';toast(syncStatus)}
 bookmarks();for(const event of ['onCreated','onRemoved','onChanged','onMoved','onImportEnded','onChildrenReordered'])chrome.bookmarks[event].addListener(bookmarks);systemInfo();let lastDay=day(new Date()),hour=new Date().getHours();
setInterval(()=>{const now=new Date();for(const t of document.querySelectorAll('[data-clock-display]'))updateClock(t,now);if(hour!==now.getHours()||lastDay!==day(now)){hour=now.getHours();updateGreeting(board.querySelector('[data-id=greeting] .inside'),now)}if(lastDay!==day(now)){lastDay=day(now);drawOne('calendar');drawOne('tasks')}if(dialog.open&&activeDialog==='tasks'&&tasksView.mode==='list'&&!tasksView.completed)updateTasksDueView(now);rotateQuote()},15000);setInterval(()=>{if(!document.hidden&&memory)systemInfo()},60000)}
init();
