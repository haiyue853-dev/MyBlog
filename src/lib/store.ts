import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DEFAULT_PROFILE,type Asset,type Item,type ItemInput,type Profile} from './types';

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
      CREATE TABLE IF NOT EXISTS login_attempts(id INTEGER PRIMARY KEY CHECK(id=1),count INTEGER NOT NULL,started INTEGER NOT NULL);`);
  }
  close(){this.db.close();}
  listItems(owner:boolean):Item[]{const rows=this.db.prepare(owner?'SELECT data FROM items':'SELECT data FROM items WHERE visibility=\'public\'').all();return rows.map(row=>JSON.parse(String(row.data)) as Item).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  getItem(id:string,owner=true):Item|null{const row=this.db.prepare('SELECT data,visibility FROM items WHERE id=?').get(id);return row&&(owner||row.visibility==='public')?JSON.parse(String(row.data)):null;}
  saveItem(input:ItemInput):Item{const existing=input.id?this.getItem(input.id):null;const item:Item={...input,id:existing?.id||randomUUID(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};this.db.prepare('INSERT INTO items(id,kind,visibility,asset_id,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,visibility=excluded.visibility,asset_id=excluded.asset_id,data=excluded.data').run(item.id,item.kind,item.visibility,item.assetId,JSON.stringify(item));return item;}
  deleteItem(id:string){return this.db.prepare('DELETE FROM items WHERE id=?').run(id).changes>0;}
  addAsset(input:Omit<Asset,'id'|'createdAt'>):Asset{const asset={...input,id:randomUUID(),createdAt:new Date().toISOString()};this.db.prepare('INSERT INTO assets(id,data) VALUES(?,?)').run(asset.id,JSON.stringify(asset));return asset;}
  getAsset(id:string):Asset|null{const row=this.db.prepare('SELECT data FROM assets WHERE id=?').get(id);return row?JSON.parse(String(row.data)):null;}
  listAssets():Asset[]{return this.db.prepare('SELECT data FROM assets').all().map(row=>JSON.parse(String(row.data)) as Asset).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  deleteAsset(id:string){return this.db.prepare('DELETE FROM assets WHERE id=?').run(id).changes>0;}
  isPublicAsset(id:string):boolean{return this.getProfile().avatarId===id||!!this.db.prepare('SELECT id FROM items WHERE asset_id=? AND visibility=\'public\' LIMIT 1').get(id);}
  assetInUse(id:string):boolean{return this.getProfile().avatarId===id||!!this.db.prepare('SELECT id FROM items WHERE asset_id=? LIMIT 1').get(id);}
  getProfile():Profile{const row=this.db.prepare('SELECT data FROM settings WHERE key=\'profile\'').get();return row?{...DEFAULT_PROFILE,...JSON.parse(String(row.data))}:{...DEFAULT_PROFILE};}
  saveProfile(profile:Profile){this.db.prepare('INSERT INTO settings(key,data) VALUES(\'profile\',?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run(JSON.stringify(profile));return profile;}
  getOwner():{name:string;password:string}|null{const row=this.db.prepare('SELECT name,password FROM owner WHERE id=1').get();return row?{name:String(row.name),password:String(row.password)}:null;}
  setOwner(name:string,password:string){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT INTO owner(id,name,password) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,password=excluded.password').run(name,password);this.db.exec('DELETE FROM sessions; COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}}
  private tokenHash(token:string){return createHash('sha256').update(token).digest('hex');}
  createSession(token:string,expires:number){this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());this.db.prepare('INSERT INTO sessions(token,expires) VALUES(?,?)').run(this.tokenHash(token),expires);}
  hasSession(token:string):boolean{return !!this.db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(this.tokenHash(token),Date.now());}
  deleteSession(token:string){this.db.prepare('DELETE FROM sessions WHERE token=?').run(this.tokenHash(token));}
  loginBlocked():boolean{const row=this.db.prepare('SELECT count,started FROM login_attempts WHERE id=1').get();return !!row&&Number(row.count)>=10&&Number(row.started)>Date.now()-15*60*1000;}
  recordLoginFailure(){const row=this.db.prepare('SELECT count,started FROM login_attempts WHERE id=1').get();const recent=row&&Number(row.started)>Date.now()-15*60*1000;this.db.prepare('INSERT INTO login_attempts(id,count,started) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET count=excluded.count,started=excluded.started').run(recent?Number(row.count)+1:1,recent?Number(row.started):Date.now());}
  clearLoginFailures(){this.db.exec('DELETE FROM login_attempts');}
}
const globalStore=globalThis as typeof globalThis&{littleWorldStore?:Store};
export function getStore(){return globalStore.littleWorldStore??=(new Store(process.env.DATA_DIR||join(process.cwd(),'data')));}
