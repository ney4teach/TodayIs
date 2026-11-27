import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';

test('OAuth callbacks, first import, second installation, changes and logout', async t=>{
  const id='a'.repeat(32), verifier='test-installation-verifier';
  const challenge=createHash('sha256').update(verifier).digest('base64url');
  Object.assign(process.env,{PORT:'0',PUBLIC_ORIGIN:'http://localhost:8787',DB_PATH:':memory:',EXTENSION_IDS:id,
    GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',YANDEX_CLIENT_ID:'test',YANDEX_CLIENT_SECRET:'test'});
  const request=globalThis.fetch;
  t.mock.method(globalThis,'fetch',async url=>{
    if (String(url).includes('/token')) return Response.json({access_token:'external'});
    return Response.json({sub:'123',id:'123',name:'Тест'});
  });
  const {server}=await import('./server.mjs');
  t.after(()=>server.close());
  if (!server.listening) await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  const post=(path,data,token)=>request(origin+path,{method:'POST',headers:{Authorization:'Bearer '+(token||'')},body:JSON.stringify(data)});
  async function login(provider) {
    const start=await request(origin+'/login/'+provider+'?id='+id+'&challenge='+challenge,{redirect:'manual'});
    const state=new URL(start.headers.get('location')).searchParams.get('state');
    const callback=await request(origin+'/callback/'+provider+'?code=test&state='+state,{
      redirect:'manual',headers:{cookie:start.headers.get('set-cookie').split(';')[0]}
    });
    const target=new URL(callback.headers.get('location'));
    assert.equal(target.origin,'https://'+id+'.chromiumapp.org');
    const ticket=target.searchParams.get('ticket');
    const session=await (await post('/session',{ticket,verifier})).json();
    assert.ok(session.token,JSON.stringify(session));
    assert.equal((await post('/session',{ticket,verifier})).status,400);
    return session.token;
  }
  const first=await login('google'), second=await login('google'), yandex=await login('yandex');
  const profile=async(token,payload)=>(await (await post('/profile',payload,token)).json()).data;
  const seed={'gntd.theme':'light','gntd.tasks.a':{id:'a',text:'Купить хлеб'}};
  assert.deepEqual(await profile(first,{seed}),seed);
  assert.deepEqual(await profile(second,{seed:{'gntd.theme':'dark'}}),seed);
  await profile(first,{set:{'gntd.engine':'Яндекс'},remove:[]});
  assert.deepEqual(await profile(second,{set:{},remove:['gntd.tasks.a']}),{'gntd.theme':'light','gntd.engine':'Яндекс'});
  assert.deepEqual(await profile(yandex,{seed:{}}),{});
  assert.equal((await post('/profile',{set:{'gntd.weather':{}},remove:[]},first)).status,400);
  await t.test('original wallpaper bytes are isolated, deduplicated and pruned with their final reference', async ()=>{
    const original = Buffer.from([255,216,255,0,42,228,255,217]);
    const key = createHash('sha256').update(original).digest('hex');
    const route = '/wallpaper-files/'+key;
    const file = (method,token,body)=>request(origin+route,{
      method, headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'}, body
    });
    assert.equal((await file('GET','invalid')).status,401);
    assert.equal((await file('PUT',first,Buffer.from('другой файл'))).status,400);
    assert.equal((await file('GET',first)).status,404);
    assert.equal((await file('PUT',first,original)).status,409);
    const firstItem = 'gntd.wallpaperItem.first';
    const secondItem = 'gntd.wallpaperItem.second';
    const item = {originalKey:key};
    await profile(first,{set:{[firstItem]:item,[secondItem]:item,'gntd.wallpaperActive':'first'},remove:[]});
    assert.equal((await profile(second,{set:{},remove:[]}))[firstItem].originalKey,key);
    assert.equal((await file('PUT',first,original)).status,204);
    assert.equal((await file('PUT',second,original)).status,204);
    const downloaded = await file('GET',second);
    assert.equal(downloaded.status,200);
    assert.equal(downloaded.headers.get('content-type'),'application/octet-stream');
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),original);
    assert.equal((await file('GET',yandex)).status,404);
    assert.equal((await file('DELETE',yandex)).status,204);
    assert.equal((await file('GET',first)).status,200);

    assert.equal((await file('DELETE',first)).status,409);
    await profile(first,{set:{},remove:[firstItem]});
    assert.equal((await file('GET',second)).status,200);
    await profile(second,{set:{'gntd.wallpaperActive':null},remove:[secondItem]});
    assert.equal((await file('GET',first)).status,404);
    assert.equal((await file('PUT',first,original)).status,409);
    assert.equal((await file('DELETE',second)).status,204);
    assert.equal((await file('GET',first)).status,404);
  });
  await request(origin+'/session',{method:'DELETE',headers:{Authorization:'Bearer '+first}});
  assert.equal((await post('/profile',{set:{},remove:[]},first)).status,401);
});
