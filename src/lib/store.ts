import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DEFAULT_PROFILE,type Asset,type Item,type ItemInput,type Profile} from './types';
import type {DailyLike} from './types';
import {LIKES_SCHEMA,DAILY_LIKE_SQL,likeStateSql} from './likes-schema';
import {STATISTICS_SCHEMA,RECORD_VISIT_SQL,STATISTICS_SUMMARY_SQL,STATISTICS_HISTORY_SQL,shiftDay,statisticsResult} from './statistics-schema';

export class Store {
  readonly db:DatabaseSync;
  readonly directory:string;
  constructor(directory:string){
    this.directory=resolve(directory);mkdirSync(this.directory,{recursive:true});mkdirSync(join(this.directory,'files'),{recursive:true});
    this.db=new DatabaseSync(join(this.directory,'world.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,kind TEXT NOT NULL,visibility TEXT NOT NULL,asset_id TEXT,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY CHECK(id=1),name TEXT NOT NULL,password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS login_attempts(id INTEGER PRIMARY KEY CHECK(id=1),count INTEGER NOT NULL,started INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,started INTEGER NOT NULL);`);
    this.db.exec(LIKES_SCHEMA);
    this.db.exec(STATISTICS_SCHEMA);
  }
  close(){this.db.close();}
  listItems(owner:boolean):Item[]{const rows=this.db.prepare(owner?'SELECT data FROM items':'SELECT data FROM items WHERE visibility=\'public\'').all();return rows.map(row=>JSON.parse(String(row.data)) as Item).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  getItem(id:string,owner=true):Item|null{const row=this.db.prepare('SELECT data,visibility FROM items WHERE id=?').get(id);return row&&(owner||row.visibility==='public')?JSON.parse(String(row.data)):null;}
  saveItem(input:ItemInput):Item{const existing=input.id?this.getItem(input.id):null;const item:Item={...input,id:existing?.id||randomUUID(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};this.db.prepare('INSERT INTO items(id,kind,visibility,asset_id,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,visibility=excluded.visibility,asset_id=excluded.asset_id,data=excluded.data').run(item.id,item.kind,item.visibility,item.assetId,JSON.stringify(item));return item;}
  deleteItem(id:string){return this.db.prepare('DELETE FROM items WHERE id=?').run(id).changes>0;}
  getLikes(ids:string[],visitor:string,day:string,owner:boolean):Record<string,DailyLike>{
    if(!ids.length)return {};
    const rows=this.db.prepare(likeStateSql(ids.length)).all(day,visitor,...ids,owner?1:0);
    return Object.fromEntries(rows.map(row=>[String(row.id),{count:Number(row.count),liked:!!row.liked}]));
  }
  addDailyLike(id:string,visitor:string,day:string,owner:boolean){return !!this.db.prepare(DAILY_LIKE_SQL).get(visitor,day,id,owner?1:0);}
  recordVisit(eventId:string,visitor:string,day:string){
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const recorded=!!this.db.prepare(RECORD_VISIT_SQL).get(eventId,visitor,day);
      const cutoff=shiftDay(day,-30);
      this.db.prepare('DELETE FROM site_stats_events WHERE day<?').run(cutoff);
      this.db.prepare('DELETE FROM site_stats_daily_visitors WHERE day<?').run(cutoff);
      this.db.exec('COMMIT');return recorded;
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  getStatistics(day:string){
    const summary=this.db.prepare(STATISTICS_SUMMARY_SQL).get(day)!;
    const history=this.db.prepare(STATISTICS_HISTORY_SQL).all(shiftDay(day,-13),day) as unknown as {day:string;views:number;visitors:number}[];
    return statisticsResult(summary,history,day);
  }
  addAsset(input:Omit<Asset,'id'|'createdAt'>):Asset{const asset={...input,id:randomUUID(),createdAt:new Date().toISOString()};this.db.prepare('INSERT INTO assets(id,data) VALUES(?,?)').run(asset.id,JSON.stringify(asset));return asset;}
  getAsset(id:string):Asset|null{const row=this.db.prepare('SELECT data FROM assets WHERE id=?').get(id);return row?JSON.parse(String(row.data)):null;}
  listAssets():Asset[]{return this.db.prepare('SELECT data FROM assets').all().map(row=>JSON.parse(String(row.data)) as Asset).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  deleteAsset(id:string){return this.db.prepare('DELETE FROM assets WHERE id=?').run(id).changes>0;}
  readAsset(id:string){return readFile(join(this.directory,'files',id));}
  writeAsset(id:string,content:Buffer){return writeFile(join(this.directory,'files',id),content,{flag:'wx'});}
  async removeAsset(id:string){await unlink(join(this.directory,'files',id)).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  isPublicAsset(id:string):boolean{return this.getProfile().avatarId===id||!!this.db.prepare('SELECT id FROM items WHERE asset_id=? AND visibility=\'public\' LIMIT 1').get(id);}
  assetInUse(id:string):boolean{return this.getProfile().avatarId===id||!!this.db.prepare('SELECT id FROM items WHERE asset_id=? LIMIT 1').get(id);}
  // 换了配图之后，旧图不会自己消失（删的是条目指向，不是文件），攒久了就是一堆没人引用的孤儿。
  // 这里一次性把「正在被用」的 id 捞出来，剩下的都是可以安全清掉的。
  listUnusedAssets():Asset[]{
    const avatar=this.getProfile().avatarId;
    const used=new Set((this.db.prepare('SELECT asset_id AS id FROM items WHERE asset_id IS NOT NULL').all() as {id:string}[]).map(row=>String(row.id)));
    return this.listAssets().filter(asset=>asset.mime.startsWith('image/')&&asset.id!==avatar&&!used.has(asset.id));
  }
  getProfile():Profile{const row=this.db.prepare('SELECT data FROM settings WHERE key=\'profile\'').get();return row?{...DEFAULT_PROFILE,...JSON.parse(String(row.data))}:{...DEFAULT_PROFILE};}
  saveProfile(profile:Profile){this.db.prepare('INSERT INTO settings(key,data) VALUES(\'profile\',?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run(JSON.stringify(profile));return profile;}
  getOwner():{name:string;password:string}|null{const row=this.db.prepare('SELECT name,password FROM owner WHERE id=1').get();return row?{name:String(row.name),password:String(row.password)}:null;}
  setOwner(name:string,password:string){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT INTO owner(id,name,password) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,password=excluded.password').run(name,password);this.db.exec('DELETE FROM sessions; COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}}
  private tokenHash(token:string){return createHash('sha256').update(token).digest('hex');}
  createSession(token:string,expires:number){this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());this.db.prepare('INSERT INTO sessions(token,expires) VALUES(?,?)').run(this.tokenHash(token),expires);}
  hasSession(token:string):boolean{return !!this.db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(this.tokenHash(token),Date.now());}
  sessionExpires(token:string):number|null{const row=this.db.prepare('SELECT expires FROM sessions WHERE token=? AND expires>?').get(this.tokenHash(token),Date.now());return row?Number(row.expires):null;}
  extendSession(token:string,expires:number){this.db.prepare('UPDATE sessions SET expires=? WHERE token=?').run(expires,this.tokenHash(token));}
  deleteSession(token:string){this.db.prepare('DELETE FROM sessions WHERE token=?').run(this.tokenHash(token));}
  private limitCount(key:string,window:number):number{const row=this.db.prepare('SELECT count,started FROM auth_limits WHERE key=?').get(key);return row&&Number(row.started)>Date.now()-window?Number(row.count):0;}
  // 过期行清理。普通限流行 15 分钟后删；**封禁行要留 24 小时** —— 它上面存着渐进封禁的档位，
  // 跟着一起删掉的话档位就丢了，15→30→60 分钟的升级会永远退回第一档（这个坑真的踩过）。
  private cleanupLimits(now:number){
    this.db.prepare("DELETE FROM auth_limits WHERE started<=? AND key NOT LIKE 'block:%'").run(now-15*60*1000);
    this.db.prepare("DELETE FROM auth_limits WHERE started<=? AND key LIKE 'block:%'").run(now-24*60*60*1000);
  }
  private incrementLimit(key:string,window:number){const now=Date.now();this.cleanupLimits(now);this.db.prepare('INSERT INTO auth_limits(key,count,started) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN started>? THEN count+1 ELSE 1 END,started=CASE WHEN started>? THEN started ELSE excluded.started END').run(key,now,now-window,now-window);}
  // 登录失败阈值：15 分钟内 5 次错误就触发封禁。
  private static readonly LOGIN_FAILURE_THRESHOLD=5;
  // 渐进封禁档位上限：15 → 30 → 60 分钟。
  private static readonly LOGIN_BLOCK_MAX_LEVEL=3;
  private static readonly LOGIN_BLOCK_BASE_MS=15*60*1000;
  // 封禁行即使已过期也要读出来：过期后 level 还得留着，下次再触发才能升级到更长的封禁
  // （15 → 30 → 60 分钟）。早先版本在过期时返回 null，level 被重置成 1，升级永远是死代码。
  private blockRow(client:string):{level:number;until:number}|null{const row=this.db.prepare('SELECT count,started FROM auth_limits WHERE key=?').get(`block:${client}`);return row?{level:Number(row.count),until:Number(row.started)}:null;}
  private setBlock(client:string,level:number,until:number){this.db.prepare('INSERT INTO auth_limits(key,count,started) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,started=excluded.started').run(`block:${client}`,level,until);}
  loginBlocked(client='local'):boolean{const row=this.blockRow(client);return (!!row&&row.until>Date.now())||this.limitCount(`failure:${client}`,15*60*1000)>=Store.LOGIN_FAILURE_THRESHOLD;}
  // 记一次失败，并在达到阈值时（升级）封禁。把升级放在这里而不是只放在 reserveLoginVerification 里，
  // 是因为 auth 的入口会先查 loginBlocked —— 若只在后者里升级，达到阈值之后的请求会在走到升级
  // 逻辑之前就被 429 挡掉，渐进封禁永远停在 15 分钟那一档。
  recordLoginFailure(client='local'){
    this.incrementLimit(`failure:${client}`,15*60*1000);
    if(this.limitCount(`failure:${client}`,15*60*1000)>=Store.LOGIN_FAILURE_THRESHOLD)this.escalateBlock(client);
  }
  // 渐进封禁：15 → 30 → 60 分钟，到顶后维持 60 分钟。level 从封禁行上读，过期也读，所以会一路升级。
  private escalateBlock(client:string){
    const level=Math.min(Store.LOGIN_BLOCK_MAX_LEVEL,(this.blockRow(client)?.level??0)+1);
    this.setBlock(client,level,Date.now()+Store.LOGIN_BLOCK_BASE_MS*Math.pow(2,level-1));
  }
  clearLoginFailures(client='local'){this.db.prepare('DELETE FROM auth_limits WHERE key=? OR key=?').run(`failure:${client}`,`block:${client}`);}
  takeLoginAttempt(client='local'):boolean{const key=`attempt:${client}`;if(this.limitCount(key,60*1000)>=30)return false;this.incrementLimit(key,60*1000);return true;}
  takeLikeAttempt(client='local'):boolean{const key=`like:${client}`;if(this.limitCount(key,60000)>=60)return false;this.incrementLimit(key,60000);return true;}
  takeStatisticsAttempt(client='local'):boolean{const key=`stats:${client}`;if(this.limitCount(key,60000)>=60)return false;this.incrementLimit(key,60000);return true;}
  // 预留校验名额：先判封禁，再记一次失败（这一步可能会顺手把封禁升级）；被封了就返回 false。
  reserveLoginVerification(client='local'):boolean{
    if(this.loginBlocked(client))return false;
    this.recordLoginFailure(client);
    return !this.loginBlocked(client);
  }
  // 只改密码、不动会话（区别于 setOwner 会清掉所有会话）。用于登录成功后就地升级哈希成本。
  updateOwnerPassword(password:string){this.db.prepare('UPDATE owner SET password=? WHERE id=1').run(password);}
}
const globalStore=globalThis as typeof globalThis&{littleWorldStore?:Store};
export function getStore(){return globalStore.littleWorldStore??=(new Store(process.env.DATA_DIR||join(process.cwd(),'data')));}
