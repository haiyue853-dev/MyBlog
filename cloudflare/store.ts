import {createHash,randomUUID} from 'node:crypto';
import type {D1Database,R2Bucket} from '@cloudflare/workers-types';
import {DEFAULT_PROFILE,type Asset,type Item,type ItemInput,type Profile} from '../src/lib/types';
import type {SiteStore} from '../src/lib/runtime';
import {ApiError} from '../src/lib/http';
import type {DailyLike} from '../src/lib/types';
import {DAILY_LIKE_SQL,likeStateSql} from '../src/lib/likes-schema';
import {RECORD_VISIT_SQL,STATISTICS_SUMMARY_SQL,STATISTICS_HISTORY_SQL,shiftDay,statisticsResult} from '../src/lib/statistics-schema';

export class CloudStore implements SiteStore {
  constructor(readonly db:D1Database,readonly files:R2Bucket,readonly maxStorage=8*1024*1024*1024){}
  private hash(token:string){return createHash('sha256').update(token).digest('hex');}
  async listItems(owner:boolean):Promise<Item[]>{const rows=await this.db.prepare(owner?'SELECT data FROM items':"SELECT data FROM items WHERE visibility='public'").all<{data:string}>();return rows.results.map(row=>JSON.parse(row.data) as Item).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  async getItem(id:string,owner=true):Promise<Item|null>{const row=await this.db.prepare('SELECT data,visibility FROM items WHERE id=?').bind(id).first<{data:string;visibility:string}>();return row&&(owner||row.visibility==='public')?JSON.parse(row.data):null;}
  async saveItem(input:ItemInput):Promise<Item>{const old=input.id?await this.getItem(input.id):null;const item:Item={...input,id:old?.id||randomUUID(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};await this.db.prepare('INSERT INTO items(id,kind,visibility,asset_id,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,visibility=excluded.visibility,asset_id=excluded.asset_id,data=excluded.data').bind(item.id,item.kind,item.visibility,item.assetId,JSON.stringify(item)).run();return item;}
  async deleteItem(id:string){return (await this.db.prepare('DELETE FROM items WHERE id=?').bind(id).run()).meta.changes>0;}
  async getLikes(ids:string[],visitor:string,day:string,owner:boolean):Promise<Record<string,DailyLike>>{
    if(!ids.length)return {};
    const rows=await this.db.prepare(likeStateSql(ids.length)).bind(day,visitor,...ids,owner?1:0).all<{id:string;count:number;liked:number}>();
    return Object.fromEntries(rows.results.map(row=>[row.id,{count:row.count,liked:!!row.liked}]));
  }
  async addDailyLike(id:string,visitor:string,day:string,owner:boolean){return !!await this.db.prepare(DAILY_LIKE_SQL).bind(visitor,day,id,owner?1:0).first();}
  async recordVisit(eventId:string,visitor:string,day:string){
    const cutoff=shiftDay(day,-30);
    const result=await this.db.batch([
      this.db.prepare(RECORD_VISIT_SQL).bind(eventId,visitor,day),
      this.db.prepare('DELETE FROM site_stats_events WHERE day<?').bind(cutoff),
      this.db.prepare('DELETE FROM site_stats_daily_visitors WHERE day<?').bind(cutoff)
    ]);
    return result[0].results.length>0;
  }
  async getStatistics(day:string){
    const result=await this.db.batch<Record<string,unknown>>([
      this.db.prepare(STATISTICS_SUMMARY_SQL).bind(day),
      this.db.prepare(STATISTICS_HISTORY_SQL).bind(shiftDay(day,-13),day)
    ]);
    return statisticsResult(result[0].results[0],result[1].results as {day:string;views:number;visitors:number}[],day);
  }
  async getProfile():Promise<Profile>{const row=await this.db.prepare("SELECT data FROM settings WHERE key='profile'").first<{data:string}>();return row?{...DEFAULT_PROFILE,...JSON.parse(row.data)}:{...DEFAULT_PROFILE};}
  async saveProfile(profile:Profile){await this.db.prepare("INSERT INTO settings(key,data) VALUES('profile',?) ON CONFLICT(key) DO UPDATE SET data=excluded.data").bind(JSON.stringify(profile)).run();return profile;}
  async getOwner(){return this.db.prepare('SELECT name,password FROM owner WHERE id=1').first<{name:string;password:string}>();}
  async setOwner(name:string,password:string){await this.db.batch([this.db.prepare('INSERT INTO owner(id,name,password) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,password=excluded.password').bind(name,password),this.db.prepare('DELETE FROM sessions')]);}
  // 只改密码、不动会话（区别于 setOwner 会清掉所有会话）。用于登录成功后就地升级哈希成本。
  async updateOwnerPassword(password:string){await this.db.prepare('UPDATE owner SET password=? WHERE id=1').bind(password).run();}
  async addAsset(input:Omit<Asset,'id'|'createdAt'>):Promise<Asset>{
    const asset:Asset={...input,id:randomUUID(),createdAt:new Date().toISOString()};
    // Atomic size check and insert; concurrent uploads cannot bypass the storage cap.
    const result=await this.db.prepare("INSERT INTO assets(id,data) SELECT ?,? WHERE COALESCE((SELECT SUM(json_extract(data,'$.size')) FROM assets),0)+?<=?").bind(asset.id,JSON.stringify(asset),asset.size,this.maxStorage).run();
    if(!result.meta.changes)throw new ApiError(413,'资料柜接近存储上限，请先清理文件。');return asset;
  }
  async getAsset(id:string):Promise<Asset|null>{const row=await this.db.prepare('SELECT data FROM assets WHERE id=?').bind(id).first<{data:string}>();return row?JSON.parse(row.data):null;}
  async listAssets():Promise<Asset[]>{const rows=await this.db.prepare('SELECT data FROM assets').all<{data:string}>();return rows.results.map(row=>JSON.parse(row.data) as Asset).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  async deleteAsset(id:string){return (await this.db.prepare('DELETE FROM assets WHERE id=?').bind(id).run()).meta.changes>0;}
  async isPublicAsset(id:string){return (await this.getProfile()).avatarId===id||!!await this.db.prepare("SELECT id FROM items WHERE asset_id=? AND visibility='public' LIMIT 1").bind(id).first();}
  async assetInUse(id:string){return (await this.getProfile()).avatarId===id||!!await this.db.prepare('SELECT id FROM items WHERE asset_id=? LIMIT 1').bind(id).first();}
  async listUnusedAssets():Promise<Asset[]>{
    const avatar=(await this.getProfile()).avatarId;
    const rows=await this.db.prepare('SELECT asset_id AS id FROM items WHERE asset_id IS NOT NULL').all<{id:string}>();
    const used=new Set(rows.results.map(row=>String(row.id)));
    return (await this.listAssets()).filter(asset=>asset.mime.startsWith('image/')&&asset.id!==avatar&&!used.has(asset.id));
  }
  async readAsset(id:string){const object=await this.files.get(id);if(!object)throw new ApiError(404,'文件不存在。');return Buffer.from(await object.arrayBuffer());}
  async writeAsset(id:string,content:Buffer){await this.files.put(id,content);}
  async removeAsset(id:string){await this.files.delete(id);}
  async createSession(token:string,expires:number){await this.db.batch([this.db.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()),this.db.prepare('INSERT INTO sessions(token,expires) VALUES(?,?)').bind(this.hash(token),expires)]);}
  async hasSession(token:string){return await this.sessionExpires(token)!==null;}
  async sessionExpires(token:string){const row=await this.db.prepare('SELECT expires FROM sessions WHERE token=? AND expires>?').bind(this.hash(token),Date.now()).first<{expires:number}>();return row?row.expires:null;}
  async extendSession(token:string,expires:number){await this.db.prepare('UPDATE sessions SET expires=? WHERE token=?').bind(expires,this.hash(token)).run();}
  async deleteSession(token:string){await this.db.prepare('DELETE FROM sessions WHERE token=?').bind(this.hash(token)).run();}
  // 登录失败阈值：15 分钟内 5 次错误就触发封禁。
  private static readonly LOGIN_FAILURE_THRESHOLD=5;
  private static readonly LOGIN_BLOCK_MAX_LEVEL=3;
  private static readonly LOGIN_BLOCK_BASE_MS=15*60*1000;
  private async count(key:string,window:number){const row=await this.db.prepare('SELECT count,started FROM auth_limits WHERE key=?').bind(key).first<{count:number;started:number}>();return row&&row.started>Date.now()-window?row.count:0;}
  private async increment(key:string,window:number){
    const now=Date.now();
    const row=await this.db.prepare('INSERT INTO auth_limits(key,count,started) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN started>? THEN count+1 ELSE 1 END,started=CASE WHEN started>? THEN started ELSE excluded.started END RETURNING count').bind(key,now,now-window,now-window).first<{count:number}>();
    return row!.count;
  }
  // 封禁行即使已过期也要读出来：过期后 level 还得留着，下次再触发才能升级到更长的封禁（15 → 30 → 60 分钟）。
  private async blockRow(client:string){const row=await this.db.prepare('SELECT count,started FROM auth_limits WHERE key=?').bind(`block:${client}`).first<{count:number;started:number}>();return row?{level:Number(row.count),until:Number(row.started)}:null;}
  private async setBlock(client:string,level:number,until:number){await this.db.prepare('INSERT INTO auth_limits(key,count,started) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,started=excluded.started').bind(`block:${client}`,level,until).run();}
  async loginBlocked(client='local'){const row=await this.blockRow(client);return (!!row&&row.until>Date.now())||await this.count(`failure:${client}`,15*60*1000)>=CloudStore.LOGIN_FAILURE_THRESHOLD;}
  // 升级放在记失败这一步（理由同本地 store）：auth 入口先查 loginBlocked，若只在
  // reserveLoginVerification 里升级，达到阈值后的请求根本走不到那儿，渐进封禁永远停在 15 分钟。
  async recordLoginFailure(client='local'){
    await this.increment(`failure:${client}`,15*60*1000);
    if(await this.count(`failure:${client}`,15*60*1000)>=CloudStore.LOGIN_FAILURE_THRESHOLD)await this.escalateBlock(client);
  }
  private async escalateBlock(client:string){
    const level=Math.min(CloudStore.LOGIN_BLOCK_MAX_LEVEL,((await this.blockRow(client))?.level??0)+1);
    await this.setBlock(client,level,Date.now()+CloudStore.LOGIN_BLOCK_BASE_MS*Math.pow(2,level-1));
  }
  async clearLoginFailures(client='local'){await this.db.prepare('DELETE FROM auth_limits WHERE key=? OR key=?').bind(`failure:${client}`,`block:${client}`).run();}
  // 过期行清理。普通限流行 15 分钟后删；封禁行留 24 小时 —— 上面存着渐进封禁档位，删早了升级就失效。
  private async cleanupLimits(){
    await this.db.batch([
      this.db.prepare("DELETE FROM auth_limits WHERE started<=? AND key NOT LIKE 'block:%'").bind(Date.now()-15*60*1000),
      this.db.prepare("DELETE FROM auth_limits WHERE started<=? AND key LIKE 'block:%'").bind(Date.now()-24*60*60*1000)
    ]);
  }
  async takeLoginAttempt(client='local'){
    await this.cleanupLimits();
    return await this.increment(`attempt:${client}`,60000)<=30;
  }
  // 预留校验名额：先判封禁，再记一次失败（这一步可能顺手把封禁升级）；被封了就返回 false。
  async reserveLoginVerification(client='local'){
    if(await this.loginBlocked(client))return false;
    await this.recordLoginFailure(client);
    return !(await this.loginBlocked(client));
  }
  async takeLikeAttempt(client='local'){return await this.increment(`like:${client}`,60000)<=60;}
  async takeStatisticsAttempt(client='local'){
    await this.cleanupLimits();
    return await this.increment(`stats:${client}`,60000)<=60;
  }
}
