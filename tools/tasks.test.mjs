import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../tasks-model.js',import.meta.url),'utf8');
const model = runInNewContext(source + '\n({normalizeTaskRecords,taskActiveOrder,taskMarkDone,taskChooseNext,taskMove,taskSections})');
const {normalizeTaskRecords,taskActiveOrder,taskMarkDone,taskChooseNext,taskMove,taskSections} = model;
const json = value=>JSON.parse(JSON.stringify(value));
const pending = (id,extra = {})=>({id,text:id,done:false,...extra});

test('старые задачи и новые поля переживают сохранение в существующем наборе записей',()=>{
  const records = [
    pending('old-task'),
    pending('dated',{date:'2028-02-29',time:'15:00',important:true,listId:'list-demo'}),
    {id:'list-demo',kind:'list',name:'  Работа  '},
    pending('invalid',{date:'2026-02-30',time:'15:00'}),
  ];
  assert.deepEqual(json(normalizeTaskRecords(records)),[
    records[0],records[1],{id:'list-demo',kind:'list',name:'Работа'},pending('invalid')
  ]);
});

test('карточка ждёт явного выбора после выполнения и сохраняет ручной порядок',()=>{
  let records = [pending('first'),pending('second'),pending('third')];
  taskMove(records,'third',-1);
  assert.deepEqual(json(taskActiveOrder(records).map(task=>task.id)),['first','third','second']);
  records = taskMarkDone(records,'first',true,1);
  records = normalizeTaskRecords(json(records));
  assert.equal(records.find(record=>record.kind === 'focus').taskId,'first');
  records = taskChooseNext(records,'second');
  assert.equal(records.some(record=>record.kind === 'focus'),false);
  assert.deepEqual(json(taskActiveOrder(records).map(task=>task.id)),['second','third']);
  records = taskMarkDone(records,'first',false);
  assert.deepEqual(json(taskActiveOrder(records).map(task=>task.id)),['second','third','first']);
  records = taskMarkDone(records,'second',true,2);
  records = taskMarkDone(records,'second',false);
  assert.equal(records.some(record=>record.kind === 'focus'),false);
  assert.equal(taskActiveOrder(records)[0].id,'second');
});

test('даты на текущий день, прошедшее время и задачи без даты попадают в свои разделы',()=>{
  const items = [
    pending('future',{date:'2026-11-29'}),
    pending('today-late',{date:'2026-11-28',time:'15:00'}),
    pending('flexible',{date:'2026-11-28'}),
    pending('earlier',{date:'2026-11-28',time:'08:00'}),
    pending('yesterday',{date:'2026-11-27'}),
    pending('undated')
  ];
  assert.deepEqual(json(taskSections(items,'2026-11-28','09:00')
    .map(([key,,tasks])=>[key,tasks.map(task=>task.id)])),[
    ['overdue',['yesterday','earlier']],['today',['flexible','today-late']],
    ['upcoming',['future']],['undated',['undated']]
  ]);
});
