'use strict';

let tasksView;
let tasksCardSource;
let tasksGroupingMinute;

function tasks(n) {
  n.classList.add('tasks-widget');
  const first = taskActiveOrder(state.tasks)[0];
  const actions = el('div','tasks-card-actions');
  const open = btn('Открыть задачи','↗',()=>openTasks({},'open'),'mini');
  open.dataset.taskCardControl = 'open';
  actions.append(open);
  if (first) {
    const add = btn('Быстро добавить задачу','＋',()=>openTaskQuickAdd(),'mini');
    add.dataset.taskCardControl = 'add';
    actions.append(add);
  }
  n.append(cap('tasks',actions));
  if (state.tasks.some(record=>record.kind === 'focus')) {
    const done = el('div','tasks-card-done');
    const status = el('strong','tasks-card-status','Готово');
    status.prepend(icon('engineCheck'));
    done.append(status);
    const next = first
      ? btn('Выбрать следующую','Выбрать следующую',()=>openTasks({mode:'choose'},'next'),'tasks-link')
      : btn('Добавить задачу','＋ Добавить',()=>openTaskQuickAdd('', 'next'),'tasks-link');
    next.dataset.taskCardControl = 'next';
    done.append(next);
    n.append(done);
  } else if (first) {
    n.append(taskRow(first,'widget'));
  } else {
    const empty = el('div','tasks-empty-state');
    const add = btn('Добавить задачу','＋ Добавить',()=>openTaskQuickAdd('','empty'),'tasks-empty-add');
    add.dataset.taskCardControl = 'empty';
    empty.append(el('strong','','Нет активных задач'),add);
    n.append(empty);
  }
}

function restoreTasksCardFocus() {
  const control = tasksCardSource;
  tasksCardSource = null;
  if (!control) return;
  const card = board.querySelector('[data-id="tasks"]');
  (card?.querySelector(`[data-task-card-control="${control}"]`) ??
    card?.querySelector('[data-task-card-control="open"]'))?.focus({preventScroll:true});
}

function taskRow(item,context = 'list',after = null) {
  const row = el('div','tasks-row');
  row.classList.toggle('is-completed',item.done);
  const check = input('','checkbox');
  check.checked = item.done;
  check.setAttribute('aria-label',(item.done ? 'Вернуть в активные: ' : 'Выполнить: ')+item.text);
  check.dataset.taskFocus = 'check-'+item.id;
  check.dataset.taskCardControl = 'check';
  check.onchange = async ()=>{
    const done = check.checked;
    check.disabled = true;
    const saved = await change(s=>{s.tasks = taskMarkDone(s.tasks,item.id,done)});
    check.disabled = false;
    if (!saved) {
      check.checked = item.done;
      check.focus();
      return;
    }
    if (after && activeDialog === 'calendar' && dialog.open) after();
    if (context === 'widget' && !dialog.open) {
      board.querySelector('[data-id="tasks"] [data-task-card-control="next"]')?.focus({preventScroll:true});
    }
  };
  const edit = btn('Редактировать: '+item.text,item.text,()=>{
    if (context === 'widget') tasksCardSource = 'title';
    if (activeDialog === 'tasks') rememberTaskDraft();
    openTaskEditor({item,onBack:context === 'widget' ? null : after ?? (()=>showTasksView('title-'+item.id))});
  },'tasks-row-title');
  edit.dataset.taskFocus = 'title-'+item.id;
  edit.dataset.taskCardControl = 'title';
  row.append(check,edit);
  const metadata = el('div','tasks-row-meta');
  if (item.date && context !== 'calendar') {
    const date = context === 'today' ? '' : taskDateShort(item.date);
    if (date || item.time) metadata.append(el('small','tasks-due',[date,item.time].filter(Boolean).join(' · ')));
  } else if (item.time) {
    metadata.append(el('small','tasks-due',item.time));
  }
  if (item.important) metadata.append(el('small','tasks-important','Важно'));
  if (metadata.childNodes.length) row.append(metadata);
  return row;
}

function taskDateShort(date) {
  return new Date(date+'T12:00:00').toLocaleDateString('ru',{day:'numeric',month:'short',
    ...(date.slice(0,4) === day(new Date()).slice(0,4) ? {} : {year:'numeric'})});
}

function openTasks(options = {},source = null) {
  tasksCardSource = source;
  tasksView = {listId:'',completed:false,mode:'list',draft:'',...options};
  showTasksView(options.mode === 'choose' ? 'first-task' : '');
}

function showTasksView(focus = '') {
  modal('Задачи','tasks');
  const layout = el('div','tasks-layout');
  const side = el('nav','tasks-lists');
  side.setAttribute('aria-label','Списки задач');
  const main = el('section','tasks-main');
  const toolbar = el('div','tasks-toolbar');
  const content = el('div','tasks-content');
  layout.append(side,main);
  main.append(toolbar,content);
  fields.append(layout);
  renderTasksView();
  if (focus === 'first-task') content.querySelector('button')?.focus();
  else if (focus) focusTaskView(focus);
}

