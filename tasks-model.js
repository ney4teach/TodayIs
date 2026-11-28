'use strict';

const taskFocusRecordId = 'widget-focus';

function taskDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(value+'T12:00:00Z');
  return value.slice(0,4) !== '0000' && !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0,10) === value ? value : '';
}

function normalizeTaskRecords(records) {
  if (!Array.isArray(records)) return [];
  const normalized = new Map();
  for (const record of records) {
    if (!record || typeof record.id !== 'string' || !/^[\w-]{1,150}$/.test(record.id)) continue;
    const {id} = record;
    if (id === taskFocusRecordId) {
      if (record.kind === 'focus' && typeof record.taskId === 'string') {
        normalized.set(id,{id,kind:'focus',taskId:record.taskId});
      }
      continue;
    }
    if (record.kind === 'list') {
      const name = typeof record.name === 'string' ? record.name.trim().slice(0,60) : '';
      if (name) normalized.set(id,{id,kind:'list',name});
      continue;
    }
    if (typeof record.text !== 'string' || !record.text.trim()) continue;
    const task = {id,text:record.text.trim().slice(0,240),done:!!record.done};
    const date = taskDate(record.date);
    if (date) {
      task.date = date;
      if (typeof record.time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(record.time)) task.time = record.time;
    }
    if (typeof record.listId === 'string' && /^[\w-]{1,150}$/.test(record.listId)) task.listId = record.listId;
    if (record.important === true) task.important = true;
    if (Number.isSafeInteger(record.position) && record.position >= 0) task.position = record.position;
    if (task.done && Number.isSafeInteger(record.completedAt) && record.completedAt > 0) task.completedAt = record.completedAt;
    normalized.set(id,task);
  }
  return Array.from(normalized.values());
}

function taskItems(records) {
  return records.filter(record=>!record.kind);
}

function taskLists(records) {
  return records.filter(record=>record.kind === 'list').sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}

function taskActiveOrder(records) {
  return taskItems(records).filter(task=>!task.done).sort((a,b)=>
    (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
    a.id.localeCompare(b.id));
}

function taskSetOrder(ordered) {
  ordered.forEach((task,position)=>{task.position = position});
}

function taskMove(records,id,step) {
  const ordered = taskActiveOrder(records);
  const index = ordered.findIndex(task=>task.id === id);
  const next = index + step;
  if (index < 0 || next < 0 || next >= ordered.length) return;
  [ordered[index],ordered[next]] = [ordered[next],ordered[index]];
  taskSetOrder(ordered);
}

function taskChooseNext(records,id) {
  const ordered = taskActiveOrder(records);
  const index = ordered.findIndex(task=>task.id === id);
  if (index < 0) throw Error('Эта задача уже недоступна');
  ordered.unshift(...ordered.splice(index,1));
  taskSetOrder(ordered);
  return records.filter(record=>record.kind !== 'focus');
}

function taskMarkDone(records,id,done,now = Date.now()) {
  const item = taskItems(records).find(task=>task.id === id);
  if (!item || item.done === done) return records;
  const focus = records.find(record=>record.kind === 'focus');
  if (done) {
    if (!focus && taskActiveOrder(records)[0]?.id === id) records.push({id:taskFocusRecordId,kind:'focus',taskId:id});
    item.completedAt = now;
  } else {
    if (focus?.taskId !== id) taskSetOrder([...taskActiveOrder(records),item]);
    delete item.completedAt;
  }
  item.done = done;
  return !done && focus?.taskId === id ? records.filter(record=>record !== focus) : records;
}

function taskByTime(a,b) {
  return (a.time || '').localeCompare(b.time || '');
}

function taskSections(items,today,time) {
  const overdue = [], todayTasks = [], later = [], undated = [];
  for (const task of items) {
    if (!task.date) undated.push(task);
    else if (task.date < today || (task.date === today && task.time && task.time < time)) overdue.push(task);
    else if (task.date === today) todayTasks.push(task);
    else later.push(task);
  }
  const byDate = (a,b)=>a.date.localeCompare(b.date) || taskByTime(a,b);
  return [
    ['overdue','Просроченные',overdue.sort(byDate)],
    ['today','Сегодня',todayTasks.sort(taskByTime)],
    ['upcoming','Предстоящие',later.sort(byDate)],
    ['undated','Без даты',undated]
  ].filter(([, , group])=>group.length);
}
