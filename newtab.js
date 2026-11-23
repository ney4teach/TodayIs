'use strict';
const $ = s => document.querySelector(s);
const board = $('#board'), dialog = $('#dialog'), fields = $('#fields');
const names = {greeting:'Приветствие',clock:'Часы',search:'Поиск',weather:'Погода',bookmarks:'Закладки',calendar:'Календарь',tasks:'Задачи',quote:'Цитата',music:'Музыка',system:'Система'};
const ids = Object.keys(names), widths = {xs:1,sm:2,md:3,lg:4,xl:6}, gap = 16, rows = 5;
const engines = {Google:'https://www.google.com/search?q=',Яндекс:'https://yandex.ru/search/?text=',DuckDuckGo:'https://duckduckgo.com/?q='};
const quotes = ['Большие дела начинаются с маленького шага.','Оставь сегодня место для любопытства.','Иногда лучшая идея приходит во время прогулки.','Даже короткая пауза помогает увидеть больше.','У каждого дела есть первый черновик.','Найди время для того, что хочется запомнить.'];
const paths={appearance:'M12 3a9 9 0 1 0 0 18c3 0 3-2 2-3s-1-3 1-3h2a5 5 0 0 0 4-5c0-4-4-7-9-7z M7 11h.1 M10 7h.1 M15 8h.1',account:'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21a8 8 0 0 1 16 0',clock:'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',weather:'M6 18a5 5 0 0 1 0-10 7 7 0 0 1 13 2 4 4 0 0 1 0 8Z',bookmarks:'M6 4h12v17l-6-4-6 4Z',calendar:'M3 6h18v15H3z M3 10h18 M7 3v5m10-5v5',tasks:'M3 6l2 2 3-4m3 3h10 M3 15l2 2 3-4m3 3h10',quote:'M4 11h6v7H3v-6q0-5 6-7 M15 11h6v7h-7v-6q0-5 6-7',music:'M9 17V6l11-3v12 M9 17a3 2 0 1 1-6 0 3 2 0 0 1 6 0 M20 15a3 2 0 1 1-6 0 3 2 0 0 1 6 0',system:'M6 6h12v12H6z M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',manage:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',sort:'M3 5h17M3 11h12M3 17h6m8-3 3 4 3-4m-3-5v9',settings:'M4 6h16M4 12h16M4 18h16 M9 3v6m7 0v6m-8 0v6'};
function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n}
function icon(key){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [k,v] of Object.entries({viewBox:'0 0 24 24',class:'ico',fill:'none',stroke:'currentColor','stroke-width':1.6,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':true}))n.setAttribute(k,v);const p=document.createElementNS(n.namespaceURI,'path');p.setAttribute('d',paths[key]);n.append(p);return n}
function btn(label,txt,fn,cls=''){const b=el('button',cls,txt);b.type='button';b.title=label;b.setAttribute('aria-label',label);b.onclick=fn;return b}
function link(label,url){const a=el('a','',label);a.href=url;return a}
function url(v){try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
function one(v,options,d){return options.includes(v)?v:d}
function day(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function defaults(id){return {size:['greeting','search'].includes(id)?'lg':'sm',rows:['bookmarks','calendar','tasks'].includes(id)?2:1}}
function packAll(s){const used=Array.from({length:rows},()=>Array(6).fill(false)),out={};
 for(const id of s.order){if(s.hidden.includes(id))continue;const w=widths[s.tiles[id].size],h=s.tiles[id].rows;let found=false;
 for(let y=0;y<=rows-h&&!found;y++)for(let x=0;x<=6-w&&!found;x++){
 if(used.slice(y,y+h).some(row=>row.slice(x,x+w).some(Boolean)))continue;
 used.slice(y,y+h).forEach(row=>row.fill(true,x,x+w));out[id]={x,y,w,h};found=true}
 if(!found)return null}return out}
const clockCities = {
  local:'Местное время', 'Europe/Kaliningrad':'Калининград', 'Europe/Moscow':'Москва',
  'Asia/Yekaterinburg':'Екатеринбург', 'Asia/Novosibirsk':'Новосибирск',
  'Asia/Irkutsk':'Иркутск', 'Asia/Vladivostok':'Владивосток', 'Europe/London':'Лондон',
  'Europe/Paris':'Париж', 'Asia/Dubai':'Дубай', 'Asia/Tokyo':'Токио', 'America/New_York':'Нью-Йорк'
};
function clockOptions(raw = {}) {
  const cities = ['local', ...Object.keys(clockCities).filter(zone => zone !== 'local' && Array.isArray(raw?.cities) && raw.cities.includes(zone))];
  return {face:one(raw?.face,['digital','analog'],'digital'), cities, zone:one(raw?.zone,cities,'local')};
}
const widgetScaleRange = {min:60, max:100, step:5};

function normalizeWidgetScale(value) {
  const {min,max,step} = widgetScaleRange;
  if (!Number.isFinite(value)) return max;
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

function normalize(raw={}){raw=raw&&typeof raw==='object'?raw:{};const list=v=>Array.isArray(v)?[...new Set(v.filter(id=>ids.includes(id)))]:[];
 const s={widgetScale:normalizeWidgetScale(raw.widgetScale),bookmarkSource:one(raw.bookmarkSource,['custom','browser'],'custom'),bookmarkFolder:typeof raw.bookmarkFolder==="string"?raw.bookmarkFolder:"",clock:clockOptions(raw.clock),order:[...new Set([...list(raw.order),...ids])],hidden:list(raw.hidden),tiles:{},theme:one(raw.theme,['dark','light'],'dark'),wall:typeof raw.wall==='string'?raw.wall:'',engine:one(raw.engine,Object.keys(engines),'Google'),alignX:one(raw.alignX,['start','center','end'],'center'),alignY:one(raw.alignY,['start','center','end'],'center'),manage:raw.manage===true,musicTint:raw.musicTint!==false,track:url(raw.track),trackName:String(raw.trackName||'').slice(0,120),tasks:[],events:[],quote:raw.quote||{},weather:raw.weather||{}};
 for(const id of ids){const t=raw.tiles?.[id]||{},d=defaults(id);s.tiles[id]={size:one(t.size,Object.keys(widths),d.size),rows:one(t.rows,[1,2,3],d.rows),text:t.text===true};if(id==='greeting')s.tiles[id].nickname=typeof t.nickname==='string'?t.nickname.trim().slice(0,40):''}
 for(const type of ['tasks','events'])s[type]=(Array.isArray(raw[type])?raw[type]:[]).filter(r=>r&&typeof r.id==='string'&&typeof r.text==='string'&&r.text.trim()&&(type==='tasks'||/^\d{4}-\d\d-\d\d$/.test(r.date))).map(r=>({id:r.id,text:r.text.slice(0,240),...(type==='tasks'?{done:!!r.done}:{date:r.date})}));
 Object.assign(s, normalizeCustomBookmarks(raw));
 s.cities=Array.isArray(raw.cities)?raw.cities.filter(validWeatherCity):[];
 s.weatherCity=s.cities.some(c=>c.id===raw.weatherCity)?raw.weatherCity:'auto';
 if(!packAll(s)){s.order=[...ids];ids.forEach(id=>Object.assign(s.tiles[id],defaults(id)))}return s}
let state=normalize(),pos={},gesture=null,syncStatus='Чтение…',timer,month=new Date(),cpu='…',memory='',musicError='',activeDialog='';
const audio=new Audio();audio.preload='none';
function toast(msg){$('#notice').textContent=msg;clearTimeout(timer);timer=setTimeout(()=>$('#notice').textContent='',2800)}
const recordCollections=['tasks','events','cities','linkCategories','siteTiles'];
function unpack(data){const raw={};for(const [k,v] of Object.entries(data)){if(k.startsWith('gntd.')){const [,type,id]=k.split('.');if(id&&recordCollections.includes(type))(raw[type]??=[]).push(v);else raw[type]=v}}for(const k of ['tasks','events'])raw[k]?.sort((a,b)=>String(a?.id).localeCompare(String(b?.id)));return normalize(raw)}
function flatten(s){const out={};for(const [k,v] of Object.entries(s)){if(recordCollections.includes(k))v.forEach(r=>out['gntd.'+k+'.'+r.id]=r);else out['gntd.'+k]=v}return out}
async function change(fn){try{await navigator.locks.request('gntd-write',async()=>{const account=await cloudAccount(),raw=await dashboardData(account),s=unpack(raw),before=structuredClone(flatten(s));fn(s);if(!packAll(s))throw Error('Для такого размера нет места');const after=flatten(normalize(s)),set={},remove=[];
 for(const [k,v] of Object.entries(after))if(JSON.stringify(before[k])!==JSON.stringify(v))set[k]=v;
 for(const k of Object.keys(before))if(!(k in after))remove.push(k);
 await writeDashboard(account,set,remove);await refresh()})}catch(e){toast(e.message);syncStatus='Ошибка сохранения';updateStatus()}}
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

function metrics(){return {cw:(board.clientWidth-5*gap)/6,rh:(board.clientHeight-(rows-1)*gap)/rows}}
function box(p){const {cw,rh}=metrics();return {left:p.x*(cw+gap),top:p.y*(rh+gap),width:p.w*(cw+gap)-gap,height:p.h*(rh+gap)-gap}}
function place(n,r){for(const [k,v] of Object.entries(r))n.style[k]=v+'px'}
function layout(){pos=packAll(state);for(const n of board.querySelectorAll('.card'))if(pos[n.dataset.id])place(n,box(pos[n.dataset.id]))}
function cap(id,extra){const n=el('div','cap');n.append(icon(id),el('span','',names[id]));if(extra)n.append(extra);return n}
function modal(title,key){
  if (widgetScalePreview !== null) {
    widgetScalePreview = null;
    updateWidgetScale();
  }
if(key!=='settings')dialog.querySelector('.settings-back')?.remove();activeDialog=key;dialog.dataset.view=key;dialog.querySelector('h2').textContent=title;fields.replaceChildren();if(!dialog.open)dialog.showModal()}
function field(label,input){const l=el('label','field',label);l.append(input);fields.append(l)}
function input(value='',type='text'){const n=el('input');n.type=type;n.value=value;return n}
function formSave(label,fn){const form=el('form');form.style.display='contents';form.append(...fields.childNodes);const b=el('button','',label);b.type='submit';form.append(b);fields.append(form);form.onsubmit=e=>{e.preventDefault();fn()}}
function addEntry(type,date){modal(type==='tasks'?'Новая задача':'Событие на '+date,type);const n=input();n.maxLength=240;n.required=true;field(type==='tasks'?'Задача':'Событие',n);formSave('Добавить',()=>{if(!n.value.trim())return;const r={id:Date.now()+'-'+crypto.randomUUID(),text:n.value.trim(),...(date?{date}:{done:false})};change(s=>s[type].push(r));dialog.close()});n.focus()}
function calendar(n){const ym=new Date(month.getFullYear(),month.getMonth(),1),head=el('div','month');
 const move=d=>{month=new Date(ym.getFullYear(),ym.getMonth()+d,1);drawOne('calendar')};
 head.append(btn('Предыдущий месяц','‹',()=>move(-1),'mini'),el('b','',ym.toLocaleDateString('ru',{month:'long',year:'numeric'})),btn('Следующий месяц','›',()=>move(1),'mini'));
 const g=el('div','days');for(const d of ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'])g.append(el('small','',d));
 for(let i=0;i<(ym.getDay()+6)%7;i++)g.append(el('i'));
 for(let i=1;i<=new Date(ym.getFullYear(),ym.getMonth()+1,0).getDate();i++){const date=day(new Date(ym.getFullYear(),ym.getMonth(),i));const b=btn(date,i,()=>dayDialog(date));if(date===day(new Date()))b.classList.add('today');if(state.events.some(e=>e.date===date))b.classList.add('marked');g.append(b)}
 n.append(cap('calendar'),head,g)}
function dayDialog(date){modal('События · '+new Date(date+'T12:00').toLocaleDateString('ru',{day:'numeric',month:'long'}),'day');const items=state.events.filter(e=>e.date===date);if(!items.length)fields.append(el('small','','Событий пока нет'));for(const item of items){const row=el('div','event');row.append(el('span','',item.text),btn('Удалить событие','×',async()=>{await change(s=>s.events=s.events.filter(e=>e.id!==item.id));dayDialog(date)},'mini'));fields.append(row)}fields.append(btn('Добавить событие','＋ Добавить событие',()=>addEntry('events',date)))}
function editTask(item){modal('Редактирование задачи','edit');const n=input(item.text);n.maxLength=240;n.required=true;field('Задача',n);formSave('Сохранить',()=>{if(!n.value.trim())return;change(s=>{const r=s.tasks.find(r=>r.id===item.id);if(r)r.text=n.value.trim()});dialog.close()});n.select()}
function tasks(n){n.append(cap('tasks',btn('Добавить задачу','＋',()=>addEntry('tasks'),'mini')));if(!state.tasks.length)n.append(btn('Создать первую задачу','＋ Добавить задачу',()=>addEntry('tasks')));
 for(const item of state.tasks){const row=el('div','task'+(item.done?' done':'')),c=input('','checkbox'),t=el('span','',item.text);c.checked=item.done;c.setAttribute('aria-label','Выполнено · '+item.text);c.onchange=()=>change(s=>{const r=s.tasks.find(r=>r.id===item.id);if(r)r.done=c.checked});t.tabIndex=0;t.ondblclick=()=>editTask(item);t.onkeydown=e=>{if(e.key==='Enter')editTask(item)};row.append(c,t,btn('Удалить задачу','×',()=>change(s=>s.tasks=s.tasks.filter(r=>r.id!==item.id)),'mini'));n.append(row)}}
function musicSettings(){showSettings('music')}
function musicFields(){
  fields.append(el('strong','','Медиаплееры Windows'),el('div','muted','Один раз запустите media-host/install.cmd из папки установленного расширения. Виджет подключится автоматически.'));
  const tint=input('','checkbox');tint.checked=state.musicTint;
  field('Оттенок обложки в карточке',tint);
  fields.append(el('strong','','Аудиофайл на случай, когда нет активного плеера'));
  const title=input(state.trackName),src=input(state.track,'url');title.maxLength=120;field('Название',title);field('Ссылка на аудиофайл',src);formSave('Сохранить',()=>{if(src.value&&!url(src.value)){src.setCustomValidity('Укажите HTTP или HTTPS');src.reportValidity();src.setCustomValidity('');return}change(s=>{s.musicTint=tint.checked;s.track=url(src.value);s.trackName=title.value.trim()});showSettings('widgets')})}
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
  updateClock(display);
  n.append(display);
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
  const ring=el('span','activity-ring');
  ring.setAttribute('aria-hidden','true');
  const visible=groups.filter(group=>group.time>0);
  if (visible.length) {
    let angle=0;
    const stops=visible.flatMap((group,index)=>{
      const sweep=360*group.time/total;
      const end=index===visible.length-1?360:angle+sweep;
      const gap=visible.length>1?Math.min(1.75,(end-angle)/4):0;
      const segment=[`transparent ${angle}deg ${angle+gap}deg`,`var(--activity-${group.tone}) ${angle+gap}deg ${end-gap}deg`,`transparent ${end-gap}deg ${end}deg`];
      angle=end;
      return segment;
    });
    ring.style.setProperty('--activity-fill',`conic-gradient(from 24deg,${stops.join(',')})`);
  }
  const mark=el('span','activity-mark');
  mark.append(el('i'),el('i'),el('i'));
  ring.append(mark);
  return ring;
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
  copy.append(el('strong','',value),el('small','','На сайтах · 24 ч'));
  button.replaceChildren(activityRing(groups,total),copy);
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
  const hero=el('div','activity-summary'), copy=el('div');
  copy.setAttribute('aria-live','polite');
  copy.append(el('small','',label),el('strong','',rows?duration(total):'—'));
  hero.append(activityRing(groups,total),copy);
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
  selectField('Циферблат',[['digital','Цифровой'],['analog','Стрелочный']],state.clock.face,v=>change(s=>s.clock.face=v));
  const group = el('fieldset','clock-zones');
  group.append(el('legend','','Города для переключения'));
  for (const [zone,name] of Object.entries(clockCities)) {
    if (zone==='local') continue;
    const label = el('label'), toggle = input('','checkbox');
    toggle.checked = state.clock.cities.includes(zone);
    toggle.onchange = ()=>change(s=>{
      s.clock.cities = toggle.checked ? [...s.clock.cities,zone] : s.clock.cities.filter(v=>v!==zone);
    });
    label.append(toggle,document.createTextNode(name));group.append(label);
  }
  fields.append(group);
}
function contents(id,n){const now=new Date();
 switch(id){
 case 'greeting':{const h=now.getHours(),name=state.tiles.greeting.nickname;const greeting=h<5?'Доброй ночи':h<12?'Доброе утро':h<18?'Добрый день':'Добрый вечер';n.append(el('div','greet-date',now.toLocaleDateString('ru',{weekday:'long',day:'numeric',month:'long'})),el('div','big',name?greeting+', '+name:greeting));break}
 case 'clock':renderClock(n);break;
 case 'search':{n.append(cap(id));const f=el('form','search'),q=input('','search');q.placeholder='Найти в '+state.engine;q.setAttribute('aria-label','Поисковый запрос');const b=el('button','','→');b.setAttribute('aria-label','Искать');f.append(q,b);f.onsubmit=e=>{e.preventDefault();if(q.value.trim())location.assign(engines[state.engine]+encodeURIComponent(q.value.trim()))};n.append(f);break}
 case 'weather':renderWeather(n);break
 case 'bookmarks':renderBookmarks(n);break;
 case 'calendar':calendar(n);break;case 'tasks':tasks(n);break;
 case 'quote':n.append(cap(id),el('p','quote','«'+(quotes[state.quote.index]||quotes[0])+'»'));break;
 case 'music':{n.append(cap(id));if(systemMusic.render(n))break;const r=el('div','music');r.append(btn(audio.paused?'Воспроизвести':'Пауза',audio.paused?'▶':'Ⅱ',async()=>{if(!state.track)return musicSettings();if(!audio.paused)return audio.pause();if(audio.src!==state.track)audio.src=state.track;try{await audio.play()}catch{musicError='Источник недоступен';drawOne(id)}},'play'),el('span','',musicError||state.trackName||(state.track?'Мой трек':'Выбрать трек')));n.append(r);systemMusic.localTimeline(n);break}
 case 'system':n.append(cap(id));for(const [k,v] of [['CPU',cpu],['Загрузка CPU','—'],...(memory?[['Память',memory]]:[])]){const line=el('div','stat');line.append(el('small','',k),el('span','',v));n.append(line)}break}}
function drawOne(id){const card=board.querySelector('[data-id="'+id+'"]');if(!card)return;const n=card.querySelector('.inside');n.replaceChildren();contents(id,n)}
function draw(){cancelGesture();document.body.classList.toggle('light',state.theme==='light');const wall=['horizon','aurora'].includes(state.wall)?'wallpapers/'+state.wall+'.svg':url(state.wall);document.body.style.backgroundImage=wall?'url('+JSON.stringify(wall)+')':'';board.style.setProperty('--board-width',state.alignX==='center'?'100%':'94%');board.style.setProperty('--board-height',state.alignY==='center'?'100%':'94%');$('#panel').style.justifyContent=state.alignX;$('#panel').style.alignItems=state.alignY;board.classList.toggle('manage',state.manage);board.replaceChildren();
 for(const id of state.order){if(state.hidden.includes(id))continue;const card=el('section','card'+(state.tiles[id].text?' text-only':''));card.dataset.id=id;card.setAttribute('aria-label',names[id]);const n=el('div','inside');card.append(n);contents(id,n);if(state.manage){n.inert=true;const tools=el('div','tools');tools.append(btn('Переключить подписи','T',()=>change(s=>s.tiles[id].text=!s.tiles[id].text)),btn('Скрыть виджет','◉',()=>change(s=>s.hidden.push(id))));const grip=btn('Изменить размер','◢',()=>{},'grip');card.append(tools,grip)}board.append(card)}updateWidgetScale();dock()}
function updateStatus(){const n=$('#sync');if(n)n.textContent=syncStatus}
let readRevision=0;
async function refresh(){const revision=++readRevision;const account=await cloudAccount();const next=unpack(await dashboardData(account));if(revision!==readRevision)return;const prev=state;state=next;if(prev.widgetScale!==next.widgetScale&&widgetScalePreview===null)updateWidgetScale();syncStatus=account?'Облачный профиль · локальная копия':'Сохранено в профиле браузера';updateStatus();if(prev.track!==next.track){audio.pause();audio.removeAttribute('src');audio.load();musicError=''}const keys=Object.keys(next).filter(k=>JSON.stringify(next[k])!==JSON.stringify(prev[k]));if(!board.children.length||keys.some(k=>['order','hidden','tiles','theme','wall','alignX','alignY','manage'].includes(k)))draw();else for(const k of keys){const id=({bookmarkSource:'bookmarks',linkCategories:'bookmarks',siteTiles:'bookmarks',bookmarkFolder:'bookmarks',cities:'weather',weatherCity:'weather',events:'calendar',engine:'search',track:'music',trackName:'music',musicTint:'music'})[k]||k;if(ids.includes(id))drawOne(id)}if(dialog.open&&activeDialog==='bookmark-search'&&keys.some(k=>['bookmarkSource','linkCategories','siteTiles'].includes(k)))updateBookmarkResults();if(activeDialog==='settings'&&dialog.open&&keys.some(k=>({appearance:['theme','wall'],search:['engine'],widgets:['hidden','order'],account:[],clock:['clock'],bookmarks:['bookmarkFolder','bookmarkSource','linkCategories','siteTiles']}[settingsPage]||['hidden','theme','wall','engine']).includes(k)))showSettings(settingsPage)}
function dock(){const d=$('#dock');d.replaceChildren();d.classList.toggle('right',state.alignX==='start');for(const [k,chars,label] of [['alignX',['←','•','→'],'По горизонтали'],['alignY',['↑','•','↓'],'По вертикали']]){const vals=['start','center','end'],i=vals.indexOf(state[k]);const b=btn(label+' · '+['начало','центр','конец'][i],chars.join(''),()=>change(s=>s[k]=vals[(vals.indexOf(s[k])+1)%3]));d.append(b)}
 for(const [key,label,fn] of [['manage','Режим управления',()=>change(s=>s.manage=!s.manage)],['sort','Автосортировка',()=>change(s=>{const order=[...s.order].sort((a,b)=>widths[s.tiles[b].size]*s.tiles[b].rows-widths[s.tiles[a].size]*s.tiles[a].rows||ids.indexOf(a)-ids.indexOf(b));if(packAll({...s,order}))s.order=order;else throw Error('Сортировка с текущими размерами не помещается')})],['settings','Настройки',settings]]){const b=btn(label,'',fn);b.append(icon(key));if(key==='manage'){b.classList.toggle('active',state.manage);b.setAttribute('aria-pressed',state.manage)}d.append(b)}}
function selectField(label,options,value,fn){const q=el('select');for(const [k,t] of options){const o=el('option','',t);o.value=k;q.append(o)}q.value=value;q.onchange=()=>fn(q.value);field(label,q)}
const settingsTitles={appearance:'Оформление',search:'Поиск',widgets:'Виджеты',account:'Аккаунт'};
const wallpaperNames={'':'Без обоев',horizon:'Горизонт',aurora:'Сумерки'};
let settingsPage='';

function settings(){showSettings('')}
function showSettings(page){
  const navigate=page!==settingsPage || !dialog.open;
  settingsPage=page;
  const widgetPage=['greeting','clock','weather','music','bookmarks'].includes(page);
  modal(settingsTitles[page]||names[page]||'Настройки','settings');
  const header=dialog.querySelector('header');
  header.querySelector('.settings-back')?.remove();
  if(page){
    const back=btn(widgetPage?'К виджетам':'К обзору настроек','‹',()=>{showSettings(widgetPage?'widgets':'');fields.querySelector('[data-page="'+page+'"]')?.focus()},'settings-back');
    header.prepend(back);
    if(navigate)back.focus();
  }
  if(!page){
    const summaries={
      appearance:(state.theme==='dark'?'Тёмная':'Светлая')+' · '+(wallpaperNames[state.wall]||'Свои обои'),
      search:state.engine,widgets:'Включено '+(ids.length-state.hidden.length)+' из '+ids.length,account:'Профиль браузера'
    };
    for(const [key,title] of Object.entries(settingsTitles)){
      const row=btn(title,'',()=>showSettings(key),'settings-row');
      row.removeAttribute('aria-label');row.dataset.page=key;
      const symbol=el('span','settings-symbol');
      symbol.append(icon(({appearance:'appearance',search:'search',widgets:'manage',account:'account'})[key]));
      const copy=el('span','settings-copy'),summary=el('small','',summaries[key]);
      if(key==='account')summary.id='cloud-summary';
      copy.append(el('strong','',title),summary);
      const arrow=el('span','settings-chevron','›');arrow.setAttribute('aria-hidden','true');
      row.append(symbol,copy,arrow);fields.append(row);
    }
    renderCloud();
  }else if(page==='appearance'){
    widgetScaleField();
    selectField('Тема',[['dark','Тёмная'],['light','Светлая']],state.theme,v=>change(s=>s.theme=v));
    selectField('Обои',[...Object.entries(wallpaperNames),['custom','Свои обои']],url(state.wall)?'custom':state.wall,v=>{
      if(v==='custom'){custom.hidden=false;address.focus()}else{custom.hidden=true;change(s=>s.wall=v)}
    });
    const custom=el('form','settings-url'),label=el('label','field','Ссылка на обои'),address=input(url(state.wall),'url');
    address.required=true;address.placeholder='https://…';label.append(address);
    const apply=el('button','','Применить');apply.type='submit';
    custom.append(label,apply);custom.hidden=!url(state.wall);fields.append(custom);
    custom.onsubmit=e=>{e.preventDefault();const v=url(address.value);if(v)change(s=>s.wall=v);else toast('Введите адрес HTTP или HTTPS')};
  }else if(page==='search'){
    selectField('Поисковая система',Object.keys(engines).map(k=>[k,k]),state.engine,v=>change(s=>s.engine=v));
  }else if(page==='widgets'){
    for(const id of state.order){
      const row=el('div','settings-widget'),toggle=input('','checkbox');
      toggle.id='visible-'+id;
      toggle.setAttribute('aria-label','Показывать виджет «'+names[id]+'»');
      if(['greeting','clock','music','weather','bookmarks'].includes(id)){
        const open=btn('Настроить виджет «'+names[id]+'»',names[id]+' ›',()=>showSettings(id),'widget-options');
        open.dataset.page=id;row.append(open);
      }else{
        const label=el('label','',names[id]);label.htmlFor=toggle.id;row.append(label);
      }
      toggle.checked=!state.hidden.includes(id);toggle.onchange=async()=>{
        await change(s=>{s.hidden=toggle.checked?s.hidden.filter(k=>k!==id):[...new Set([...s.hidden,id])]});
        toggle.checked=!state.hidden.includes(id);
      };
      row.append(toggle);fields.append(row);
    }
    fields.append(btn('Сбросить раскладку','Сбросить раскладку',()=>change(s=>{
      const d=normalize();d.tiles.greeting.nickname=s.tiles.greeting.nickname;for(const k of ['order','tiles','hidden','alignX','alignY'])s[k]=d[k];
    })));
  }else if(page==='bookmarks'){bookmarkFields();
  }else if(page==='clock'){clockFields();
  }else if(page==='greeting'){
    const nickname=input(state.tiles.greeting.nickname);
    nickname.maxLength=40;nickname.placeholder='Например, Юра';
    field('Имя или псевдоним',nickname);
    formSave('Сохранить',async()=>{
      const name=nickname.value.trim();
      await change(s=>{s.tiles.greeting.nickname=name});
      if(state.tiles.greeting.nickname===name && settingsPage==='greeting' && dialog.open)showSettings('widgets');
    });
  }else if(page==='music'){
    musicFields();
  }else if(page==='weather'){
    weatherCityFields();
  }else{
    const section=el('section','cloud-settings');section.id='cloud-settings';fields.append(section);renderCloud();
  }
  if(navigate)dialog.scrollTop=0;
}
function overlapGuard(rects){const all=Object.values(rects).map(box);return all.every((a,i)=>all.slice(i+1).every(b=>a.left+a.width+gap<=b.left+.01||b.left+b.width+gap<=a.left+.01||a.top+a.height+gap<=b.top+.01||b.top+b.height+gap<=a.top+.01))}
function proposal(order,tiles=state.tiles){const p=packAll({...state,order,tiles});return p&&overlapGuard(p)?p:null}
function cancelGesture(){if(!gesture)return;const g=gesture;gesture=null;if(board.hasPointerCapture(g.pid))board.releasePointerCapture(g.pid);g.card.classList.remove('moving');g.card.style.transform='';g.ghost.remove();board.querySelector('.target')?.classList.remove('target')}
board.onpointerdown=e=>{if(!state.manage||gesture||!e.isPrimary||e.button!==0)return;const card=e.target.closest('.card');if(!card||e.target.closest('.tools'))return;e.preventDefault();const id=card.dataset.id,ghost=el('div','ghost');ghost.hidden=true;board.append(ghost);gesture={pid:e.pointerId,card,id,x:e.clientX,y:e.clientY,start:box(pos[id]),resize:!!e.target.closest('.grip'),ghost};board.setPointerCapture(e.pointerId)};
function consider(e){const g=gesture;if(!g||e.pointerId!==g.pid)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.active&&Math.hypot(dx,dy)<3)return;g.active=true;const br=board.getBoundingClientRect(),x=e.clientX-br.left,y=e.clientY-br.top;g.next=null;g.ghost.hidden=true;board.querySelector('.target')?.classList.remove('target');
 const {cw,rh}=metrics();if(g.resize){const w=x-g.start.left,h=y-g.start.top,size=Object.keys(widths).reduce((a,b)=>Math.abs(widths[a]*(cw+gap)-gap-w)<=Math.abs(widths[b]*(cw+gap)-gap-w)?a:b),r=Math.max(1,Math.min(3,Math.round((h+gap)/(rh+gap)))),tiles={...state.tiles,[g.id]:{...state.tiles[g.id],size,rows:r}},p=proposal(state.order,tiles);
 const fits=w>0&&h>0&&x<=br.width+1&&y<=br.height+1&&h<=3*(rh+gap)-gap+rh/2&&p&&p[g.id].x===pos[g.id].x&&p[g.id].y===pos[g.id].y;
 if(fits)g.next={size,rows:r};g.ghost.hidden=false;g.ghost.classList.toggle('bad',!fits);place(g.ghost,{...g.start,width:Math.max(1,w),height:Math.max(1,h)});return}
 g.card.classList.add('moving');g.card.style.transform='translate('+dx+'px,'+dy+'px)';if(x<0||y<0||x>=br.width||y>=br.height)return;
 const hit=Object.keys(pos).find(id=>{const b=box(pos[id]);return x>=b.left&&y>=b.top&&x<b.left+b.width&&y<b.top+b.height});
 if(hit===g.id)return;
 if(hit){const order=[...state.order],a=order.indexOf(g.id),b=order.indexOf(hit);[order[a],order[b]]=[order[b],order[a]];if(proposal(order)){g.next={order};board.querySelector('[data-id="'+hit+'"]').classList.add('target')}return}
 const cx=Math.floor(x/(cw+gap)),cy=Math.floor(y/(rh+gap));if(x-cx*(cw+gap)>cw||y-cy*(rh+gap)>rh)return;
 const rest=state.order.filter(id=>id!==g.id);let best=null;
 for(let i=0;i<=rest.length;i++){const order=rest.toSpliced(i,0,g.id),p=proposal(order, state.tiles);if(!p)continue;const b=p[g.id],dist=(cy>=b.y&&cy<b.y+b.h&&cx>=b.x&&cx<b.x+b.w)?0:Math.abs(b.y-cy)*6+Math.abs(b.x-cx);if(!best||dist<best.dist)best={order,b,dist}}
 if(best){g.next={order:best.order};place(g.ghost,box(best.b));g.ghost.hidden=false}}
board.onpointermove=consider;board.onpointerup=e=>{if(gesture?.pid!==e.pointerId)return;consider(e);const {next,id}=gesture;cancelGesture();if(next)change(s=>{if(next.order)s.order=next.order;else Object.assign(s.tiles[id],next)})};board.onpointercancel=cancelGesture;board.onlostpointercapture=cancelGesture;window.addEventListener('blur',cancelGesture);window.addEventListener('keydown',e=>{if(e.key==='Escape')cancelGesture()});
new ResizeObserver(()=>{cancelGesture();layout()}).observe(board);
$('#close').onclick=()=>dialog.close();dialog.onclose=()=>{
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
async function init(){draw();if(!globalThis.chrome?.storage?.sync){syncStatus='Откройте страницу как расширение Chrome';return}initCloud();chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[cloudKey]){refresh();renderCloud()}if(area==='sync'&&Object.keys(changes).some(k=>k.startsWith('gntd.')))refresh().catch(()=>toast('Ошибка чтения настроек'))});
 try{await refresh();rotateQuote()}catch{syncStatus='Ошибка чтения настроек';toast(syncStatus)}
 bookmarks();for(const event of ['onCreated','onRemoved','onChanged','onMoved','onImportEnded','onChildrenReordered'])chrome.bookmarks[event].addListener(bookmarks);systemInfo();let lastDay=day(new Date()),hour=new Date().getHours();
 setInterval(()=>{const now=new Date(),t=board.querySelector('[data-clock-display]');if(t)updateClock(t,now);if(hour!==now.getHours()){hour=now.getHours();drawOne('greeting')}if(lastDay!==day(now)){lastDay=day(now);drawOne('calendar')}rotateQuote()},15000);setInterval(()=>{if(!document.hidden&&memory)systemInfo()},60000)}
init();