function focusTaskView(key) {
  const target = Array.from(fields.querySelectorAll('[data-task-focus]')).find(node=>node.dataset.taskFocus === key);
  (target && !target.disabled ? target : fields.querySelector('.tasks-toolbar [aria-pressed="true"]') ??
    fields.querySelector('.tasks-toolbar button'))?.focus({preventScroll:true});
}

function rememberTaskDraft() {
  const draft = fields.querySelector('.tasks-composer input')?.value;
  if (draft !== undefined) tasksView.draft = draft;
}

function updateTasksDueView(now) {
  if (tasksGroupingMinute !== Math.floor(now.getTime()/60000)) renderTasksView();
}

function renderTasksView() {
  if (!dialog.open || activeDialog !== 'tasks') return;
  const {mode,completed} = tasksView;
  const lists = taskLists(state.tasks);
  if (tasksView.listId && !lists.some(list=>list.id === tasksView.listId)) tasksView.listId = '';
  const {listId} = tasksView;
  const side = fields.querySelector('.tasks-lists'), toolbar = fields.querySelector('.tasks-toolbar');
  const content = fields.querySelector('.tasks-content');
  const focused = document.activeElement;
  const focusKey = fields.contains(focused) ? focused.dataset.taskFocus : '';
  const composer = fields.querySelector('.tasks-composer');
  if (composer && composer.dataset.taskList !== listId) {
    rememberTaskDraft();
    composer.remove();
  }
  side.replaceChildren();
  toolbar.replaceChildren();

  function selectView(next,focus) {
    rememberTaskDraft();
    Object.assign(tasksView,next);
    showTasksView(focus);
  }

  for (const {id,name} of [{id:'',name:'Все задачи'},...lists]) {
    const key = 'list-'+id;
    const button = btn(name,name,()=>selectView({mode:'list',listId:id},key),'tasks-list-button');
    button.dataset.taskFocus = key;
    button.setAttribute('aria-pressed',String(mode === 'list' && listId === id));
    side.append(button);
  }
  const addList = btn('Новый список','＋ Список',()=>{
    rememberTaskDraft();
    openTaskListEditor();
  },'tasks-list-button tasks-secondary');
  addList.dataset.taskFocus = 'add-list';
  const order = btn('Порядок на карточке','Порядок на карточке',()=>selectView({mode:'order'},'order'),'tasks-list-button tasks-secondary');
  order.dataset.taskFocus = 'order';
  order.setAttribute('aria-pressed',String(mode === 'order'));
  side.append(addList,order);

  if (mode !== 'list') {
    const caption = mode === 'choose' ? 'Выбрать следующую' : 'Порядок на карточке';
    const back = btn('К списку задач','К списку задач',()=>selectView({mode:'list',completed:false},'active'),'tasks-link');
    back.dataset.taskFocus = 'back';
    toolbar.append(el('strong','',caption),back);
    content.replaceChildren(taskOrderView(mode));
  } else {
    for (const [isCompleted,key,label] of [[false,'active','Активные'],[true,'completed','Завершённые']]) {
      const tab = btn(label,label,()=>selectView({completed:isCompleted},key),'tasks-tab');
      tab.dataset.taskFocus = key;
      tab.setAttribute('aria-pressed',String(completed === isCompleted));
      toolbar.append(tab);
    }
    const selectedList = lists.find(list=>list.id === listId);
    if (selectedList) {
      const edit = btn('Настроить список','Настроить список',()=>{
        rememberTaskDraft();
        openTaskListEditor(selectedList);
      },'tasks-link tasks-list-edit');
      edit.dataset.taskFocus = 'edit-list';
      toolbar.append(edit);
    }
    if (!completed && !fields.querySelector('.tasks-composer')) {
      content.before(taskComposer({
        text:tasksView.draft,listId,
        onSave:()=>{tasksView.draft = ''},
        onBack:()=>showTasksView('add-details'),
        onDetails:text=>{tasksView.draft = text}
      }));
    }
    content.replaceChildren(taskTaskList(listId,completed));
  }
  if (focusKey && !focused.isConnected) focusTaskView(focusKey);
}

