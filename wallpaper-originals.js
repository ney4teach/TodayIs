'use strict';

const wallpaperOriginals = (() => {
  const maxCloudBytes = 64 * 1024 * 1024;
  const validKey = value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
  let database;

  function open() {
    if (database) return database;
    database = new Promise((resolve,reject)=>{
      const request = indexedDB.open('todayis-wallpaper-originals',1);
      request.onupgradeneeded = ()=>request.result.createObjectStore('photos');
      request.onsuccess = ()=>resolve(request.result);
      request.onerror = ()=>reject(request.error);
    }).catch(error=>{ database=undefined; throw error; });
    return database;
  }

  async function transaction(mode, action) {
    const db = await open();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('photos',mode);
      const request = action(tx.objectStore('photos'));
      tx.oncomplete = ()=>resolve(request.result);
      tx.onabort = ()=>reject(tx.error);
    });
  }

  const get = (owner,key)=>transaction('readonly',store=>store.get([owner,key]));
  const put = (owner,key,blob,synced=false)=>transaction('readwrite',store=>store.put({blob,synced},[owner,key]));
  const remove = (owner,key)=>transaction('readwrite',store=>store.delete([owner,key]));

  async function hash(blob) {
    const bytes = await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');
  }

  async function cloudFile(account,key,method,body) {
    const response = await fetch(GNTD_CLOUD_ORIGIN+'/wallpaper-files/'+key,{
      method, body, signal:AbortSignal.timeout(60000),
      headers:{Authorization:'Bearer '+account.token,...(body?{'Content-Type':'application/octet-stream'}:{})},
      credentials:'omit',redirect:'error',cache:'no-store'
    });
    if (!response.ok) throw Error('Оригинал фото пока недоступен в профиле');
    return response;
  }

  async function original(account,item) {
    const key = item.originalKey;
    const owner = account?.owner ?? '';
    const cached = (await get(owner,key)) ?? (owner ? await get('',key) : undefined);
    if (cached) return cached.blob;
    if (!account || !GNTD_CLOUD_ORIGIN) return null;
    const response = await cloudFile(account,key,'GET');
    const type = typeof item.originalType==='string' && /^image\/[a-z0-9.+-]+$/i.test(item.originalType)
      ? item.originalType : '';
    const file = new Blob([await response.blob()],{type});
    if (await hash(file)!==key) throw Error('Оригинал фото повреждён');
    await put(owner,key,file,true).catch(()=>{});
    return file;
  }

  async function sync(account,items) {
    if (!GNTD_CLOUD_ORIGIN) return;
    const keys = new Set(items.map(item=>item?.originalKey).filter(validKey));
    if (!keys.size) return;
    await navigator.locks.request('todayis-originals:'+account.owner,{ifAvailable:true},async lock=>{
      if (!lock) return;
      for (const key of keys) {
        const cached = (await get(account.owner,key)) ?? await get('',key);
        if (!cached || cached.synced || cached.blob.size>maxCloudBytes) continue;
        await cloudFile(account,key,'PUT',cached.blob).catch(()=>null).then(async response=>{
          if (response) await put(account.owner,key,cached.blob,true);
        });
      }
    });
  }

  return {validKey,hash,put,remove,original,sync};
})();
