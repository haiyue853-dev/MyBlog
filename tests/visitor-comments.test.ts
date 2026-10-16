import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {handleErrors,newToken,isOwner} from '../src/lib/http';
const visitors=await import('../src/lib/api/visitor').catch(()=>null);
const comments=await import('../src/lib/api/comments').catch(()=>null);
const config={summary:'',kicker:'',series:'',spoiler:false,coverPosition:'center' as const,facts:[],quote:''};
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-comments-'));const store=new Store(directory);
  const owner=newToken();store.createSession(owner,Date.now()+60000);const guest=newToken();const other=newToken();
  const item=store.saveItem({kind:'moment',title:'文章',body:'正文',category:'日常',tags:[],visibility:'public',assetId:null,url:'',article:config});
  async function call(path:string,method='GET',body?:unknown,cookie=`world-visitor=${guest}`,origin='http://localhost:3000'){
    assert.ok(visitors&&comments,'访客与评论 API 尚未实现');
    const request=new Request(`http://localhost:3000/api/${path}`,{method,headers:{cookie,origin},body:body===undefined?undefined:JSON.stringify(body)});
    return withRuntime(store,{appUrl:'http://localhost:3000'},()=>handleErrors(()=>path==='visitor'?visitors.visitorApi(request):comments.commentsApi(request,path.split('?')[0].split('/'))));
  }
  return {directory,store,item,owner,guest,other,call,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}
