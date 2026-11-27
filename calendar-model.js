const shiftTypes = {
  day: ['Дневная', 'Д'],
  night: ['Ночная', 'Н'],
  full: ['Суточная', 'С'],
  off: ['Выходной', 'В'],
  extra: ['Подработка', 'П'],
  vacation: ['Отпуск'],
  sick: ['Больничный'],
  skip: ['Смена отменена', '×']
};
const primaryShiftKinds = ['day','night','full','off','vacation','sick'];
const cycleShiftKinds = [...primaryShiftKinds,'extra'];
const hasShiftTime = kind => ['day','night','full','extra'].includes(kind);
const shiftPresets = {
  '2/2': ['day','day','off','off'],
  '5/2': ['day','day','day','day','day','off','off'],
  'Сутки через трое': ['full','off','off','off'],
  'День → ночь → два выходных': ['day','night','off','off']
};
const dateStamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(value) : NaN;
const validDate = value => Number.isFinite(dateStamp(value)) && new Date(dateStamp(value)).toISOString().slice(0,10) === value;
const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

function normalizeShift(value, allowed) {
  if (!value || !allowed.includes(value.kind)) return null;
  const timed = hasShiftTime(value.kind) && validTime(value.from) && validTime(value.to);
  return {kind:value.kind, from:timed ? value.from : '', to:timed ? value.to : '',
    nextDay:timed && (value.nextDay === true || value.to < value.from),
    note:typeof value.note === 'string' ? value.note.slice(0,240) : ''};
}

function normalizeCalendarEvent(record) {
  const event = {id:record.id, text:record.text.slice(0,240), date:record.date};
  if (record.schedule && validDate(record.date)) {
    const {until, cycle} = record.schedule;
    if (!validDate(until) || until < record.date || !Array.isArray(cycle) || !cycle.length || cycle.length > 31) return null;
    const steps = cycle.map(step=>normalizeShift(step,cycleShiftKinds));
    return steps.every(Boolean) ? {...event,schedule:{until,cycle:steps}} : null;
  }
  if (record.shift && validDate(record.date)) {
    const shift = normalizeShift(record.shift,Object.keys(shiftTypes));
    if (!shift) return null;
    const scheduleId = typeof record.scheduleId === 'string' ? record.scheduleId : '';
    return {...event,shift,scheduleId};
  }
  return event;
}

function scheduleShift(schedule, date) {
  if (!schedule?.schedule || date < schedule.date || date > schedule.schedule.until) return null;
  const offset = (dateStamp(date) - dateStamp(schedule.date)) / 86400000;
  return schedule.schedule.cycle[offset % schedule.schedule.cycle.length] ?? null;
}

function calendarEntries(events, date) {
  const dated = events.filter(event=>event.date === date && !event.schedule);
  const standalone = dated.filter(event=>event.shift && !event.scheduleId);
  const hasManualShift = standalone.some(event=>event.shift.kind !== 'extra');
  const shifts = events.filter(event=>!hasManualShift && event.schedule && scheduleShift(event,date)).map(schedule=>{
    const override = dated.find(event=>event.scheduleId === schedule.id);
    return {shift:override?.shift ?? scheduleShift(schedule,date), schedule, record:override};
  });
  shifts.push(...standalone.map(record=>({shift:record.shift,record})));
  return {shifts, events:dated.filter(event=>!event.shift)};
}

function shiftDateOffset(date, months) {
  const result = new Date(dateStamp(date));
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth()+months);
  const last = new Date(result);
  last.setUTCMonth(last.getUTCMonth()+1,0);
  result.setUTCDate(Math.min(originalDay-1,last.getUTCDate()));
  return result.toISOString().slice(0,10);
}

function stopSchedule(events, id, from) {
  const schedule = events.find(event=>event.id === id && event.schedule);
  if (!schedule) return events;
  if (from > schedule.schedule.until) return events;
  if (from <= schedule.date) return events.filter(event=>event.id !== id && event.scheduleId !== id);
  schedule.schedule.until = new Date(dateStamp(from)-86400000).toISOString().slice(0,10);
  return events.filter(event=>event.scheduleId !== id || event.date < from);
}

function shiftTime(shift) {
  return shift.from ? shift.from+'–'+shift.to+(shift.nextDay ? ' (+1 день)' : '') : '';
}
