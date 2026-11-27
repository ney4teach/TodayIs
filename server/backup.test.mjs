import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../settings-backup.js', import.meta.url), 'utf8');
function setup({signedIn = false, fail = ''} = {}) {
  const sync = {'gntd.theme':'dark', 'gntd.tasks.old':{id:'old',text:'Before'}, unrelated:'keep'};
  const local = {'todayis.deviceWallpaper':{image:'data:image/webp;base64,YQ==',name:'Space'}, todayIsLayouts:[{theme:'light'},null,null]};
  if (signedIn) local.gntdCloudProfile = {token:'secret', owner:'yandex/test', base:{}, data:{'gntd.theme':'light'}};
  const web = new Map([['todayis.searchHistory','["Today Is"]'],['gntd.music.pin','private']]);
  let shouldFail = true;
  const area = (data, name) => ({
    get:async()=>structuredClone(data),
    set:async items=>{
      if (fail === name && shouldFail) { shouldFail = false; throw Error('Quota exceeded'); }
      Object.assign(data,structuredClone(items));
    },
    remove:async keys=>{ for(const key of keys) delete data[key]; }
  });
  const ctx = vm.createContext({chrome:{storage:{sync:area(sync,'sync'),local:area(local,'local')},runtime:{getManifest:()=>({version:'1.0.0'})}},
    navigator:{locks:{request:async(_key,fn)=>fn()}}, TextEncoder, structuredClone,
    localStorage:{getItem:key=>web.get(key)??null,setItem:(key,value)=>web.set(key,value),removeItem:key=>web.delete(key)},
    scheduleCloud(){}, unpack:data=>data, normalize:data=>data});
  vm.runInContext(source,ctx);
  return {sync,local,web,run:code=>vm.runInContext(code,ctx)};
}
const incoming = {format:'todayis-settings',version:1,dashboard:{'gntd.theme':'light','gntd.events.new':{id:'new',text:'Shift',date:'2026-11-27'}},local:{},searchHistory:[]};
test('export includes device wallpaper and layouts without account credentials or music pin',async()=>{
  const {run} = setup({signedIn:true});
  const backup = await run('TodayIsBackup.capture()');
  assert.equal(backup.dashboard['gntd.theme'],'light');
  assert.ok(backup.local['todayis.deviceWallpaper'].image);
  assert.equal(backup.local.todayIsLayouts.length,3);
  assert.deepEqual(JSON.parse(JSON.stringify(backup.searchHistory)),['Today Is']);
  assert.ok(!JSON.stringify(backup).includes('secret'));
  assert.ok(!JSON.stringify(backup).includes('private'));
});
test('import replaces dashboard records and device settings but preserves unrelated storage',async()=>{
  const {run,sync,local,web} = setup();
  await run(`TodayIsBackup.restore(${JSON.stringify(incoming)})`);
  assert.equal(sync['gntd.theme'],'light');
  assert.equal(sync['gntd.tasks.old'],undefined);
  assert.equal(sync.unrelated,'keep');
  assert.equal(local['todayis.deviceWallpaper'],undefined);
  assert.equal(local.todayIsLayouts,undefined);
  assert.equal(web.get('gntd.music.pin'),'private');
});
test('signed-in import preserves session and cloud baseline and replaces only profile data',async()=>{
  const {run,local} = setup({signedIn:true});
  await run(`TodayIsBackup.restore(${JSON.stringify(incoming)})`);
  assert.equal(local.gntdCloudProfile.token,'secret');
  assert.equal(local.gntdCloudProfile.data['gntd.events.new'].text,'Shift');
});
test('malformed, foreign, unsupported and unsafe backups leave existing settings intact',async()=>{
  const {run,sync} = setup();
  for(const value of ['{}','{"format":"other","version":1}',JSON.stringify({...incoming,version:2}),JSON.stringify({...incoming,dashboard:{'gntd.__proto__':{}}}),JSON.stringify({...incoming,local:{gntdCloudProfile:{token:'x'}}}),JSON.stringify({...incoming,dashboard:{'gntd.theme':{'__bad':1}}})]) {
    // A valid JSON object with an invalid setting type must also be rejected.
    await assert.rejects(run(`TodayIsBackup.restore(${value})`));
    assert.equal(sync['gntd.theme'],'dark');
    assert.ok(sync['gntd.tasks.old']);
  }
});
test('storage failure restores both dashboard and device settings',async()=>{
  const {run,sync,local} = setup({fail:'sync'});
  await assert.rejects(run(`TodayIsBackup.restore(${JSON.stringify(incoming)})`));
  assert.equal(sync['gntd.theme'],'dark');
  assert.ok(sync['gntd.tasks.old']);
  assert.equal(local['todayis.deviceWallpaper'].name,'Space');
});
test('empty installation can be backed up and restored',async()=>{
  const {run,sync} = setup();
  await run(`TodayIsBackup.restore(${JSON.stringify({...incoming,dashboard:{}})})`);
  assert.equal((await run('TodayIsBackup.capture()')).format,'todayis-settings');
  assert.deepEqual(sync,{unrelated:'keep'});
});
test('wallpaper, layout slots, calendar shifts and search history survive a full round trip',async()=>{
  const {run,local,sync,web} = setup();
  sync['gntd.events.shift']={id:'shift',text:'Работа',date:'2026-11-27',shift:{kind:'day',start:'08:00',end:'20:00'}};
  const before=await run('TodayIsBackup.capture()');
  await run(`TodayIsBackup.restore(${JSON.stringify(incoming)})`);
  await run(`TodayIsBackup.restore(${JSON.stringify(before)})`);
  assert.equal(local['todayis.deviceWallpaper'].name,'Space');
  assert.equal(local.todayIsLayouts.length,3);
  assert.equal(sync['gntd.events.shift'].shift.start,'08:00');
  assert.equal(web.get('todayis.searchHistory'),'["Today Is"]');
});
