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
  const seed={
    'gntd.theme':'light','gntd.tasks.a':{id:'a',text:'Купить хлеб'},
    'gntd.widgetScale':80,'gntd.clock':{face:'analog',cities:['local'],zone:'local'},
    'gntd.musicTint':false,'gntd.bookmarkSource':'custom','gntd.bookmarkFolder':'1',
    'gntd.linkCategories.news':{id:'news',title:'Новости'},
    'gntd.siteTiles.example':{id:'example',categoryId:'news',title:'Пример',url:'https://example.org/'}
  };
  assert.deepEqual(await profile(first,{seed}),seed);
  assert.deepEqual(await profile(second,{seed:{'gntd.theme':'dark'}}),seed);
  const updated={'gntd.engine':'Яндекс','gntd.widgetScale':90};
  await profile(first,{set:updated,remove:[]});
  const removed=['gntd.tasks.a','gntd.linkCategories.news','gntd.siteTiles.example'];
  const expected={...seed,...updated};
  for (const key of removed) delete expected[key];
  assert.deepEqual(await profile(second,{set:{},remove:removed}),expected);
  assert.deepEqual(await profile(yandex,{seed:{}}),{});
  assert.equal((await post('/profile',{set:{'gntd.weather':{}},remove:[]},first)).status,400);
  await request(origin+'/session',{method:'DELETE',headers:{Authorization:'Bearer '+first}});
  assert.equal((await post('/profile',{set:{},remove:[]},first)).status,401);
});