function taskOrderView(mode) {
  const list = el('div','tasks-order');
  const ordered = taskActiveOrder(state.tasks);
  if (!ordered.length) list.append(el('p','muted','Активных задач пока нет.'));
  ordered.forEach((item,index)=>{
    if (mode === 'choose') {
      const choose = btn('Выбрать: '+item.text,item.text,async()=>{
        if (await change(s=>{s.tasks = taskChooseNext(s.tasks,item.id)}) &&
            activeDialog === 'tasks' && tasksView.mode === 'choose') dialog.close();
      },'tasks-choice');
      choose.dataset.taskFocus = 'choose-'+item.id;
      list.append(choose);
      return;
    }
    const row = el('div','tasks-order-row');
    row.append(el('span','',item.text));
    for (const [step,label,text] of [[-1,'Выше','↑'],[1,'Ниже','↓']]) {
      const move = btn(label+': '+item.text,text,()=>change(s=>taskMove(s.tasks,item.id,step)),'mini');
      move.disabled = index + step < 0 || index + step >= ordered.length;
      move.dataset.taskFocus = 'move-'+step+'-'+item.id;
      row.append(move);
    }
    list.append(row);
  });
  return list;
}

function taskTaskList(listId,completed) {
  const list = el('div','tasks-groups');
  if (completed) {
    const items = taskItems(state.tasks).filter(task=>task.done && (!listId || task.listId === listId))
      .sort((a,b)=>(b.completedAt ?? 0) - (a.completedAt ?? 0));
    if (!items.length) list.append(el('p','muted','Завершённых задач пока нет.'));
    for (const item of items) list.append(taskRow(item));
    return list;
  }
  const now = new Date();
  tasksGroupingMinute = Math.floor(now.getTime()/60000);
  const items = taskActiveOrder(state.tasks).filter(task=>!listId || task.listId === listId);
  if (!items.length) list.append(el('p','muted','Активных задач пока нет.'));
  const time = now.toTimeString().slice(0,5);
  for (const [kind,label,group] of taskSections(items,day(now),time)) {
    const section = el('section','tasks-group tasks-'+kind);
    section.append(el('h3','',label));
    for (const item of group) section.append(taskRow(item,kind));
    list.append(section);
  }
  return list;
}

function taskNameInput(value = '') {
  const name = input(value);
  name.maxLength = 240;
  name.required = true;
  return name;
}

function taskSubmit(form,button,save) {
  form.onsubmit = async event=>{
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    try { await save() } finally { button.disabled = false }
  };
}

function saveTask(item,values) {
  return change(s=>{
    const listExists = taskLists(s.tasks).some(list=>list.id === values.listId);
    if (values.listId && !listExists) throw Error('Список уже удалён. Выберите другой.');
    if (item) {
      const record = taskItems(s.tasks).find(task=>task.id === item.id);
      if (!record) throw Error('Задача уже удалена');
      Object.assign(record,values);
      return;
    }
    if (!taskActiveOrder(s.tasks).length) s.tasks = s.tasks.filter(record=>record.kind !== 'focus');
    s.tasks.push({id:Date.now()+'-'+crypto.randomUUID(),done:false,...values});
  });
}

function taskComposer({text = '',listId = '',onBack,onSave,onDetails,quick = false}) {
  const form = el('form',quick ? 'tasks-composer tasks-composer-quick' : 'tasks-composer');
  form.dataset.taskList = listId;
  const name = taskNameInput(text);
  name.placeholder = quick ? 'Например, купить корм' : 'Новая задача';
  const add = el('button','tasks-primary',quick ? 'Добавить' : '＋');
  add.type = 'submit';
  add.setAttribute('aria-label','Добавить задачу');
  const details = btn('Подробнее','Подробнее',()=>{
    onDetails?.(name.value);
    openTaskEditor({text:name.value,listId,onBack});
  });
  details.dataset.taskFocus = 'add-details';
  if (quick) {
    const actions = el('div','tasks-editor-actions');
    actions.append(details,add);
    form.append(taskFormField('Название задачи',name),actions);
  } else {
    const entry = el('div','tasks-compose-entry');
    name.setAttribute('aria-label','Название новой задачи');
    entry.append(name,add);
    form.append(entry,details);
  }
  taskSubmit(form,add,async()=>{
    if (!name.value.trim()) {
      name.focus();
      return;
    }
    if (await saveTask(null,{text:name.value.trim(),listId}) && form.isConnected) {
      name.value = '';
      onSave?.();
      if (form.isConnected) name.focus();
    }
  });
  return form;
}

function openTaskQuickAdd(text = '',source = 'add') {
  tasksCardSource = source;
  modal('Новая задача','tasks-quick');
  let draft = text;
  const composer = taskComposer({text,quick:true,onSave:()=>dialog.close(),onDetails:value=>{draft = value},
    onBack:()=>openTaskQuickAdd(draft,source)});
  fields.append(composer);
  composer.querySelector('input').focus();
}

function taskFormField(label,control) {
  const field = el('label','field',label);
  field.append(control);
  return field;
}

