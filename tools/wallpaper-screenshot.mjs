export async function captureWallpaper(context, output) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.sync.set({
    'gntd.hidden':['greeting','bookmarks','tasks','calendar','music','quote','system'],
    'gntd.theme':'dark'
  }));
  const page = await context.newPage();
  await page.goto('chrome-extension://' + new URL(worker.url()).hostname + '/newtab.html');
  const dockTrigger = page.locator('#dock .dock-trigger');
  if (await dockTrigger.count()) await dockTrigger.hover();
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  const wallpapers = page.locator('#settings-wallpaper');
  if (!await wallpapers.count()) await page.getByRole('button',{name:/Оформление/}).click();
  await wallpapers.selectOption('horizon',{force:true});
  await page.getByRole('button',{name:'Редактировать обои',exact:true}).click();
  await page.getByRole('checkbox',{name:'Параллакс',exact:true}).check();
  await page.locator('#wallpaper-parallax').waitFor({state:'visible'});
  await page.getByRole('slider',{name:'Сила параллакса',exact:true}).evaluate(slider=>{
    slider.value = '65';
    slider.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.mouse.move(250,450);
  await page.waitForFunction(()=>Math.abs(parseFloat(document.querySelector('#wallpaper-parallax').style.getPropertyValue('--parallax-x')))>1);
  await page.screenshot({path:output,animations:'disabled'});
}
