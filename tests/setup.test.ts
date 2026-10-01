// 首次建站（第一个站主账号）的服务端契约。
// 单独一个文件、单独一个空 DATA_DIR —— api.test.ts 在模块加载时就已经把站主建好了，
// 那边的分支只剩「已经建过」，没法验「第一次建」。
// node 的测试运行器会给每个测试文件开一个独立进程，所以这里的 store 是干净的。
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getStore} from '../src/lib/store';
import {MIN_PASSWORD_LENGTH} from '../src/lib/types';
import {GET as handler} from '../src/app/api/[...path]/route';

const directory=mkdtempSync(join(tmpdir(),'world-setup-'));process.env.DATA_DIR=directory;process.env.APP_URL='http://localhost:3000';
const store=getStore();
after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
async function request(path:string,method='GET',body?:unknown,cookie='',origin:string|null='http://localhost:3000'){
  const headers:Record<string,string>={};if(cookie)headers.cookie=cookie;if(origin)headers.origin=origin;if(body)headers['content-type']='application/json';
  return handler(new Request(`http://localhost:3000/api/${path}`,{method,headers,body:body?JSON.stringify(body):undefined}),{params:Promise.resolve({path:path.split('/')})});
}
const PASSWORD='setup-test-password-2026';

test('a fresh install reports itself as unconfigured',async()=>{
  assert.equal(store.getOwner(),null);
  const response=await request('auth');assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{owner:false,configured:false});
});

test('setup refuses cross-origin, short and oversized passwords without creating an owner',async()=>{
  assert.equal((await request('auth/setup','POST',{password:PASSWORD},'','http://bad.example')).status,403);
  assert.equal((await request('auth/setup','POST',{password:'x'.repeat(MIN_PASSWORD_LENGTH-1)})).status,400);
  assert.equal((await request('auth/setup','POST',{password:'x'.repeat(257)})).status,400);
  assert.equal(store.getOwner(),null,'被拒绝的请求不该留下站主账号');
});

test('the first successful setup creates the owner and hands back a session',async()=>{
  const response=await request('auth/setup','POST',{name:'  小屋站主  ',password:PASSWORD});
  assert.equal(response.status,201);
  assert.deepEqual(await response.json(),{owner:true});
  const header=response.headers.get('set-cookie')||'';
  assert.ok(header.includes('HttpOnly')&&header.includes('SameSite=Lax'),'会话 cookie 应当是 HttpOnly + SameSite=Lax');
  const cookie=header.split(';')[0];
  // 建完直接就能用，不用再输一遍密码。
  assert.ok(store.hasSession(cookie.slice('world-session='.length)));
  assert.equal(store.getOwner()?.name,'小屋站主','昵称应当去掉首尾空格');
  const current=await request('auth','GET',undefined,cookie);assert.equal(current.status,200);
  assert.deepEqual(await current.json(),{owner:true,configured:true});
});

test('setup is sealed once an owner exists — no second account, ever',async()=>{
  assert.equal((await request('auth/setup','POST',{password:'another-owner-password-2026'})).status,409);
  assert.equal(store.getOwner()?.name,'小屋站主','重复建站不该改掉已有站主');
  const response=await request('auth');assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{owner:false,configured:true});
});

test('the password just set is the one login accepts',async()=>{
  assert.equal((await request('auth/login','POST',{password:'not-the-password-2026'})).status,401);
  const response=await request('auth/login','POST',{password:PASSWORD});assert.equal(response.status,200);
  const cookie=(response.headers.get('set-cookie')||'').split(';')[0];
  assert.ok(store.hasSession(cookie.slice('world-session='.length)));
});

test('a blank name falls back to 小屋站主, and the length limit is exact',async()=>{
  // 只有一次建站机会，想再验一遍「留空昵称」就得先把库退回原始状态。
  // 这里直接用 store.db 抹掉 owner 行 —— 是测试专用后门，业务代码里没有删站主这条路。
  store.db.exec('DELETE FROM owner');
  assert.equal(store.getOwner(),null);
  assert.equal((await request('auth/setup','POST',{name:'',password:'x'.repeat(MIN_PASSWORD_LENGTH-1)})).status,400,'差一位就该被挡下');
  const response=await request('auth/setup','POST',{name:'   ',password:'x'.repeat(MIN_PASSWORD_LENGTH)});
  assert.equal(response.status,201,'刚好够长就该通过');
  assert.equal(store.getOwner()?.name,'小屋站主','名字留空落回默认昵称');
});
