function calendarDateLabel(date) {
  return new Date(date+'T12:00').toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'});
}

function calendarMonth(selectedMonth, onMove, onDate, selected) {
  const ym = new Date(selectedMonth.getFullYear(),selectedMonth.getMonth(),1);
  const head = el('div','calendar-month');
  const move = delta=>onMove(new Date(ym.getFullYear(),ym.getMonth()+delta,1));
  head.append(btn('Предыдущий месяц','‹',()=>move(-1),'mini'),
    el('b','',ym.toLocaleDateString('ru',{month:'long',year:'numeric'})),
    btn('Следующий месяц','›',()=>move(1),'mini'));
  const grid = el('div','calendar-grid');
  const today = day(new Date());
  for (const name of ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']) grid.append(el('small','',name));
  for (let i=0;i<(ym.getDay()+6)%7;i++) grid.append(el('span'));
  for (let i=1;i<=new Date(ym.getFullYear(),ym.getMonth()+1,0).getDate();i++) {
    const date = day(new Date(ym.getFullYear(),ym.getMonth(),i));
    const {shifts,events} = calendarEntries(state.events,date);
    const primary = shifts.find(({shift})=>shift.kind !== 'extra')?.shift.kind;
    const hasExtra = shifts.some(({shift})=>shift.kind === 'extra');
    const kind = primary ?? (hasExtra ? 'extra' : null);
    const descriptions = [...shifts.map(({shift})=>[shiftTypes[shift.kind][0],shiftTime(shift)].filter(Boolean).join(' ')),...events.map(event=>event.text)];
    const cell = btn([calendarDateLabel(date),...descriptions].join(' · '),'',()=>onDate(date),'calendar-day');
    if (kind) cell.classList.add('calendar-type-'+kind);
    if (primary && hasExtra) cell.classList.add('calendar-with-extra');
    if (events.length) cell.classList.add('calendar-with-event');
    if (date === today) cell.setAttribute('aria-current','date');
    if (selected) cell.setAttribute('aria-pressed',String(date === selected));
    cell.append(el('span','',i));
    grid.append(cell);
  }
  return [head,grid];
}

function calendar(n) {
  n.classList.add('calendar-widget');
  const today = new Date();
  const selected = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth()
    ? today : new Date(month.getFullYear(),month.getMonth(),1);
  n.append(cap('calendar',btn('Открыть календарь','↗',()=>openCalendar(day(selected)),'mini')),
    ...calendarMonth(month,next=>{month=next;drawOne('calendar')},openCalendar));
}

function openCalendar(date, focus = '') {
  const shown = new Date(date+'T12:00');
  modal('Рабочий календарь','calendar');
  const toolbar = el('div','calendar-actions');
  toolbar.append(btn('Сегодня','Сегодня',()=>openCalendar(day(new Date()),'today')),
    btn('Создать график','＋ График',()=>scheduleForm(date)),
    btn('Управление графиками','Мои графики',()=>manageSchedules(date)));
  fields.append(toolbar);
  const body = el('div','calendar-workspace');
  const overview = el('div','calendar-overview');
  overview.append(...calendarMonth(shown,next=>openCalendar(day(next),next > shown ? 'next' : 'previous'),
    next=>openCalendar(next,'date'),date));
  const legend = el('div','calendar-legend');
  for (const kind of Object.keys(shiftTypes)) {
    const item = el('span');
    const swatch = el('span','calendar-swatch calendar-type-'+kind);
    swatch.setAttribute('aria-hidden','true');
    item.append(swatch,document.createTextNode(shiftTypes[kind][0]));
    legend.append(item);
  }
  overview.append(legend);
  const details = el('section','calendar-details');
  const {shifts,events} = calendarEntries(state.events,date);
  details.append(el('h3','',calendarDateLabel(date)));
  if (!shifts.length && !events.length) details.append(el('p','calendar-muted','На этот день записей пока нет.'));
  for (const entry of shifts) {
    const {shift,schedule} = entry;
    const row = el('div','calendar-entry');
    const info = el('div');
    info.append(el('strong','calendar-type-'+shift.kind,shiftTypes[shift.kind][0]));
    if (shiftTime(shift)) info.append(el('small','',shiftTime(shift)));
    if (schedule) info.append(el('small','',schedule.text));
    if (shift.note) info.append(el('small','',shift.note));
    row.append(info,btn('Изменить '+shiftTypes[shift.kind][0].toLowerCase(),'Изменить',()=>shiftForm(date,entry)));
    details.append(row);
  }
  for (const event of events) {
    const row = el('div','calendar-entry');
    row.append(el('span','',event.text),btn('Изменить событие','Изменить',()=>calendarEventForm(date,event)));
    details.append(row);
  }
  const actions = el('div','calendar-actions');
  if (!shifts.some(({shift,schedule})=>schedule || shift.kind !== 'extra')) {
    actions.append(btn('Добавить смену','＋ Смена',()=>shiftForm(date)));
  }
  actions.append(btn('Добавить подработку','＋ Подработка',()=>shiftForm(date,{shift:{kind:'extra'}})),
    btn('Добавить событие','＋ Событие',()=>calendarEventForm(date)));
  details.append(actions);
  body.append(overview,details);
  fields.append(body);
  const selectors = {date:'[aria-pressed="true"]',next:'[aria-label="Следующий месяц"]',
    previous:'[aria-label="Предыдущий месяц"]',today:'[aria-label="Сегодня"]'};
  if (focus) fields.querySelector(selectors[focus])?.focus();
}

function calendarSelect(options, selected) {
  const control = el('select');
  for (const [value,label] of options) {
    const option = el('option','',label);
    option.value = value;
    control.append(option);
  }
  control.value = selected;
  return control;
}

function shiftFields(host, initial, kinds) {
  const kind = calendarSelect(kinds.map(key=>[key,shiftTypes[key][0]]),initial.kind);
  const from = input(initial.from || '','time'), to = input(initial.to || '','time');
  const nextDay = input('','checkbox');
  nextDay.checked = !!initial.nextDay;
  const note = input(initial.note || '');
  note.maxLength = 240;
  const timeRow = el('div','calendar-form-row');
  const label = (text,control)=>{
    const wrapper = el('label','field',text);
    wrapper.append(control);
    return wrapper;
  };
  timeRow.append(label('Начало',from),label('Окончание',to),label('На следующий день',nextDay));
  host.append(label('Тип смены',kind),timeRow,label('Заметка',note));
  const update = ()=>{
    const timed = hasShiftTime(kind.value);
    timeRow.hidden = !timed;
    from.disabled = to.disabled = nextDay.disabled = !timed;
    from.required = timed && !!to.value;
    to.required = timed && !!from.value;
    to.setCustomValidity(timed && from.value && from.value === to.value && !nextDay.checked
      ? 'Для смены длиной в сутки отметьте окончание на следующий день.' : '');
  };
  for (const control of [kind,from,to,nextDay]) control.addEventListener('input',update);
  update();
  return {kind,read:()=>normalizeShift({kind:kind.value,from:from.value,to:to.value,nextDay:nextDay.checked,note:note.value},kinds)};
}

function calendarForm(title,view,date) {
  modal(title,view);
  fields.append(btn('Назад к календарю','‹ К календарю',()=>openCalendar(date,'date')));
  const form = el('form','calendar-form');
  fields.append(form);
  return form;
}

function calendarSubmit(form,label,submit) {
  const button = el('button','calendar-primary',label);
  button.type = 'submit';
  form.append(button);
  form.onsubmit = async event=>{
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    try {await submit()} finally {button.disabled = false}
  };
}

async function saveCalendarEntry(date, apply) {
  if (await change(apply)) openCalendar(date,'date');
}

function shiftForm(date,{shift={kind:'day'},schedule,record}={}) {
  const form = calendarForm('Смена · '+calendarDateLabel(date),'calendar-editor',date);
  const kinds = schedule ? [...cycleShiftKinds,'skip']
    : shift.kind === 'extra' ? ['extra'] : primaryShiftKinds;
  const editor = shiftFields(form,shift,kinds);
  const id = schedule ? schedule.id+'-'+date : record?.id ?? crypto.randomUUID();
  calendarSubmit(form,'Сохранить смену',async()=>{
    const value = editor.read();
    await saveCalendarEntry(date,s=>{
      if (schedule && !scheduleShift(s.events.find(event=>event.id === schedule.id),date)) throw Error('График на эту дату уже изменился');
      if (!schedule && !record && value.kind !== 'extra' && calendarEntries(s.events,date).shifts.some(entry=>entry.schedule || entry.shift.kind !== 'extra')) {
        throw Error('На эту дату уже есть основная смена');
      }
      s.events = s.events.filter(event=>event.id !== id);
      s.events.push({id,date,text:shiftTypes[value.kind][0],shift:value,scheduleId:schedule?.id ?? ''});
    });
  });
  if (record) form.append(btn(schedule ? 'Вернуть смену из графика' : 'Удалить смену',
    schedule ? 'Вернуть смену из графика' : 'Удалить смену',
    ()=>saveCalendarEntry(date,s=>{s.events=s.events.filter(event=>event.id !== record.id)})));
  editor.kind.focus();
}

function calendarEventForm(date,record) {
  const form = calendarForm('Событие · '+calendarDateLabel(date),'calendar-editor',date);
  const name = input(record?.text ?? '');
  name.required = true;
  name.maxLength = 240;
  name.setAttribute('aria-label','Название события');
  name.placeholder = 'Название события';
  form.append(name);
  calendarSubmit(form,'Сохранить событие',async()=>{
    const text = name.value.trim();
    if (!text) {name.focus();return}
    await saveCalendarEntry(date,s=>{
      const existing = s.events.find(event=>event.id === record?.id);
      if (existing) existing.text = text;
      else if (!record) s.events.push({id:crypto.randomUUID(),date,text});
    });
  });
  if (record) form.append(btn('Удалить событие','Удалить событие',
    ()=>saveCalendarEntry(date,s=>{s.events=s.events.filter(event=>event.id !== record.id)})));
  name.focus();
}
function scheduleForm(date) {
  const form = calendarForm('Новый рабочий график','calendar-editor',date);
  const title = input('График 2/2'), start = input(date,'date');
  title.required = start.required = true;
  title.maxLength = 80;
  const preset = calendarSelect([...Object.keys(shiftPresets).map(name=>[name,name]),['custom','Свой цикл']],'2/2');
  const duration = calendarSelect([['1','Один месяц'],['3','Три месяца'],['custom','До выбранной даты']],'1');
  const end = input('','date');
  const label = (caption,control)=>{
    const node = el('label','field',caption);
    node.append(control);
    return node;
  };
  const endField = label('Последний день графика',end);
  const steps = el('div','calendar-cycle');
  const preview = el('section','calendar-preview');
  const previewMonth = input('','month');
  const previewList = el('div','calendar-preview-days');
  preview.append(label('Предпросмотр месяца',previewMonth),previewList);
  let editors = [];
  const currentCycle = ()=>editors.map(editor=>editor.read());
  const lastDate = ()=>{
    if (!validDate(start.value)) return '';
    if (duration.value === 'custom') return end.value;
    return shiftDateOffset(start.value,Number(duration.value));
  };
  const renderPreview = ()=>{
    const until = lastDate();
    end.min = start.value;
    endField.hidden = duration.value !== 'custom';
    end.disabled = endField.hidden;
    end.required = !end.disabled;
    previewList.replaceChildren();
    if (!validDate(until) || !validDate(start.value) || until < start.value) return;
    previewMonth.min = start.value.slice(0,7);
    previewMonth.max = until.slice(0,7);
    if (!previewMonth.value || previewMonth.value < previewMonth.min || previewMonth.value > previewMonth.max) previewMonth.value = previewMonth.min;
    const rule = {date:start.value,schedule:{until,cycle:currentCycle()}};
    const [year,monthNumber] = previewMonth.value.split('-').map(Number);
    for (let i=1;i<=new Date(year,monthNumber,0).getDate();i++) {
      const date = previewMonth.value+'-'+String(i).padStart(2,'0');
      const shift = scheduleShift(rule,date);
      if (!shift) continue;
      const item = el('span','calendar-preview-day calendar-type-'+shift.kind,String(i));
      item.title = [shiftTypes[shift.kind][0],shiftTime(shift)].filter(Boolean).join(' · ');
      item.setAttribute('aria-label',calendarDateLabel(date)+' · '+item.title);
      previewList.append(item);
    }
  };
  function renderSteps(cycle) {
    steps.replaceChildren();
    editors = cycle.map((shift,index)=>{
      const box = el('fieldset','calendar-step');
      box.append(el('legend','','День '+(index+1)));
      const editor = shiftFields(box,shift,cycleShiftKinds);
      if (preset.value === 'custom' && cycle.length > 1) box.append(btn('Удалить день '+(index+1),'Удалить день',()=>{
        renderSteps(currentCycle().filter((_,i)=>i !== index));
      }));
      steps.append(box);
      return editor;
    });
    if (preset.value === 'custom' && cycle.length < 31) steps.append(btn('Добавить день в цикл','＋ День цикла',()=>{
      renderSteps([...currentCycle(),{kind:'day'}]);
      steps.querySelector('fieldset:last-of-type select')?.focus();
    }));
    renderPreview();
  }
  const defaults = key=>shiftPresets[key].map(kind=>({
    kind,from:{day:'08:00',night:'20:00',full:'08:00'}[kind],
    to:{day:'20:00',night:'08:00',full:'08:00'}[kind],nextDay:['night','full'].includes(kind)
  }));
  preset.onchange = ()=>{
    if (preset.value === 'custom') renderSteps(currentCycle());
    else {
      if (title.value.startsWith('График ')) title.value = 'График '+preset.value;
      renderSteps(defaults(preset.value));
    }
  };
  form.append(label('Название графика',title),label('Шаблон',preset),
    label('Первый день цикла',start),label('Период',duration),endField,steps,preview);
  form.addEventListener('input',renderPreview);
  renderSteps(defaults('2/2'));
  calendarSubmit(form,'Сохранить график',async()=>{
    const until = lastDate();
    if (!title.value.trim()) {title.focus();return}
    if (!validDate(until) || until < start.value) return;
    const first = start.value;
    const record = {id:crypto.randomUUID(),date:first,text:title.value.trim(),schedule:{until,cycle:currentCycle()}};
    await saveCalendarEntry(first,s=>{
      if (s.events.some(event=>event.schedule && event.date <= until && event.schedule.until >= first)) {
        throw Error('На этот период уже есть график. Сначала остановите его или выберите другие даты.');
      }
      s.events.push(record);
    });
  });
}

function manageSchedules(date) {
  modal('Мои графики','calendar-editor');
  fields.append(btn('Назад к календарю','‹ К календарю',()=>openCalendar(date,'date')));
  const schedules = state.events.filter(event=>event.schedule).sort((a,b)=>b.date.localeCompare(a.date));
  if (!schedules.length) fields.append(el('p','calendar-muted','Сохранённых графиков пока нет.'));
  for (const schedule of schedules) {
    const row = el('div','calendar-entry');
    const info = el('div');
    info.append(el('strong','',schedule.text),el('small','',calendarDateLabel(schedule.date)+' — '+calendarDateLabel(schedule.schedule.until)));
    const actions = el('div','calendar-actions');
    actions.append(btn('Остановить график','Остановить',()=>confirmSchedule(date,schedule,false)),
      btn('Удалить график','Удалить',()=>confirmSchedule(date,schedule,true)));
    row.append(info,actions);
    fields.append(row);
  }
}

function confirmSchedule(date,schedule,remove) {
  const form = calendarForm(remove ? 'Удалить график' : 'Остановить график','calendar-editor',date);
  const today = day(new Date());
  const from = input(today < schedule.date ? schedule.date : today > schedule.schedule.until ? schedule.schedule.until : today,'date');
  from.min = schedule.date;
  from.max = schedule.schedule.until;
  from.required = true;
  form.append(el('strong','',schedule.text));
  if (!remove) {
    const label = el('label','field','Первый день без этого графика');
    label.append(from);
    form.append(label);
  }
  form.append(el('p','calendar-muted',remove
    ? 'Будут удалены все смены этого графика и их изменения. События и отдельно добавленные смены сохранятся.'
    : 'Смены до выбранной даты останутся в календаре. События и отдельно добавленные смены сохранятся.'));
  calendarSubmit(form,remove ? 'Удалить график целиком' : 'Остановить график',async()=>{
    if (await change(s=>{
      s.events = remove ? s.events.filter(event=>event.id !== schedule.id && event.scheduleId !== schedule.id)
        : stopSchedule(s.events,schedule.id,from.value);
    })) manageSchedules(date);
  });
}
