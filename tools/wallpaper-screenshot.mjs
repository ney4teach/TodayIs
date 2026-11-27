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
  const picker = page.getByLabel('Добавить фото');
  if (!await picker.count()) await page.getByRole('button',{name:/Оформление/}).click();
  const photo = await page.evaluate(async()=>{
    const source = new Image();
    source.src = chrome.runtime.getURL('wallpapers/horizon.svg');
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 3840;
    canvas.height = 2160;
    canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await picker.setInputFiles({name:'Горизонт 4K.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
  await page.getByText('Оригинал · 3840 × 2160',{exact:true}).waitFor();
  await page.screenshot({path:output,animations:'disabled'});
}
