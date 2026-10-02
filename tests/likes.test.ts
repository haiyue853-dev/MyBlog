import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {getStore,Store} from '../src/lib/store';
import {GET as handler} from '../src/app/api/[...path]/route';
import {beijingDay} from '../src/lib/api/likes';

const directory=mkdtempSync(join(tmpdir(),'world-likes-'));
process.env.DATA_DIR=directory;process.env.APP_URL='https://world.test';
const store=getStore();
const item=store.saveItem({kind:'collection',title:'收藏',body:'',tags:[],category:'',url:'',assetId:null,visibility:'public'});
const privateItem=store.saveItem({...item,id:undefined,title:'私人',visibility:'private'});
after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
async function request(path:string,method='GET',cookie='',origin='https://world.test'){
  return handler(new Request(`https://world.test/api/${path}`,{method,headers:{origin,cookie}}),{params:Promise.resolve({path:path.split('?')[0].split('/')})});
}
async function visitor(){
  const response=await request(`likes?ids=${item.id}`);assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie')||'';
  assert.ok(cookie.includes('HttpOnly')&&cookie.includes('SameSite=Lax')&&cookie.includes('Secure'));
  return cookie.split(';')[0];
}

test('each visitor gets one persistent like per card per Beijing day',async()=>{
  const first=await visitor();const second=await visitor();assert.notEqual(first,second);
  const clicked=await request(`likes/${item.id}`,'POST',first);assert.equal(clicked.status,200);
  const data=await clicked.json();assert.equal(data.like.count,1);assert.equal(data.like.liked,true);assert.equal(data.added,true);
  const duplicate=await (await request(`likes/${item.id}`,'POST',first)).json();
  assert.equal(duplicate.added,false);assert.equal(duplicate.like.count,1);
  const parallel=await Promise.all(Array.from({length:12},()=>request(`likes/${item.id}`,'POST',second)));
  const values=await Promise.all(parallel.map(response=>response.json()));
  assert.equal(values.filter(value=>value.added).length,1);
  const state=await (await request(`likes?ids=${item.id}`,'GET',first)).json();
  assert.equal(state.likes[item.id].count,2);assert.equal(state.likes[item.id].liked,true);
  const nextDay=new Date(new Date(data.day+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);
  const visitorHash=store.db.prepare('SELECT visitor FROM item_like_visits LIMIT 1').get()!.visitor as string;
  assert.equal(store.addDailyLike(item.id,visitorHash,nextDay,false),true);
  assert.equal(store.addDailyLike(item.id,visitorHash,nextDay,false),false);
  assert.equal(store.addDailyLike(item.id,visitorHash,data.day,false),false,'late requests cannot roll the day back');
  const reopened=new Store(directory);
  try{assert.equal(reopened.getLikes([item.id],visitorHash,nextDay,false)[item.id].count,3);}
  finally{reopened.close();}
});

test('daily likes reset at midnight Beijing time, not UTC midnight',()=>{
  assert.equal(beijingDay(Date.parse('2026-10-02T15:59:59Z')),'2026-10-02');
  assert.equal(beijingDay(Date.parse('2026-10-02T16:00:00Z')),'2026-10-03');
});

test('daily like requests have a bounded per-origin-client write rate',async()=>{
  const cookie=await visitor();
  try{
    for(let index=0;index<65;index++)await request(`likes/${item.id}`,'POST',cookie);
    assert.equal((await request(`likes/${item.id}`,'POST',cookie)).status,429);
  }finally{store.db.prepare("DELETE FROM auth_limits WHERE key='like:local'").run();}
});

test('likes respect visibility, reject cross-origin, and never create identities on POST',async()=>{
  const cookie=await visitor();
  assert.equal((await request(`likes/${item.id}`,'POST',cookie,'https://evil.test')).status,403);
  assert.equal((await request(`likes/${item.id}`,'POST')).status,400);
  assert.equal((await request(`likes/${privateItem.id}`,'POST',cookie)).status,404);
  const state=await (await request(`likes?ids=${privateItem.id}`,'GET',cookie)).json();
  assert.deepEqual(state.likes,{});
  store.createSession('f'.repeat(64),Date.now()+60000);
  const ownerCookie=cookie+'; world-session='+'f'.repeat(64);
  assert.equal((await request(`likes/${privateItem.id}`,'POST',ownerCookie)).status,200);
  assert.equal((await request('likes/invalid','POST',cookie)).status,404);
  assert.equal((await request(`likes/${item.id}`,'DELETE',cookie)).status,405);
  store.deleteItem(privateItem.id);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM item_like_counts WHERE item_id=?').get(privateItem.id)!.n,0);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM item_like_visits WHERE item_id=?').get(privateItem.id)!.n,0);
});
