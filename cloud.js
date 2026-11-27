'use strict';

const cloudKey = 'gntdCloudProfile';
let cloudStatus = '', cloudTimer, cloudBusy = false;
const cloudLock = fn => navigator.locks.request('gntd-write', fn);
const cloudAccount = async () => (await chrome.storage.local.get(cloudKey))[cloudKey];
const saveAccount = account => chrome.storage.local.set({[cloudKey]:account});
const portable = key => key.startsWith('gntd.') && key !== 'gntd.weather' && key !== 'gntd.quote';
const snapshot = data => Object.fromEntries(Object.entries(data).filter(([k]) => portable(k)));

async function dashboardData(account) {
  if (account) return account.data;
  return chrome.storage.sync.get(null);
}
async function writeDashboard(account, set, remove) {
  if (account) {
    Object.assign(account.data,set);
    for (const k of remove) delete account.data[k];
    await saveAccount(account);
    if ([...Object.keys(set),...remove].some(portable)) scheduleCloud();
  } else {
    if (Object.keys(set).length) await chrome.storage.sync.set(set);
    if (remove.length) await chrome.storage.sync.remove(remove);
  }
}
async function api(path, token, data, method='POST') {
  const response = await fetch(GNTD_CLOUD_ORIGIN+path,{
    method, headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(10000),
    credentials:'omit',redirect:'error',cache:'no-store'
  });
  if (!response.ok) {
    const message=(await response.json().catch(()=>({}))).error;
    throw Object.assign(Error(message||'Сервер недоступен'),{status:response.status});
  }
  return response.json();
}
function changes(account) {
  const current=snapshot(account.data), set={};
  for (const [key,value] of Object.entries(current)) {
    if (JSON.stringify(value)!==JSON.stringify(account.base[key])) set[key]=value;
  }
  return {set,remove:Object.keys(account.base).filter(key=>!(key in current))};
}
async function exchange(account, payload, force=false) {
  const {data}=await api('/profile',account.token,payload);
  if (!force && JSON.stringify(data)===JSON.stringify(account.base) && JSON.stringify(snapshot(account.data))===JSON.stringify(data)) return;
  const local=Object.fromEntries(Object.entries(account.data).filter(([k])=>!portable(k)));
  account.data={...local,...data};
  account.base=data;
  await saveAccount(account);
}
function scheduleCloud(delay=350) {
  clearTimeout(cloudTimer);
  cloudTimer=setTimeout(syncCloud,delay);
}
async function syncCloud() {
  if (cloudBusy || !GNTD_CLOUD_ORIGIN) return;
  cloudBusy=true;
  try {
    await cloudLock(async()=>{
      const account=await cloudAccount();
      if (!account) return;
      await exchange(account,changes(account));
      cloudStatus='Синхронизировано в '+new Date().toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'});
    });
  } catch(e) { cloudStatus=e.status===401?'Сессия истекла. Войдите снова.':('Изменения сохранены на устройстве. '+(e.status?e.message:'Нет связи с сервером.')); }
  finally { cloudBusy=false; await renderCloud(); }
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
async function signIn(provider) {
  const verifier=base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge=base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  const start=new URL('/login/'+provider,GNTD_CLOUD_ORIGIN);
  start.search=new URLSearchParams({id:chrome.runtime.id,challenge});
  const result=await chrome.identity.launchWebAuthFlow({url:start.href,interactive:true});
  const target=new URL(result);
  if (target.origin+target.pathname!==chrome.identity.getRedirectURL('cloud') || !target.searchParams.has('ticket')) throw Error('Вход отменён');
  const session=await api('/session',null,{ticket:target.searchParams.get('ticket'),verifier});
  await cloudLock(async()=>{
    const old=await cloudAccount();
    if (old && old.owner!==session.owner) throw Error('Сначала выйдите из текущего аккаунта');
    const initial=old?.data || flatten(unpack(await chrome.storage.sync.get(null)));
    const account={...session,data:initial,base:old?.base||{}};
    await exchange(account,old?changes(account):{seed:snapshot(initial)},true);
    cloudStatus='Синхронизировано';
  });
  await refresh();
}
async function signOut() {
  await cloudLock(async()=>{
    const account=await cloudAccount();
    if (!account) return;
    const patch=changes(account);
    try {
      if (Object.keys(patch.set).length || patch.remove.length) await exchange(account,patch);
      await api('/session',account.token,undefined,'DELETE');
    } catch(e) {
      if (e.status!==401 || Object.keys(patch.set).length || patch.remove.length) throw e;
    }
    await chrome.storage.local.remove(cloudKey); cloudStatus='';
  });
  await refresh();
}
async function renderCloud() {
  const section=document.getElementById('cloud-settings');
  const summary=document.getElementById('cloud-summary');
  if (!section && !summary) return;
  const account=await cloudAccount();
  if(summary){summary.textContent=account?[account.label,cloudStatus||'Яндекс ID'].join(' · '):'Вход через Яндекс ID';return}
  section.replaceChildren();
  const actions=el('div','cloud-actions');
  const action=(label,fn,kind='')=>{
    const button=btn(label,label,async()=>{
      section.inert=true;
      try { await fn(); } catch(e) { cloudStatus=e.message; toast(e.message); }
      finally { section.inert=false; await renderCloud(); }
    },kind);
    actions.append(button);
  };
  if (!GNTD_CLOUD_ORIGIN) {
    section.append(el('small','','Облачный сервер ещё не подключён.'));
    return;
  }
  const provider=account?.owner.startsWith('google/')?'Google':'Яндекс ID';
  const identity=el('div','cloud-identity');
  const avatar=el('span','cloud-avatar',provider==='Google'?'G':'Я');
  avatar.setAttribute('aria-hidden','true');
  const copy=el('div','cloud-copy');
  copy.append(el('h3','',account?.label || 'Облачный профиль'),
    el('p','',account?provider:'Переносите настройки и раскладку между устройствами.'));
  identity.append(avatar,copy);
  section.append(identity);
  if (account) {
    action('Синхронизировать сейчас',syncCloud,'cloud-primary');
    action('Обновить вход',()=>signIn(account.owner.split('/')[0]));
    action('Выйти из аккаунта',signOut);
  } else {
    action('Войти через Яндекс ID',()=>signIn('yandex'),'cloud-primary');
  }
  if (account || cloudStatus) {
    const status=el('p','cloud-status',cloudStatus || 'Статус появится после синхронизации.');
    status.setAttribute('role','status');
    section.append(status);
  }
  section.append(actions);
}
function initCloud() {
  if (!GNTD_CLOUD_ORIGIN) return;
  scheduleCloud(0);
  window.addEventListener('online',()=>scheduleCloud(0));
  window.addEventListener('focus',()=>scheduleCloud(0));
  setInterval(()=>{if (!document.hidden) scheduleCloud(0);},60000);
}