test('a nickname is remembered without credentials and grants no owner access',async()=>{
  const f=fixture();try{
    const signup=await f.call('visitor','POST',{name:'晴天'},'');assert.equal(signup.status,200);
    const cookie=signup.headers.get('set-cookie')!;assert.match(cookie,/world-visitor=[a-f0-9]{64}; HttpOnly/);
    assert.deepEqual(await signup.json(),{visitor:{name:'晴天'}});
    assert.deepEqual(await (await f.call('visitor','GET',undefined,cookie.split(';')[0])).json(),{visitor:{name:'晴天'}});
    assert.equal(await withRuntime(f.store,{},()=>isOwner(new Request('http://localhost:3000',{headers:{cookie}}))),false);
  }finally{f.close();}
});
test('public article comments persist with signed names; changing a name preserves historical signatures',async()=>{
  const f=fixture();try{
    await f.call('visitor','POST',{name:'晴天'});const created=await f.call(`comments/${f.item.id}`,'POST',{body:'喜欢这篇文章。'});assert.equal(created.status,201);
    const row=(await created.json()).comment;assert.equal(row.name,'晴天');assert.equal(row.owner,false);assert.equal(row.canDelete,true);assert.ok(!('visitor' in row));
    await f.call('visitor','POST',{name:'小雨'});
    const listed=await (await f.call(`comments/${f.item.id}`,'GET',undefined,`world-visitor=${f.other}`)).json();assert.equal(listed.comments[0].name,'晴天');assert.equal(listed.comments[0].canDelete,false);
    const reopened=new Store(f.directory);try{assert.equal(reopened.listComments(f.item.id,1)[0].body,'喜欢这篇文章。');}finally{reopened.close();}
    const ownerRow=(await (await f.call(`comments/${f.item.id}`,'POST',{body:'谢谢你。'},`world-session=${f.owner}`)).json()).comment;assert.equal(ownerRow.owner,true);
  }finally{f.close();}
});
test('private and draft articles hide all comments; collections and daily records cannot receive article comments',async()=>{
  const f=fixture();try{
    await f.call('visitor','POST',{name:'晴天'});await f.call(`comments/${f.item.id}`,'POST',{body:'留言'});
    for(const change of [{visibility:'private' as const},{visibility:'public' as const,status:'draft' as const},{status:'published' as const,article:null}]){
      f.store.saveItem({...f.store.getItem(f.item.id)!,...change});
      assert.equal((await f.call(`comments/${f.item.id}`)).status,404);assert.equal((await f.call(`comments/${f.item.id}`,'POST',{body:'新留言'})).status,404);
    }
    const collection=f.store.saveItem({...f.item,id:randomUUID(),kind:'collection',article:null});assert.equal((await f.call(`comments/${collection.id}`)).status,404);
  }finally{f.close();}
});
test('comments enforce origin, nickname and content limits and do not trust forged author fields',async()=>{
  const f=fixture();try{
    assert.equal((await f.call('visitor','POST',{name:'晴天'},undefined,'https://evil.test')).status,403);
    for(const name of ['', 'a'.repeat(25), '\n\u0000'])assert.equal((await f.call('visitor','POST',{name})).status,400);
    assert.equal((await f.call(`comments/${f.item.id}`,'POST',{body:'留言'})).status,401);
    await f.call('visitor','POST',{name:'站主'});
    for(const body of ['', 'a'.repeat(2001)])assert.equal((await f.call(`comments/${f.item.id}`,'POST',{body})).status,400);
    assert.equal((await f.call(`comments/${f.item.id}`,'POST',{body:'留言',owner:true,name:'伪造名字'})).status,400);
    assert.equal((await f.call(`comments/${f.item.id}`,'POST',{body:'留言'},undefined,'https://evil.test')).status,403);
    assert.equal((await (await f.call(`comments/${f.item.id}`,'POST',{body:'只是昵称相同'})).json()).comment.owner,false);
  }finally{f.close();}
});
test('only the author or actual owner may delete a comment, including when an article becomes private',async()=>{
  const f=fixture();try{
    await f.call('visitor','POST',{name:'晴天'});
    const comment=(await (await f.call(`comments/${f.item.id}`,'POST',{body:'留言'})).json()).comment;
    const path=`comments/${f.item.id}/${comment.id}`;
    assert.equal((await f.call(path,'DELETE',undefined,`world-visitor=${f.other}`)).status,403);
    assert.equal((await f.call(path,'DELETE')).status,200);
    const another=(await (await f.call(`comments/${f.item.id}`,'POST',{body:'另一条'})).json()).comment;
    f.store.saveItem({...f.item,visibility:'private'});
    assert.equal((await f.call(`comments/${f.item.id}`,'GET',undefined,`world-session=${f.owner}`)).status,200);
    assert.equal((await f.call(`comments/${f.item.id}/${another.id}`,'DELETE',undefined,`world-session=${f.owner}`)).status,200);
  }finally{f.close();}
});
test('rapid posting is limited and does not insert the rejected comment',async()=>{
  const f=fixture();try{
    await f.call('visitor','POST',{name:'晴天'});
    for(let index=0;index<5;index++)assert.equal((await f.call(`comments/${f.item.id}`,'POST',{body:`留言${index}`})).status,201);
    assert.equal((await f.call(`comments/${f.item.id}`,'POST',{body:'太快了'})).status,429);assert.equal(f.store.listComments(f.item.id,1).length,5);
  }finally{f.close();}
});
test('comment pagination is bounded and deleting an article removes its comments',async()=>{
  const f=fixture();try{
    assert.ok(comments,'评论尚未实现');
    for(let index=0;index<25;index++)f.store.addComment({itemId:f.item.id,visitor:f.guest,name:'晴天',body:`留言${index}`,owner:false});
    const first=await (await f.call(`comments/${f.item.id}?page=1`)).json();const second=await (await f.call(`comments/${f.item.id}?page=2`)).json();
    assert.equal(first.comments.length,20);assert.equal(first.hasMore,true);assert.equal(second.comments.length,5);assert.equal(new Set([...first.comments,...second.comments].map(row=>row.id)).size,25);
    assert.equal((await f.call(`comments/${f.item.id}?page=-1`)).status,400);
    f.store.deleteItem(f.item.id);assert.equal(f.store.listComments(f.item.id,1).length,0);
  }finally{f.close();}
});
