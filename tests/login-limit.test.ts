import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';

test('failed logins block only that client, survive restart, and expire',()=>{
  const directory=mkdtempSync(join(tmpdir(),'world-limits-'));
  let store=new Store(directory);
  try{
    for(let i=0;i<10;i++)store.recordLoginFailure('192.0.2.1');
    assert.equal(store.loginBlocked('192.0.2.1'),true);
    assert.equal(store.loginBlocked('192.0.2.2'),false);
    store.close();store=new Store(directory);
    assert.equal(store.loginBlocked('192.0.2.1'),true);
    store.recordLoginFailure('192.0.2.2');store.clearLoginFailures('192.0.2.2');
    assert.equal(store.loginBlocked('192.0.2.1'),true);
    store.db.prepare('UPDATE auth_limits SET started=?').run(Date.now()-16*60*1000);
    assert.equal(store.loginBlocked('192.0.2.1'),false);
    store.recordLoginFailure('192.0.2.1');
    assert.equal(store.loginBlocked('192.0.2.1'),false);
  }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

// 这条是回归：渐进封禁曾经是死代码 —— 两个原因叠在一起，① 封禁行过期后 blockRow 返回 null，
// 档位被重置成 1；② 限流行的清理会把过期的封禁行一起删掉，档位同样丢失。结果每次都只封 15 分钟。
test('repeat offenders get progressively longer bans (15 → 30 → 60 minutes)',()=>{
  const directory=mkdtempSync(join(tmpdir(),'world-escalate-'));const store=new Store(directory);
  const client='192.0.2.9';
  const ban=()=>{
    const row=store.db.prepare('SELECT count,started FROM auth_limits WHERE key=?').get(`block:${client}`) as {count:number;started:number}|undefined;
    return row?{level:row.count,ms:row.started-Date.now()}:null;
  };
  // 把封禁行和失败行一起拨回 16 分钟前：两者都过期，但封禁行必须还留着（24 小时保留期）以保住档位。
  const expire=()=>store.db.prepare('UPDATE auth_limits SET started=? WHERE key=? OR key=?').run(Date.now()-16*60*1000,`block:${client}`,`failure:${client}`);
  const trip=()=>{for(let i=0;i<4;i++)assert.equal(store.reserveLoginVerification(client),true);assert.equal(store.reserveLoginVerification(client),false,'5th failure trips the block');};
  try{
    trip();let current=ban();assert.ok(current);assert.equal(current!.level,1);
    assert.ok(current!.ms>14*60*1000&&current!.ms<=15*60*1000,`first ban should be ~15min, got ${current!.ms}`);
    expire();assert.equal(store.loginBlocked(client),false,'expired ban must not block');
    trip();current=ban();assert.equal(current!.level,2,'second round escalates to level 2');
    assert.ok(current!.ms>29*60*1000&&current!.ms<=30*60*1000,`second ban should be ~30min, got ${current!.ms}`);
    expire();
    trip();current=ban();assert.equal(current!.level,3,'third round escalates to level 3');
    assert.ok(current!.ms>59*60*1000&&current!.ms<=60*60*1000,`third ban should be ~60min, got ${current!.ms}`);
    expire();
    trip();assert.equal(ban()!.level,3,'level stays capped at 3');
    // 登录成功要把封禁档位一起清掉，别让老实人背着历史档位。
    store.clearLoginFailures(client);
    assert.equal(ban(),null,'success clears the escalation level too');
    assert.equal(store.loginBlocked(client),false);
  }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

test('login bursts are bounded before password hashing and recover after one minute',()=>{
  const directory=mkdtempSync(join(tmpdir(),'world-limits-'));const store=new Store(directory);
  try{
    for(let i=0;i<30;i++)assert.equal(store.takeLoginAttempt('192.0.2.1'),true);
    assert.equal(store.takeLoginAttempt('192.0.2.1'),false);
    assert.equal(store.takeLoginAttempt('192.0.2.2'),true);
    store.db.prepare('UPDATE auth_limits SET started=?').run(Date.now()-61*1000);
    assert.equal(store.takeLoginAttempt('192.0.2.1'),true);
  }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
