const DAY = 86400000;
const PERIODS = [1, 7, 30];
const RETENTION = PERIODS.at(-1) * DAY;
const KEY = 'siteActivity';
const ALARM = 'site-activity-minute';
let pending = Promise.resolve();

async function activeHost() {
  const [win, idle] = await Promise.all([
    chrome.windows.getLastFocused(), chrome.idle.queryState(60)
  ]);
  if (!win.focused || win.incognito || idle !== 'active') return '';
  const [tab] = await chrome.tabs.query({active:true, windowId:win.id});
  if (!tab?.url || tab.incognito) return '';
  const url = new URL(tab.url);
  return ['http:', 'https:'].includes(url.protocol) ? url.hostname : '';
}

function advance(previous, session, host, now) {
  const cutoff = now - RETENTION;
  const spans = (previous?.spans || []).filter(s => s.end > cutoff);
  if (spans.length) spans[0].start = Math.max(spans[0].start, cutoff);
  const cursor = previous?.cursor;
  const since = Math.max(cutoff, previous?.since ?? previous?.spans?.[0]?.start ?? cursor?.time ?? now);
  if (cursor?.session === session && cursor.host && now > cursor.time) {
    // After a long gap the device may have slept. Credit at most one heartbeat.
    const end = now - cursor.time <= 90000 ? now : cursor.time + 60000;
    const start = Math.max(cursor.time, cutoff);
    if (end > start) {
      const last = spans.at(-1);
      if (last?.host === cursor.host && last.end === start) last.end = end;
      else spans.push({host:cursor.host, start, end});
    }
  }
  return {spans, since, cursor:{host, time:now, session}};
}
function sample() {
  const now = Date.now();
  const host = activeHost().catch(() => '');
  const run = pending.then(async () => {
    let {activitySession} = await chrome.storage.session.get('activitySession');
    if (!activitySession) {
      activitySession = crypto.randomUUID();
      await chrome.storage.session.set({activitySession});
    }
    const previous = (await chrome.storage.local.get(KEY))[KEY];
    const next = advance(previous, activitySession, await host, now);
    await chrome.storage.local.set({[KEY]:next});
    return next;
  });
  pending = run.catch(error => console.error('Учёт времени', error));
  return run;
}
chrome.tabs.onActivated.addListener(sample);
chrome.tabs.onUpdated.addListener((id, change, tab) => {if (tab.active && change.url) sample()});
chrome.windows.onFocusChanged.addListener(sample);
chrome.idle.onStateChanged.addListener(sample);
chrome.alarms.onAlarm.addListener(alarm => {if (alarm.name === ALARM) sample()});

function summarize(spans, cutoff) {
  const totals = new Map();
  for (const {host,start,end} of spans) {
    const elapsed = end - Math.max(start,cutoff);
    if (elapsed > 0) totals.set(host,(totals.get(host) || 0) + elapsed);
  }
  return [...totals].sort((a,b) => b[1] - a[1]);
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'activity-summary') return;
  sample().then(({spans,since,cursor}) => {
    if (!message.periods) return reply(summarize(spans,cursor.time - DAY));
    const summaries = Object.fromEntries(PERIODS.map(days => [days,summarize(spans,cursor.time - days * DAY)]));
    reply({summaries,since,now:cursor.time});
  }, () => reply(null));
  return true;
});
async function start() {
  if (!await chrome.alarms.get(ALARM)) await chrome.alarms.create(ALARM,{periodInMinutes:1});
}
start().catch(error => console.error(error));
chrome.runtime.onInstalled.addListener(sample);
chrome.runtime.onStartup.addListener(sample);
