import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {itemsApi} from '../src/lib/api/items';
import {commentsApi} from '../src/lib/api/comments';
import {filesApi} from '../src/lib/api/files';
import {handleErrors,newToken} from '../src/lib/http';
import {createBackup,backupArchivePath} from '../src/lib/backups';
const article={summary:'摘要',kicker:'随笔',series:'工作记录',spoiler:false,coverPosition:'center' as const,facts:[],quote:'一句话'};
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-trash-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);
  const asset=store.addAsset({name:'photo.png',mime:'image/png',size:3,category:'图片'});
  const item=store.saveItem({kind:'moment',title:'保留完整文章',body:'## 小标题\n正文',category:'工作',tags:['笔记'],visibility:'public',assetId:asset.id,images:[{assetId:asset.id,width:800,height:600}],url:'',article,status:'published',pinned:true,writingType:'article'});
  const comment=store.addComment({itemId:item.id,visitor:'guest',name:'小雨',body:'留言',owner:false})!;
  store.saveCommentReply(item.id,comment.id,'站主','谢谢');store.markCommentRead(item.id,comment.id,true);store.addDailyLike(item.id,'guest','2026-10-04',false);
  async function call(pathname:string,method='GET',body?:unknown,owner=true,origin='http://localhost:3000'){
    const path=pathname.split('?')[0].split('/');const request=new Request(`http://localhost:3000/api/${pathname}`,{method,headers:{cookie:owner?`world-session=${token}`:'',origin},body:body===undefined?undefined:JSON.stringify(body)});
    return withRuntime(store,{appUrl:'http://localhost:3000'},()=>handleErrors(async()=>{
      if(path[0]==='items')return itemsApi(request,path);
      if(path[0]==='comments')return commentsApi(request,path);
      if(path[0]==='files')return filesApi(request,path);
      return (await import('../src/lib/api/trash')).trashApi(request,path);
    }));
  }
  return {directory,store,item,asset,comment,call,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}
