export async function captureTasks(page,worker,output,{quick = false} = {}) {
  const morning = new Date();
  morning.setHours(9,0,0,0);
  const yesterday = new Date(morning);
  yesterday.setDate(yesterday.getDate()-1);
  const day = date=>[date.getFullYear(),date.getMonth()+1,date.getDate()]
    .map(part=>String(part).padStart(2,'0')).join('-');
  await page.clock.setFixedTime(morning);
  await worker.evaluate(async ({today,overdue})=>{
    await chrome.storage.sync.set({
      'gntd.theme':'dark',
      'gntd.tasks.list-work':{id:'list-work',kind:'list',name:'Работа'},
      'gntd.tasks.list-home':{id:'list-home',kind:'list',name:'Дом'},
      'gntd.tasks.list-shopping':{id:'list-shopping',kind:'list',name:'Покупки'},
      'gntd.tasks.demo-1':{id:'demo-1',text:'Купить корм',listId:'list-shopping',done:false,position:0},
      'gntd.tasks.demo-2':{id:'demo-2',text:'Отправить отчёт',listId:'list-work',date:overdue,important:true,done:false,position:1},
      'gntd.tasks.demo-3':{id:'demo-3',text:'Позвонить',listId:'list-home',date:today,time:'15:00',done:false,position:2}
    });
  },{today:day(morning),overdue:day(yesterday)});
  const origin = 'chrome-extension://'+new URL(worker.url()).hostname;
  await page.goto(origin+'/newtab.html');
  if (quick) {
    await page.getByRole('button',{name:'Быстро добавить задачу',exact:true}).click();
    await page.getByLabel('Название задачи',{exact:true}).fill('Забрать заказ');
  } else {
    await page.getByRole('button',{name:'Открыть задачи',exact:true}).click();
    const dialog = page.locator('dialog[data-view=tasks]');
    await dialog.getByRole('heading',{name:'Просроченные',exact:true}).waitFor();
    await dialog.getByRole('heading',{name:'Сегодня',exact:true}).waitFor();
    await dialog.getByRole('heading',{name:'Без даты',exact:true}).waitFor();
  }
  await page.screenshot({path:output,animations:'disabled'});
}
