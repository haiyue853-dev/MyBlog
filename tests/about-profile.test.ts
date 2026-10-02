import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getStore} from '../src/lib/store';
import {GET as handler} from '../src/app/api/[...path]/route';

const directory=mkdtempSync(join(tmpdir(),'world-about-'));
process.env.DATA_DIR=directory;process.env.APP_URL='https://world.test';const store=getStore();
const token='b'.repeat(64);store.createSession(token,Date.now()+60000);const cookie='world-session='+token;
after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
async function save(body:unknown,auth=cookie,origin='https://world.test'){
  return handler(new Request('https://world.test/api/profile',{method:'PUT',headers:{origin,cookie:auth,'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({path:['profile']})});
}
test('owner can edit about content while old clients preserve the added fields',async()=>{
  const draft={...store.getProfile(),aboutName:'Hai',aboutIntro:'长一点的介绍\n第二段',aboutWish:'记录每个小瞬间',aboutInterests:[{title:'音乐',description:'喜欢听歌'}]};
  const response=await save(draft);assert.equal(response.status,200);const saved=(await response.json()).profile;
  assert.equal(saved.aboutName,'Hai');assert.equal(saved.aboutIntro,draft.aboutIntro);assert.deepEqual(saved.aboutInterests,draft.aboutInterests);assert.equal(saved.aboutWish,draft.aboutWish);
  const legacy={name:saved.name,bio:saved.bio,subtitle:saved.subtitle,avatarId:saved.avatarId,accent:saved.accent};
  const oldClient=await save({...legacy,bio:'修改旧简介'});assert.equal(oldClient.status,200);
  assert.equal(store.getProfile().aboutIntro,draft.aboutIntro);assert.deepEqual(store.getProfile().aboutInterests,draft.aboutInterests);
});
test('about edits retain authentication, same-origin and field limits',async()=>{
  const profile={...store.getProfile(),aboutName:'Hai',aboutIntro:'介绍',aboutInterests:[]};
  assert.equal((await save(profile,'')).status,401);assert.equal((await save(profile,cookie,'https://invalid.example')).status,403);
  assert.equal((await save({...profile,aboutIntro:'x'.repeat(2001)})).status,400);
  assert.equal((await save({...profile,aboutInterests:Array(9).fill({title:'音乐',description:''})})).status,400);
  assert.equal((await save({...profile,aboutInterests:[{title:'',description:'空标题'}]})).status,400);
  assert.equal((await save({...profile,aboutInterests:[{title:'音乐',description:42}]})).status,400);
});
