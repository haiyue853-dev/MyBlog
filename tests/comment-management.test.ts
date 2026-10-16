import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {handleErrors,newToken} from '../src/lib/http';
import {commentsApi} from '../src/lib/api/comments';
const article={summary:'',kicker:'',series:'',spoiler:false,coverPosition:'center' as const,facts:[],quote:''};
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-comment-manager-'));const store=new Store(directory);
  const token=newToken();store.createSession(token,Date.now()+60000);
  const item=store.saveItem({kind:'moment',title:'文章',body:'正文',category:'工作',tags:[],visibility:'public',assetId:null,url:'',article});
  function add(body='留言',owner=false){return store.addComment({itemId:item.id,visitor:owner?'owner':'visitor-hash',name:owner?'站主':'小雨',body,owner})!;}
  async function call(path='comments',method='GET',body?:unknown,cookie=`world-session=${token}`,origin='http://localhost:3000'){
    const request=new Request(`http://localhost:3000/api/${path}`,{method,headers:{cookie,origin},body:body===undefined?undefined:JSON.stringify(body)});
    return withRuntime(store,{appUrl:'http://localhost:3000'},()=>handleErrors(()=>commentsApi(request,path.split('?')[0].split('/'))));
  }
  return {directory,store,item,token,add,call,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}
test('management is owner-only and includes hidden articles without exposing visitor identities',async()=>{
  const f=fixture();try{
    f.add('<script>原样文字</script>');f.add('站主回复',true);
    assert.equal((await f.call('comments','GET',undefined,'')).status,401);
    f.store.saveItem({...f.item,visibility:'private',status:'draft',writingType:'review'});
    const response=await f.call();assert.equal(response.status,200);const data=await response.json();
    assert.equal(data.total,2);assert.equal(data.unread,1);assert.equal(data.comments.length,2);
    const guest=data.comments.find((row:any)=>!row.owner);assert.equal(guest.body,'<script>原样文字</script>');assert.equal(guest.unread,true);
    assert.deepEqual(guest.item,{id:f.item.id,title:'文章',type:'review',visibility:'private',status:'draft'});
    assert.ok(!('visitor' in guest));assert.equal(data.comments.find((row:any)=>row.owner).unread,false);
    f.store.saveItem({...f.item,article:null});assert.equal((await (await f.call()).json()).total,0);
  }finally{f.close();}
});
test('read marks persist, unread filters and counts follow marks and deletion',async()=>{
  const f=fixture();try{
    const one=f.add('第一条');const two=f.add('第二条');const path=`comments/${f.item.id}/${one.id}`;
    assert.equal((await f.call(path,'PATCH',{read:true})).status,200);
    let data=await (await f.call('comments?status=unread')).json();assert.equal(data.total,2);assert.equal(data.unread,1);assert.deepEqual(data.comments.map((r:any)=>r.id),[two.id]);
    const reopened=new Store(f.directory);try{const saved=await withRuntime(reopened,{appUrl:'http://localhost:3000'},()=>handleErrors(()=>commentsApi(new Request('http://localhost:3000/api/comments',{headers:{cookie:`world-session=${f.token}`}}),['comments'])));assert.equal((await saved.json()).unread,1);}finally{reopened.close();}
    assert.equal((await f.call(path,'PATCH',{read:false})).status,200);
    data=await (await f.call()).json();assert.equal(data.unread,2);
    assert.equal((await f.call(path,'PATCH',{read:true})).status,200);
    assert.equal((await f.call(path,'DELETE')).status,200);
    assert.equal(Number(f.store.db.prepare('SELECT COUNT(*) AS count FROM comment_reads').get()!.count),0);
    data=await (await f.call()).json();assert.equal(data.total,1);assert.equal(data.unread,1);
  }finally{f.close();}
});
test('marking read rejects guests, forged fields, foreign origins and mismatched articles',async()=>{
  const f=fixture();try{
    const row=f.add();const path=`comments/${f.item.id}/${row.id}`;
    assert.equal((await f.call(path,'PATCH',{read:true},'')).status,401);
    assert.equal((await f.call(path,'PATCH',{read:true},undefined,'https://evil.test')).status,403);
    for(const body of [{read:'true'},{read:true,owner:true},{}])assert.equal((await f.call(path,'PATCH',body)).status,400);
    assert.equal((await f.call(`comments/${f.item.id}/${randomUUID()}`,'PATCH',{read:true})).status,404);
    const different=f.store.saveItem({...f.item,id:randomUUID(),title:'另一篇文章'});
    assert.equal((await f.call(`comments/${different.id}/${row.id}`,'PATCH',{read:true})).status,404);
    for(const path of ['comments?status=private','comments?page=0','comments?page=1.5'])assert.equal((await f.call(path)).status,400);
    assert.equal((await (await f.call()).json()).unread,1);
  }finally{f.close();}
});
test('management pagination and deep links locate older comments using a stable order',async()=>{
  const f=fixture();try{
    const rows=Array.from({length:46},(_,i)=>f.add(`留言${i}`));
    // Equal timestamps exercise the id tie-breaker, independent of insertion timing.
    f.store.db.prepare('UPDATE article_comments SET created_at=?').run('2026-10-04T00:00:00.000Z');
    const sorted=rows.map(row=>row.id).sort().reverse();const target=sorted[43];
    const first=await (await f.call()).json();const second=await (await f.call('comments?page=2')).json();
    assert.equal(first.comments.length,20);assert.equal(first.hasMore,true);assert.equal(second.comments.length,20);
    assert.equal(new Set([...first.comments,...second.comments].map((r:any)=>r.id)).size,40);
    const focus=await (await f.call(`comments/${f.item.id}?focus=${target}`)).json();assert.equal(focus.page,3);assert.ok(focus.comments.some((r:any)=>r.id===target));assert.equal(focus.hasMore,false);
    assert.equal((await f.call(`comments/${f.item.id}?focus=${randomUUID()}`)).status,404);
    assert.equal((await f.call(`comments/${f.item.id}?focus=invalid`)).status,404);
    await f.call(`comments/${f.item.id}/${target}`,'PATCH',{read:true});f.store.deleteItem(f.item.id);
    assert.equal((await (await f.call()).json()).total,0);assert.equal(Number(f.store.db.prepare('SELECT COUNT(*) AS count FROM comment_reads').get()!.count),0);
  }finally{f.close();}
});
