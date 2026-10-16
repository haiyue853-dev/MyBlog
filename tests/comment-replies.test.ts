import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {commentsApi} from '../src/lib/api/comments';
import {handleErrors,newToken} from '../src/lib/http';
import {createBackup,backupArchivePath} from '../src/lib/backups';
const article={summary:'',kicker:'',series:'',spoiler:false,coverPosition:'center' as const,facts:[],quote:''};
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-replies-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);
  const item=store.saveItem({kind:'moment',title:'文章',body:'正文',category:'工作',tags:[],visibility:'public',assetId:null,url:'',article});
  const comment=store.addComment({itemId:item.id,visitor:'visitor-hash',name:'小雨',body:'原留言',owner:false})!;const path=`comments/${item.id}/${comment.id}/reply`;
  async function call(pathname=path,method='GET',body?:unknown,owner=true,origin='http://localhost:3000'){
    return withRuntime(store,{appUrl:'http://localhost:3000'},()=>handleErrors(()=>commentsApi(new Request(`http://localhost:3000/api/${pathname}`,{method,headers:{cookie:owner?`world-session=${token}`:'',origin},body:body===undefined?undefined:JSON.stringify(body)}),pathname.split('?')[0].split('/'))));
  }
  return {directory,store,item,comment,path,call,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}
test('only an owner can create, edit or delete replies; validation never accepts forged signatures',async()=>{
  const f=fixture();try{
    for(const method of ['PUT','DELETE'])assert.equal((await f.call(f.path,method,method==='PUT'?{body:'回复'}:undefined,false)).status,401);
    assert.equal((await f.call(f.path,'PUT',{body:'回复'},true,'https://evil.test')).status,403);
    for(const body of [{body:''},{body:'x'.repeat(2001)},{body:'回复',name:'伪造署名'},{body:'回复',owner:true}])assert.equal((await f.call(f.path,'PUT',body)).status,400);
    assert.equal((await f.call(`comments/${f.item.id}/${randomUUID()}/reply`,'PUT',{body:'回复'})).status,404);
    const other=f.store.saveItem({...f.item,id:randomUUID()});assert.equal((await f.call(`comments/${other.id}/${f.comment.id}/reply`,'PUT',{body:'回复'})).status,404);
    assert.equal((await (await f.call(`comments/${f.item.id}`)).json()).comments[0].reply,null);
  }finally{f.close();}
});
test('a reply appears beneath its parent, marks it read and preserves its original signature when edited',async()=>{
  const f=fixture();try{
    f.store.saveProfile({...f.store.getProfile(),aboutName:'小屋主人'});
    const created=await f.call(f.path,'PUT',{body:'谢谢你。\n<script>这仍是普通文字</script>'});assert.equal(created.status,200);
    const initial=(await created.json()).reply;assert.equal(initial.commentId,f.comment.id);assert.equal(initial.name,'小屋主人');assert.equal(initial.body,'谢谢你。\n<script>这仍是普通文字</script>');assert.ok(!('visitor' in initial));
    const visible=(await (await f.call(`comments/${f.item.id}`,'GET',undefined,false)).json()).comments;assert.equal(visible.length,1);assert.deepEqual(visible[0].reply,initial);
    const managed=await (await f.call('comments')).json();assert.equal(managed.total,1);assert.equal(managed.unread,0);assert.deepEqual(managed.comments[0].reply,initial);
    f.store.db.prepare('UPDATE comment_replies SET updated_at=?').run('2026-01-01T00:00:00.000Z');
    f.store.saveProfile({...f.store.getProfile(),aboutName:'新的署名'});
    const edited=(await (await f.call(f.path,'PUT',{body:'修改后的回复'})).json()).reply;assert.equal(edited.name,'小屋主人');assert.equal(edited.createdAt,initial.createdAt);assert.notEqual(edited.updatedAt,'2026-01-01T00:00:00.000Z');assert.equal(edited.body,'修改后的回复');
    const reopened=new Store(f.directory);try{assert.equal(reopened.listCommentReplies([f.comment.id])[0].body,'修改后的回复');}finally{reopened.close();}
    assert.equal((await f.call(f.path,'DELETE')).status,200);assert.equal((await (await f.call(`comments/${f.item.id}`)).json()).comments[0].reply,null);assert.equal((await (await f.call('comments')).json()).total,1);
  }finally{f.close();}
});
test('replies inherit private and draft protection, while the owner can still manage them',async()=>{
  const f=fixture();try{
    assert.equal((await f.call(f.path,'PUT',{body:'公开回复'})).status,200);
    for(const change of [{visibility:'private' as const},{visibility:'public' as const,status:'draft' as const}]){
      f.store.saveItem({...f.store.getItem(f.item.id)!,...change});
      assert.equal((await f.call(`comments/${f.item.id}`,'GET',undefined,false)).status,404);
      assert.equal((await f.call(f.path,'PUT',{body:'仅站主可见的修改'})).status,200);
      assert.equal((await (await f.call('comments')).json()).comments[0].reply.body,'仅站主可见的修改');
    }
  }finally{f.close();}
});
test('replies leave comment ordering and page positions intact and cascade with their parent',async()=>{
  const f=fixture();try{
    for(let index=0;index<26;index++)f.store.addComment({itemId:f.item.id,visitor:'visitor',name:'路过',body:`留言${index}`,owner:false});
    const before=await (await f.call(`comments/${f.item.id}?focus=${f.comment.id}`)).json();
    assert.equal((await f.call(f.path,'PUT',{body:'较早留言的回复'})).status,200);
    const after=await (await f.call(`comments/${f.item.id}?focus=${f.comment.id}`)).json();assert.equal(after.page,before.page);assert.deepEqual(after.comments.map((r:any)=>r.id),before.comments.map((r:any)=>r.id));assert.equal(after.comments.find((r:any)=>r.id===f.comment.id).reply.body,'较早留言的回复');
    await f.call(`comments/${f.item.id}/${f.comment.id}`,'DELETE');assert.deepEqual(f.store.listCommentReplies([f.comment.id]),[]);
    const remaining=f.store.listComments(f.item.id,1)[0];await f.call(`comments/${f.item.id}/${remaining.id}/reply`,'PUT',{body:'随文章一起删除'});f.store.deleteItem(f.item.id);
    assert.equal(Number(f.store.db.prepare('SELECT COUNT(*) AS count FROM comment_replies').get()!.count),0);
  }finally{f.close();}
});
test('a complete downloadable backup restores parent comments, replies and read status together',async()=>{
  const f=fixture();try{
    await f.call(f.path,'PUT',{body:'这段回复也要备份'});
    const saved=f.store.listCommentReplies([f.comment.id]);const backup=await createBackup(f.store);
    const restoredDirectory=join(f.directory,'restored');mkdirSync(restoredDirectory);execFileSync('tar',['-xzf',backupArchivePath(f.store,backup.id),'-C',restoredDirectory]);
    const restored=new Store(restoredDirectory);try{assert.equal(restored.getComment(f.item.id,f.comment.id)?.body,'原留言');assert.deepEqual(restored.listCommentReplies([f.comment.id]),saved);assert.equal(restored.managedCommentCounts().unread,0);}finally{restored.close();}
  }finally{f.close();}
});
