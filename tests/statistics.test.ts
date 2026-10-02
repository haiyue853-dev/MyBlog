import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {getStore,Store} from '../src/lib/store';
import {GET as handler} from '../src/app/api/[...path]/route';

const directory=mkdtempSync(join(tmpdir(),'world-statistics-'));
process.env.DATA_DIR=directory;process.env.APP_URL='https://world.test';
const store=getStore();
const publicItem=store.saveItem({kind:'collection',title:'公开收藏',body:'',tags:['照片','收藏'],category:'影像',url:'',assetId:null,visibility:'public'});
store.saveItem({...publicItem,id:undefined,kind:'moment',title:'公开日常',tags:['日常'],category:'生活'});
const secret=store.saveItem({...publicItem,id:undefined,title:'不公开',tags:['秘密标签'],category:'秘密分类',visibility:'private'});
store.addDailyLike(publicItem.id,'public-visitor','2026-10-02',false);
store.addDailyLike(secret.id,'private-visitor','2026-10-02',true);
after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
async function request(path='stats',method='GET',cookie='',body?:unknown,origin='https://world.test'){
  return handler(new Request('https://world.test/api/'+path,{method,headers:{origin,cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),{params:Promise.resolve({path:path.split('/').filter(Boolean)})});
}
async function visitor(){const response=await request('likes');return response.headers.get('set-cookie')!.split(';')[0];}

test('statistics count real public visits and distinct browsers, with persistent idempotence',async()=>{
  assert.equal((await request()).status,200);
  const first=await visitor();const second=await visitor();const eventId=randomUUID();
  const one=await request('stats','POST',first,{view:'about',eventId});assert.equal(one.status,200);
  const firstData=await one.json();assert.equal(firstData.recorded,true);assert.equal(firstData.stats.totalViews,1);assert.equal(firstData.stats.totalVisitors,1);
  const duplicate=await (await request('stats','POST',first,{view:'about',eventId})).json();assert.equal(duplicate.recorded,false);assert.equal(duplicate.stats.totalViews,1);
  const concurrent=await Promise.all(Array.from({length:12},()=>request('stats','POST',second,{view:'stats',eventId:randomUUID()})));
  for(const response of concurrent)assert.equal(response.status,200);
  const read=(await (await request()).json()).stats;assert.equal(read.totalViews,13);assert.equal(read.totalVisitors,2);assert.equal(read.todayVisitors,2);assert.equal(read.todayViews,13);
  assert.deepEqual(read.content,{moments:1,collections:1,categories:2,tags:3,likes:1});
  assert.equal(read.history.at(-1).views,13);
  const identity=createHash('sha256').update(first.split('=')[1]).digest('hex');
  const nextDay=new Date(Date.parse(firstData.stats.day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  assert.equal(store.recordVisit(randomUUID(),identity,nextDay),true);
  const tomorrow=store.getStatistics(nextDay);assert.equal(tomorrow.totalViews,14);assert.equal(tomorrow.totalVisitors,2);assert.equal(tomorrow.todayVisitors,1);
  assert.equal(store.recordVisit(randomUUID(),identity,firstData.stats.day),true,'A delayed prior-day visit cannot create a second daily visitor');
  assert.equal(store.getStatistics(firstData.stats.day).todayVisitors,2);
  const reopened=new Store(directory);try{assert.equal(reopened.getStatistics(nextDay).totalViews,15);}finally{reopened.close();}
});

test('statistics reject cross-origin writes, missing identities and private/arbitrary view names',async()=>{
  const cookie=await visitor();
  assert.equal((await request('stats','POST',cookie,{view:'home',eventId:randomUUID()},'https://invalid.example')).status,403);
  assert.equal((await request('stats','POST','',{view:'home',eventId:randomUUID()})).status,400);
  for(const view of ['files','iris','settings','https://external.example','invalid'])assert.equal((await request('stats','POST',cookie,{view,eventId:randomUUID()})).status,400);
  assert.equal((await request('stats','POST',cookie,{view:'home',eventId:'invalid'})).status,400);
  assert.equal((await request('stats','DELETE')).status,405);
  assert.equal((await request('stats/extra')).status,404);
});

test('daily visitor/event retention keeps cumulative statistics intact',()=>{
  const separate=new Store(join(directory,'retention'));
  try{
    separate.recordVisit(randomUUID(),'same-browser','2026-08-01');
    separate.recordVisit(randomUUID(),'same-browser','2026-10-02');
    const stats=separate.getStatistics('2026-10-02');assert.equal(stats.totalViews,2);assert.equal(stats.totalVisitors,1);assert.equal(stats.todayVisitors,1);
    assert.equal(separate.db.prepare('SELECT COUNT(*) AS n FROM site_stats_events').get()!.n,1);
    assert.equal(separate.db.prepare('SELECT COUNT(*) AS n FROM site_stats_daily_visitors').get()!.n,1);
  }finally{separate.close();}
});

test('statistics limit writes without limiting normal read-only access',async()=>{
  const cookie=await visitor();
  for(let index=0;index<61;index++)await request('stats','POST',cookie,{view:'home',eventId:randomUUID()});
  assert.equal((await request('stats','POST',cookie,{view:'home',eventId:randomUUID()})).status,429);
  assert.equal((await request()).status,200);
});
