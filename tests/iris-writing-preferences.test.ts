import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {Store} from '../src/lib/store';import {CloudStore} from '../cloudflare/store';import {withRuntime} from '../src/lib/runtime';import {irisApi} from '../src/lib/api/iris';import {handleErrors,newToken} from '../src/lib/http';
import {defaultWritingPreferences,parseWritingPreferences,writingPreferencePrompt} from '../src/lib/iris-writing-preferences';import {IrisWritingPreferences} from '../src/components/iris-writing-preferences';
import type {D1Database,R2Bucket} from '@cloudflare/workers-types';
test('neutral defaults are independent; enums and free text are bounded',()=>{
 const defaults=defaultWritingPreferences();assert.equal(defaults.article.tone,'original');assert.equal(defaults.moment.length,'auto');assert.notEqual(defaults.article,defaults.moment);assert.deepEqual(parseWritingPreferences(defaults),defaults);
 for(const bad of [null,[],{article:defaults.article},{...defaults,moment:{...defaults.moment,tone:'other'}},{...defaults,article:{...defaults.article,instructions:'x'.repeat(501)}},{...defaults,article:{...defaults.article,instructions:3}},{...defaults,article:{...defaults.article,headings:'bad'}}])assert.throws(()=>parseWritingPreferences(bad));
 const style={...defaults.article,tone:'casual' as const,length:'short' as const,title:'brief' as const,headings:'no' as const,instructions:'少用套话。'};const prompt=writingPreferencePrompt(style);assert.match(prompt,/口语/);assert.match(prompt,/简短/);assert.match(prompt,/少用套话/);assert.match(prompt,/本次具体要求优先/);assert.match(prompt,/不编造/);
});
test('private preferences reject guests, origin and invalid writes without touching public data; both stores persist',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'iris-preferences-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);const origin='http://localhost:3000';
 const call=(method='GET',body?:unknown,owner=true,source=origin)=>withRuntime(store,{appUrl:origin},()=>handleErrors(()=>irisApi(new Request(`${origin}/api/iris/blog/preferences`,{method,headers:{origin:source,...(owner?{cookie:`world-session=${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)}),['iris','blog','preferences'])));
 try{
  assert.equal((await call('GET',undefined,false)).status,401);assert.equal((await call('PUT',defaultWritingPreferences(),false)).status,401);assert.equal((await call('PUT',defaultWritingPreferences(),true,'https://evil.test')).status,403);
  const prefs=defaultWritingPreferences();prefs.article.tone='casual';prefs.article.instructions='保留我的碎碎念。';prefs.moment.title='brief';assert.equal((await call('PUT',prefs)).status,200);assert.deepEqual((await (await call()).json()).preferences,prefs);
  const another=new Store(directory);assert.deepEqual(another.getIrisWritingPreferences(),prefs);another.close();
  assert.equal((await call('PUT',{...prefs,article:{...prefs.article,length:'invalid'}})).status,400);assert.deepEqual(store.getIrisWritingPreferences(),prefs);assert.equal((await call('POST',prefs)).status,405);
  assert.ok(!JSON.stringify(store.getProfile()).includes('碎碎念'));assert.equal(store.listItems(true).length,0);
  const database={prepare(sql:string){let args:unknown[]=[];const statement={bind(...values:unknown[]){args=values;return statement;},async first(){return store.db.prepare(sql).get(...args as [])||null;},async run(){store.db.prepare(sql).run(...args as []);return {success:true,meta:{changes:1}};}};return statement;}} as unknown as D1Database;
  const cloud=new CloudStore(database,{} as R2Bucket);assert.deepEqual(await cloud.getIrisWritingPreferences(),prefs);prefs.moment.instructions='日常专用偏好';await cloud.saveIrisWritingPreferences(prefs);assert.deepEqual(store.getIrisWritingPreferences(),prefs);assert.ok(!JSON.stringify(await cloud.getProfile()).includes('日常专用偏好'));
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test('Iris preference form exposes separate article and moment controls and an explicit save',()=>{
 const html=renderToStaticMarkup(createElement(IrisWritingPreferences));assert.match(html,/我的写作偏好/);assert.match(html,/文章语气/);assert.match(html,/日常语气/);assert.match(html,/文章补充要求/);assert.match(html,/日常补充要求/);assert.match(html,/保存写作偏好/);assert.match(html,/保存后/);
});
