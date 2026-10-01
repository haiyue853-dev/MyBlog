// 会话寿命与续期。用户的要求是「总不能我每次进去都要重新登录吧」——
// 所以这里锁两件事：登录发的会话要活得够久，以及站主在用站点时会被自动续期。
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getStore} from '../src/lib/store';
import {hashPassword} from '../src/lib/security';
import {SESSION_MAX_AGE} from '../src/lib/http';
import {GET as handler} from '../src/app/api/[...path]/route';

const directory=mkdtempSync(join(tmpdir(),'world-session-'));process.env.DATA_DIR=directory;process.env.APP_URL='http://localhost:3000';
const store=getStore();store.setOwner('测试站主',hashPassword('session-test-password'));
after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
async function request(path:string,method='GET',body?:unknown,cookie=''){
  const headers:Record<string,string>={origin:'http://localhost:3000'};
  if(cookie)headers.cookie=cookie;
  if(body)headers['content-type']='application/json';
  return handler(new Request(`http://localhost:3000/api/${path}`,{method,headers,body:body?JSON.stringify(body):undefined}),{params:Promise.resolve({path:path.split('/')})});
}
const cookieMaxAge=(response:Response)=>{
  const header=response.headers.get('set-cookie')||'';
  const match=/Max-Age=(\d+)/.exec(header);
  return match?Number(match[1]):null;
};

let cookie='';let token='';
test('signing in issues a session that lasts for months, not days',async()=>{
  const response=await request('auth/login','POST',{password:'session-test-password'});
  assert.equal(response.status,200);
  const header=response.headers.get('set-cookie')||'';
  assert.equal(cookieMaxAge(response),SESSION_MAX_AGE);
  assert.ok(SESSION_MAX_AGE>=180*24*60*60,'会话至少要有半年，否则又变成「每进一次都要重新登录」');
  cookie=header.split(';')[0];token=cookie.slice('world-session='.length);
  const remaining=store.sessionExpires(token)!-Date.now();
  assert.ok(Math.abs(remaining-SESSION_MAX_AGE*1000)<5000,'数据库里的到期时间要和 cookie 对得上');
});

test('a fresh session is left alone — no Set-Cookie on every request',async()=>{
  const response=await request('auth','GET',undefined,cookie);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('set-cookie'),null,'刚登录不该被反复续期');
});

test('a session past its halfway point gets renewed on the next request',async()=>{
  // 手动把到期时间压到只剩 1 分钟，模拟「用了很久、快过期了」。
  store.extendSession(token,Date.now()+60*1000);
  const response=await request('items','GET',undefined,cookie);
  assert.equal(response.status,200);
  assert.equal(cookieMaxAge(response),SESSION_MAX_AGE,'应当重发一次完整寿命的 cookie');
  const remaining=store.sessionExpires(token)!-Date.now();
  assert.ok(remaining>SESSION_MAX_AGE*1000-60*1000,'数据库里的到期时间也要一起往后推');
});

test('signing out still wins — renewal must not revive a deleted session',async()=>{
  assert.equal(store.sessionExpires(token)!>Date.now(),true);
  const response=await request('auth/logout','POST',undefined,cookie);
  assert.equal(response.status,200);
  assert.equal(store.sessionExpires(token),null,'登出之后会话就该没了');
  assert.equal((await request('items','GET',undefined,cookie)).status,200,'访客依然能看公开内容');
});

test('an expired session is rejected instead of being renewed',async()=>{
  const login=await request('auth/login','POST',{password:'session-test-password'});
  const stale=(login.headers.get('set-cookie')||'').split(';')[0];
  store.extendSession(stale.slice('world-session='.length),Date.now()-1000);
  const response=await request('items','GET',undefined,stale);
  // 过期会话读公开列表仍是 200（访客视角），但不能被当成站主、也不该被续期。
  assert.equal(response.status,200);
  assert.equal(response.headers.get('set-cookie'),null);
  assert.equal(store.sessionExpires(stale.slice('world-session='.length)),null);
  assert.equal((await request('items','POST',{kind:'moment',title:'越权',body:'x',tags:[],category:'生活',url:'',assetId:null,visibility:'public'},stale)).status,401,'过期会话不能写');
});
