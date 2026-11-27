import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';

const env = process.env;
const origin = new URL(env.PUBLIC_ORIGIN).origin;
const local = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
if (!local && !origin.startsWith('https://')) throw Error('PUBLIC_ORIGIN requires HTTPS');
const ids = (env.EXTENSION_IDS || '').split(',').map(id => id.trim());
if (ids.some(id => !/^[a-p]{32}$/.test(id))) throw Error('Set EXTENSION_IDS');
const db = new DatabaseSync(env.DB_PATH || 'profiles.sqlite');
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS profiles (owner TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS wallpaper_files (owner TEXT NOT NULL, hash TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY (owner, hash));`);
const flows = new Map(), tickets = new Map();
const random = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('base64url');
const providers = {
  google: ['https://accounts.google.com/o/oauth2/v2/auth','https://oauth2.googleapis.com/token','https://openidconnect.googleapis.com/v1/userinfo','openid profile'],
  yandex: ['https://oauth.yandex.ru/authorize','https://oauth.yandex.ru/token','https://login.yandex.ru/info?format=json','login:info']
};
function fail(status, message) { throw Object.assign(new Error(message), {status}); }
function consume(map, key) {
  const item = map.get(key);
  if (!item || item.expires < Date.now()) fail(400, 'Срок входа истёк');
  map.delete(key);
  return item;
}
async function body(req) {
  let bytes = 0; const parts = [];
  for await (const part of req) {
    bytes += part.length;
    if (bytes > 1048576) fail(413, 'Слишком большой профиль');
    parts.push(part);
  }
  try { const value = JSON.parse(Buffer.concat(parts)); if (value && typeof value === 'object' && !Array.isArray(value)) return value; } catch {}
  fail(400, 'Некорректный запрос');
}
async function external(url, options) {
  const response = await fetch(url, {...options, signal: AbortSignal.timeout(12000)});
  if (!response.ok) fail(502, 'Провайдер не подтвердил вход');
  return response.json();
}
const allowed = /^gntd\.(order|hidden|tiles|theme|wall|wallpaperActive|engine|alignX|alignY|manage|track|trackName|weatherCity|(tasks|events|cities|wallpaperItem)\.[\w-]{1,150})$/;
function settings(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => !allowed.test(k))) fail(400, 'Некорректные настройки');
  return data;
}
const wallpaperFileLimit = 64 * 1024 ** 2;
const wallpaperAccountLimit = 256 * 1024 ** 2;
const wallpaperHash = /^[a-f0-9]{64}$/;
const wallpaperRecord = /^gntd\.wallpaperItem\.[\w-]{1,150}$/;
function wallpaperKeys(data) {
  const keys = new Set();
  for (const [name,value] of Object.entries(data)) {
    if (wallpaperRecord.test(name) && typeof value?.originalKey==='string' && wallpaperHash.test(value.originalKey))
      keys.add(value.originalKey);
  }
  return keys;
}
const getProfile = db.prepare('SELECT data FROM profiles WHERE owner=?');
const getWallpaper = db.prepare('SELECT bytes FROM wallpaper_files WHERE owner=? AND hash=?');
const hasWallpaper = db.prepare('SELECT 1 FROM wallpaper_files WHERE owner=? AND hash=?');
const wallpaperUsage = db.prepare('SELECT COALESCE(SUM(length(bytes)),0) AS total FROM wallpaper_files WHERE owner=?');
const storeWallpaper = db.prepare('INSERT INTO wallpaper_files (owner,hash,bytes) VALUES (?,?,?)');
const deleteWallpaper = db.prepare('DELETE FROM wallpaper_files WHERE owner=? AND hash=?');
async function originalBytes(req,key) {
  if (req.headers['content-type']?.split(';',1)[0].trim().toLowerCase()!=='application/octet-stream') {
    req.resume();
    fail(415,'Ожидается двоичный файл');
  }
  const declared = Number(req.headers['content-length']);
  if (declared>wallpaperFileLimit) {
    req.resume();
    fail(413,'Оригинал обоев превышает 64 МиБ');
  }
  const fixed = Number.isSafeInteger(declared) && declared>=0 ? Buffer.allocUnsafe(declared) : null;
  const parts = [];
  const hash = createHash('sha256');
  let received = 0;
  for await (const part of req.iterator({destroyOnReturn:false})) {
    const end = received + part.length;
    if (end>wallpaperFileLimit) {
      req.resume();
      fail(413,'Оригинал обоев превышает 64 МиБ');
    }
    if (fixed) part.copy(fixed,received);
    else parts.push(part);
    hash.update(part);
    received = end;
  }
  if (!received || (fixed && received!==fixed.length) || hash.digest('hex')!==key)
    fail(400,'Контрольная сумма оригинала не совпадает');
  return fixed ?? Buffer.concat(parts,received);
}
async function wallpaperFile(req,res,owner,key) {
  if (req.method==='GET') {
    const row = getWallpaper.get(owner,key);
    if (!row) fail(404,'Оригинал обоев не найден');
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':row.bytes.length,'X-Content-Type-Options':'nosniff'});
    return res.end(row.bytes);
  }
  if (req.method!=='PUT' && req.method!=='DELETE') fail(405,'Метод не поддерживается');
  const bytes = req.method==='PUT' ? await originalBytes(req,key) : null;
  db.exec('BEGIN IMMEDIATE');
  try {
    const profile = getProfile.get(owner);
    const referenced = profile && wallpaperKeys(JSON.parse(profile.data)).has(key);
    if (bytes) {
      if (!hasWallpaper.get(owner,key)) {
        if (!referenced) fail(409,'Добавьте оригинал в галерею перед загрузкой');
        if (wallpaperUsage.get(owner).total+bytes.length>wallpaperAccountLimit)
          fail(413,'В облаке занято 256 МиБ оригиналов обоев. Удалите ненужные фото');
        storeWallpaper.run(owner,key,bytes);
      }
    } else {
      if (referenced) fail(409,'Оригинал используется в галерее');
      deleteWallpaper.run(owner,key);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  res.writeHead(204);
  return res.end();
}
setInterval(() => {
  for (const map of [flows,tickets]) for (const [k,v] of map) if (v.expires < Date.now()) map.delete(k);
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
}, 60000).unref();
export const server = http.createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer');
  const json = value => { res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
  const redirect = to => { res.writeHead(302,{Location:String(to)}); res.end(); };
  try {
    const url = new URL(req.url, origin), q = url.searchParams, path = url.pathname;
    const provider = path.split('/')[2] || '', p = Object.hasOwn(providers,provider) && providers[provider];
    const client = env[provider.toUpperCase()+'_CLIENT_ID'], secret = env[provider.toUpperCase()+'_CLIENT_SECRET'];
    const callback = origin+'/callback/'+provider;
    if (req.method === 'GET' && p && path === '/login/'+provider) {
      if (!client || !secret) fail(503,'Этот способ входа ещё не подключён');
      const id = q.get('id'), challenge = q.get('challenge');
      if (!ids.includes(id) || !/^[\w-]{43}$/.test(challenge || '')) fail(400,'Неверные параметры расширения');
      if (flows.size >= 5000) fail(429,'Повторите позже');
      const state = random(), cookie = random(), verifier = random();
      flows.set(state,{id,challenge,cookie,verifier,provider,expires:Date.now()+600000});
      res.setHeader('Set-Cookie','gntd_flow='+cookie+'; Path=/callback/; HttpOnly; SameSite=Lax; Max-Age=600'+(local?'':'; Secure'));
      const target = new URL(p[0]);
      target.search = new URLSearchParams({client_id:client,redirect_uri:callback,response_type:'code',state,scope:p[3],code_challenge:digest(verifier),code_challenge_method:'S256'});
      return redirect(target);
    }
    if (req.method === 'GET' && p && path === '/callback/'+provider) {
      const flow = consume(flows,q.get('state'));
      if (flow.provider !== provider || !(req.headers.cookie||'').split(/;\s*/).includes('gntd_flow='+flow.cookie)) fail(400,'Повторите вход');
      const target = new URL('https://'+flow.id+'.chromiumapp.org/cloud');
      if (!q.get('code')) { target.searchParams.set('error','cancelled'); return redirect(target); }
      const token = await external(p[1],{method:'POST',body:new URLSearchParams({grant_type:'authorization_code',code:q.get('code'),client_id:client,client_secret:secret,redirect_uri:callback,code_verifier:flow.verifier})});
      const user = await external(p[2],{headers:{Authorization:(provider==='google'?'Bearer ':'OAuth ')+token.access_token}});
      const sub = provider==='google'?user.sub:user.id;
      if (typeof sub !== 'string' || !sub) fail(502,'Профиль недоступен');
      const ticket = random();
      tickets.set(ticket,{owner:provider+'/'+sub,label:String(user.name||user.display_name||provider),challenge:flow.challenge,expires:Date.now()+60000});
      target.searchParams.set('ticket',ticket); return redirect(target);
    }
    if (req.method === 'POST' && path === '/session') {
      const b = await body(req), t = consume(tickets,b.ticket);
      if (typeof b.verifier !== 'string' || digest(b.verifier)!==t.challenge) fail(403,'Не удалось подтвердить вход');
      const token = random();
      db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),t.owner,Date.now()+90*86400000);
      return json({token,owner:t.owner,label:t.label});
    }
    const hash = digest((req.headers.authorization||'').replace(/^Bearer /,''));
    const session = db.prepare('SELECT owner FROM sessions WHERE hash=? AND expires>?').get(hash,Date.now());
    if (!session) fail(401,'Войдите снова');
    if (req.method==='DELETE' && path==='/session') {
      db.prepare('DELETE FROM sessions WHERE hash=?').run(hash); return json({});
    }
    const original = /^\/wallpaper-files\/([a-f0-9]{64})$/.exec(path);
    if (original) return await wallpaperFile(req,res,session.owner,original[1]);
    if (req.method==='POST' && path==='/profile') {
      const b = await body(req);
      // No awaits inside the transaction: independent installations patch the latest profile.
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = getProfile.get(session.owner);
        const data = row ? JSON.parse(row.data) : settings(b.seed);
        const previousWallpaperKeys = wallpaperKeys(data);
        if (row && !Object.hasOwn(b,'seed')) {
          Object.assign(data,settings(b.set));
          if (!Array.isArray(b.remove) || b.remove.some(k=>!allowed.test(k))) fail(400,'Некорректные ключи');
          for (const key of b.remove) delete data[key];
        }
        const encoded = JSON.stringify(data);
        if (Buffer.byteLength(encoded)>524288) fail(413,'Профиль превышает 512 КиБ');
        if (!row || encoded!==row.data) db.prepare('INSERT OR REPLACE INTO profiles VALUES(?,?)').run(session.owner,encoded);
        if (previousWallpaperKeys.size) {
          const retained = wallpaperKeys(data);
          for (const key of previousWallpaperKeys) {
            if (!retained.has(key)) deleteWallpaper.run(session.owner,key);
          }
        }
        db.exec('COMMIT'); return json({data});
      } catch(e) { db.exec('ROLLBACK'); throw e; }
    }
    fail(404,'Адрес не найден');
  } catch(e) { res.statusCode=e.status||500; json({error:e.status?e.message:'Ошибка сервера'}); }
}).listen(Number(env.PORT||8787),env.BIND_ADDRESS||env.IP||'127.0.0.1');
