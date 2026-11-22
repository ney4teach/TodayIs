import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const script=await readFile(new URL('../cloud.js',import.meta.url),'utf8');
test('offline edits survive reload and merge with another installation',async()=>{
  const local={}, original={'gntd.theme':'light'}, cloud={...original,'gntd.engine':'Яндекс'};
  let online=false;
  function installation(){
    const context=vm.createContext({
      chrome:{storage:{sync:{get:async()=>structuredClone(original)},local:{
        get:async()=>structuredClone(local),set:async data=>Object.assign(local,structuredClone(data))
      }}},navigator:{locks:{request:async(key,fn)=>fn()}}, document:{getElementById:()=>null},
      GNTD_CLOUD_ORIGIN:'https://example.org',setTimeout:()=>1,clearTimeout(){},AbortSignal,
      fetch:async(url,options)=>{
        if (!online) throw Error('offline');
        const patch=JSON.parse(options.body);
        Object.assign(cloud,patch.set);
        for (const key of patch.remove) delete cloud[key];
        return Response.json({data:cloud});
      }
    });
    vm.runInContext(script,context);
    return src=>vm.runInContext(src,context);
  }
  let run=installation();
  await run("saveAccount({token:'t',base:{'gntd.theme':'light'},data:{'gntd.theme':'light'}})");
  await run("(async()=>writeDashboard(await cloudAccount(),{'gntd.tasks.a':{id:'a',text:'hello'},'gntd.weather':{city:'local'}},[]))()");
  await run('syncCloud()');
  assert.ok(local.gntdCloudProfile.data['gntd.tasks.a']);
  online=true; run=installation();
  await run('syncCloud()');
  assert.equal(cloud['gntd.tasks.a'].text,'hello');
  assert.equal(local.gntdCloudProfile.data['gntd.engine'],'Яндекс');
  assert.equal(cloud['gntd.weather'],undefined);
  assert.equal(local.gntdCloudProfile.data['gntd.weather'].city,'local');
  assert.deepEqual(original,{'gntd.theme':'light'});
});