test('deleting content retains its complete record and protects all referenced photos',async()=>{
  const f=fixture();try{
    assert.equal((await f.call(`items/${f.item.id}`,'DELETE')).status,200);
    assert.deepEqual(JSON.parse(String(f.store.db.prepare('SELECT data FROM items WHERE id=?').get(f.item.id)?.data)),f.item);
    assert.equal(f.store.getItem(f.item.id),null);assert.deepEqual(f.store.listItems(true),[]);
    assert.equal(f.store.assetInUse(f.asset.id),true);assert.deepEqual(f.store.listUnusedAssets(),[]);assert.equal(f.store.isPublicAsset(f.asset.id),false);
    assert.equal((await f.call(`files/${f.asset.id}`,'DELETE')).status,409);
    assert.deepEqual(await (await f.call('files?cleanup=1','POST',{ids:[f.asset.id]})).json(),{ok:true,removed:0,skipped:1});
  }finally{f.close();}
});
test('downloadable backups retain trash metadata, attachments and associations for later restoration',async()=>{
  const f=fixture();try{
    writeFileSync(join(f.directory,'files',f.asset.id),Buffer.from('png'));
    await f.call(`items/${f.item.id}`,'DELETE');const original=f.store.getTrashedItem(f.item.id)!;
    const savedReplies=f.store.listCommentReplies([f.comment.id]);const backup=await createBackup(f.store);
    const restoredDirectory=join(f.directory,'restored');mkdirSync(restoredDirectory);execFileSync('tar',['-xzf',backupArchivePath(f.store,backup.id),'-C',restoredDirectory]);
    const restored=new Store(restoredDirectory);try{
      assert.equal(restored.getItem(f.item.id),null);assert.deepEqual(restored.getTrashedItem(f.item.id),original);
      assert.deepEqual(readFileSync(join(restoredDirectory,'files',f.asset.id)),Buffer.from('png'));assert.deepEqual(restored.listUnusedAssets(),[]);
      assert.ok(restored.restoreItem(f.item.id));assert.deepEqual(restored.getItem(f.item.id),f.item);
      assert.deepEqual(restored.listCommentReplies([f.comment.id]),savedReplies);assert.equal(restored.managedCommentCounts().unread,0);assert.equal(restored.getLikes([f.item.id],'guest','2026-10-04',false)[f.item.id].count,1);
    }finally{restored.close();}
  }finally{f.close();}
});
test('trash requires owner login and same-origin mutations, and cannot purge active content',async()=>{
  const f=fixture();try{
    assert.equal((await f.call('trash','GET',undefined,false)).status,401);
    for(const method of ['POST','DELETE']){
      assert.equal((await f.call(`trash/${f.item.id}`,method,undefined,false)).status,401);
      assert.equal((await f.call(`trash/${f.item.id}`,method,undefined,true,'https://evil.test')).status,403);
      assert.equal((await f.call(`trash/${f.item.id}`,method)).status,404);
    }
    assert.deepEqual(f.store.getItem(f.item.id),f.item);
  }finally{f.close();}
});
test('trash hides public and owner details, comments, likes and statistics until restored',async()=>{
  const f=fixture();try{
    const reply=f.store.listCommentReplies([f.comment.id]);await f.call(`items/${f.item.id}`,'DELETE');
    for(const owner of [false,true]){
      assert.equal((await f.call(`items/${f.item.id}`,'GET',undefined,owner)).status,404);
      assert.equal((await f.call(`comments/${f.item.id}`,'GET',undefined,owner)).status,404);
      assert.deepEqual(f.store.getLikes([f.item.id],'guest','2026-10-04',owner),{});
      assert.equal(f.store.addDailyLike(f.item.id,'new-guest','2026-10-04',owner),false);
    }
    assert.deepEqual(f.store.managedCommentCounts(),{total:0,unread:0});assert.deepEqual(f.store.listManagedComments(false,1),[]);
    assert.equal(f.store.addComment({itemId:f.item.id,visitor:'new-guest',name:'路过',body:'不应写入',owner:false}),null);
    const stats=f.store.getStatistics('2026-10-04');assert.equal(stats.content.moments,0);
    const rows=(await (await f.call('trash')).json()).entries;assert.equal(rows.length,1);assert.deepEqual(rows[0].item,f.item);assert.ok(rows[0].deletedAt);
    assert.equal((await f.call(`trash/${f.item.id}`,'POST')).status,200);
    assert.deepEqual(f.store.getItem(f.item.id),f.item);assert.deepEqual(f.store.listCommentReplies([f.comment.id]),reply);
    assert.deepEqual(f.store.managedCommentCounts(),{total:1,unread:0});assert.equal(f.store.getLikes([f.item.id],'guest','2026-10-04',false)[f.item.id].count,1);assert.equal(f.store.isPublicAsset(f.asset.id),true);
  }finally{f.close();}
});
test('restoring a private draft or collection preserves visibility, status, tags and timestamps',async()=>{
  const f=fixture();try{
    for(const input of [{...f.item,id:randomUUID(),visibility:'private' as const,status:'draft' as const},{kind:'collection' as const,title:'jisoo',body:'小卡',category:'Jisoo',tags:['小卡'],visibility:'private' as const,assetId:f.asset.id,url:'',cardRatio:'portrait' as const}]){
      const original=f.store.saveItem(input);await f.call(`items/${original.id}`,'DELETE');
      assert.equal((await f.call(`items/${original.id}`,'PUT',original)).status,404);
      await f.call(`trash/${original.id}`,'POST');assert.deepEqual(f.store.getItem(original.id),original);assert.equal(f.store.getItem(original.id,false),null);
    }
  }finally{f.close();}
});
test('permanent deletion cascades associations and releases photos only after the last reference',async()=>{
  const f=fixture();try{
    const shared=f.store.saveItem({...f.item,id:randomUUID(),title:'另一篇'});
    await f.call(`items/${f.item.id}`,'DELETE');assert.equal(f.store.isPublicAsset(f.asset.id),true);
    await f.call(`items/${shared.id}`,'DELETE');assert.equal(f.store.isPublicAsset(f.asset.id),false);
    assert.equal((await f.call(`trash/${f.item.id}`,'DELETE')).status,200);assert.equal(f.store.getComment(f.item.id,f.comment.id),null);assert.deepEqual(f.store.listCommentReplies([f.comment.id]),[]);
    assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM item_like_counts WHERE item_id=?').get(f.item.id)?.n,0);
    assert.equal(f.store.assetInUse(f.asset.id),true);assert.equal((await f.call(`trash/${shared.id}`,'DELETE')).status,200);
    assert.equal(f.store.assetInUse(f.asset.id),false);assert.equal(f.store.listUnusedAssets()[0].id,f.asset.id);assert.ok(f.store.getAsset(f.asset.id));
    assert.equal((await f.call(`trash/${f.item.id}`,'POST')).status,404);
  }finally{f.close();}
});
test('a retried create cannot overwrite a trashed record, and trash pagination is stable',async()=>{
  const f=fixture();try{
    await f.call(`items/${f.item.id}`,'DELETE');
    const retry=await f.call('items','POST',{...f.item,clientRequestId:f.item.id,title:'不应覆盖'});assert.equal(retry.status,409);
    assert.throws(()=>f.store.saveItem({...f.item,title:'也不应覆盖'}),/回收站/);
    for(let index=0;index<22;index++){const item=f.store.saveItem({...f.item,id:randomUUID(),title:`记录${index}`});await f.call(`items/${item.id}`,'DELETE');}
    const first=await (await f.call('trash?page=1')).json();const second=await (await f.call('trash?page=2')).json();assert.equal(first.entries.length,20);assert.equal(first.hasMore,true);assert.equal(first.total,23);assert.equal(second.entries.length,3);assert.equal(second.hasMore,false);
    assert.equal(new Set([...first.entries,...second.entries].map(row=>row.item.id)).size,23);
    await f.call(`trash/${f.item.id}`,'POST');assert.deepEqual(f.store.getItem(f.item.id),f.item);
  }finally{f.close();}
});