function openTaskEditor({item = null,text = '',date = '',listId = '',onBack = null}) {
  modal(item ? 'Редактирование задачи' : 'Новая задача','tasks-editor');
  const form = el('form','tasks-editor');
  const name = taskNameInput(item?.text ?? text);
  const due = input(item?.date ?? date,'date'), time = input(item?.time ?? '','time');
  due.min = '0001-01-01';
  due.max = '9999-12-31';
  time.disabled = !due.value;
  due.oninput = ()=>{
    if (!due.value) time.value = '';
    time.disabled = !due.value;
  };
  const choices = el('select');
  for (const list of [{id:'',name:'Без списка'},...taskLists(state.tasks)]) {
    const option = el('option','',list.name);
    option.value = list.id;
    choices.append(option);
  }
  choices.value = item?.listId ?? listId;
  if (choices.selectedIndex < 0) choices.value = '';
  const important = input('','checkbox');
  important.checked = !!item?.important;
  const importantLabel = el('label','tasks-check-label');
  importantLabel.append(important,document.createTextNode('Важно'));
  const dates = el('div','tasks-editor-dates');
  dates.append(taskFormField('Дата',due),taskFormField('Время',time));
  form.append(taskFormField('Название',name),dates,taskFormField('Список',choices),importantLabel);
  const actions = el('div','tasks-editor-actions');
  const finish = ()=>{if (onBack) onBack();else dialog.close()};
  if (onBack) actions.append(btn('Назад','Назад',onBack));
  if (item) actions.append(btn('Удалить задачу','Удалить',async()=>{
    if (!window.confirm('Удалить задачу «'+item.text+'»?')) return;
    if (await change(s=>{
      s.tasks = s.tasks.filter(task=>task.id !== item.id);
    }) && form.isConnected) finish();
  },'tasks-delete'));
  const save = el('button','tasks-primary',item ? 'Сохранить' : 'Добавить');
  save.type = 'submit';
  actions.append(save);
  form.append(actions);
  taskSubmit(form,save,async()=>{
    if (!name.value.trim()) {
      name.focus();
      return;
    }
    if (await saveTask(item,{text:name.value.trim(),date:due.value,time:time.value,listId:choices.value,important:important.checked}) &&
        form.isConnected) {
      if (!item && activeDialog === 'tasks-editor' && tasksView) tasksView.draft = '';
      finish();
    }
  });
  fields.append(form);
  name.focus();
}

function openTaskListEditor(item = null) {
  modal(item ? 'Список задач' : 'Новый список','tasks-editor');
  const form = el('form','tasks-editor');
  const name = input(item?.name ?? '');
  name.required = true;
  name.maxLength = 60;
  const actions = el('div','tasks-editor-actions');
  const back = ()=>showTasksView(item ? 'edit-list' : 'add-list');
  actions.append(btn('Назад','Назад',back));
  if (item) actions.append(btn('Удалить список','Удалить список',async()=>{
    if (!window.confirm('Удалить список «'+item.name+'»? Его задачи останутся в разделе «Все задачи».')) return;
    if (await change(s=>{
      s.tasks = s.tasks.filter(record=>record.id !== item.id);
      for (const task of taskItems(s.tasks)) if (task.listId === item.id) delete task.listId;
    }) && form.isConnected) {
      tasksView.listId = '';
      showTasksView('list-');
    }
  },'tasks-delete'));
  const save = el('button','tasks-primary',item ? 'Сохранить' : 'Создать');
  save.type = 'submit';
  actions.append(save);
  form.append(taskFormField('Название списка',name),actions);
  taskSubmit(form,save,async()=>{
    const value = name.value.trim();
    if (!value) {
      name.focus();
      return;
    }
    const id = item?.id ?? 'list-'+crypto.randomUUID();
    if (await change(s=>{
      const lists = taskLists(s.tasks);
      if (['Все задачи','Без списка',...lists.filter(list=>list.id !== id).map(list=>list.name)]
        .some(name=>name.localeCompare(value,'ru',{sensitivity:'accent'}) === 0)) {
        throw Error('Список с таким названием уже есть');
      }
      const existing = lists.find(list=>list.id === id);
      if (existing) existing.name = value;
      else if (item) throw Error('Список уже удалён');
      else s.tasks.push({id,kind:'list',name:value});
    }) && form.isConnected) {
      Object.assign(tasksView,{mode:'list',listId:id});
      showTasksView('list-'+id);
    }
  });
  fields.append(form);
  name.focus();
}

function appendCalendarTasks(target,date,items) {
  const section = el('section','calendar-task-section');
  section.append(el('h4','','Задачи'));
  const back = ()=>openCalendar(date,'date');
  for (const item of items) section.append(taskRow(item,'calendar',back));
  section.append(btn('Добавить задачу','＋ Задача',()=>openTaskEditor({date,onBack:back})));
  target.append(section);
}
