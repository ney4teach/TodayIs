export async function captureWallpaper(context, output) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.sync.set({
    'gntd.hidden':['bookmarks','tasks','calendar','music','quote','system'],
    'gntd.theme':'dark'
  }));
  const page = await context.newPage();
  await page.goto('chrome-extension://' + new URL(worker.url()).hostname + '/newtab.html');
  const dockTrigger = page.locator('#dock .dock-trigger');
  if (await dockTrigger.count()) await dockTrigger.hover();
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  const wallpapers = page.locator('#settings-wallpaper');
  if (!await wallpapers.count()) await page.getByRole('button',{name:/Оформление/}).click();
  await wallpapers.selectOption('aurora',{force:true});
  await page.getByRole('button',{name:'Редактировать обои',exact:true}).click();
  await page.getByRole('checkbox',{name:'Отразить по горизонтали'}).check();
  await page.locator('.wallpaper-controls select').selectOption('warm',{force:true});
  await page.getByRole('slider',{name:'Затемнение',exact:true}).evaluate(slider=>{
    slider.value = '18';
    slider.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.querySelector('#wallpaper-image').style.filter.includes('sepia'));
  await page.screenshot({path:output,animations:'disabled'});
}
