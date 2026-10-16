import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {cpSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../src/lib/store';
import {hashPassword,verifyPassword} from '../src/lib/security';
import {withRuntime} from '../src/lib/runtime';
import {handleErrors,newToken,renewSession} from '../src/lib/http';

function fixture(){
  const root=mkdtempSync(join(tmpdir(),'world-backup-center-'));
  const store=new Store(join(root,'data'));
  return {root,store,close(){store.close();rmSync(root,{recursive:true,force:true});}};
}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};}
const tick=()=>new Promise<void>(done=>setImmediate(done));

test('complete backup restores private multi-photo records, public collections, owner, settings and every attachment',async()=>{
  const module=await import('../src/lib/backups').catch(()=>null);
  assert.ok(module?.createBackup,'完整备份生成器尚未实现');
  const f=fixture();
  try{
    f.store.setOwner('站主',hashPassword('complete-backup-password'));
    const assets=['封面.webp','第二张.webp','私人资料.txt'].map((name,index)=>{
      const content=Buffer.from(`original bytes ${index}`);
      const asset=f.store.addAsset({name,mime:index===2?'application/octet-stream':'image/webp',size:content.length,category:'私人附件'});
      writeFileSync(join(f.store.directory,'files',asset.id),content);return {asset,content};
    });
    f.store.saveProfile({...f.store.getProfile(),name:'备份测试小屋',avatarId:assets[0].asset.id});
    const common={title:'值得收好的瞬间',body:'私密内容',category:'Jisoo',tags:['小卡'],url:'',assetId:assets[0].asset.id};
    const moment=f.store.saveItem({...common,kind:'moment',visibility:'private',images:[{assetId:assets[1].asset.id,width:600,height:900},{assetId:assets[0].asset.id,width:900,height:600}]});
    const collection=f.store.saveItem({...common,kind:'collection',visibility:'public',watch:{type:'韩剧',state:'watching',rating:8.5,episodes:16,watched:4,year:'2026',reviewId:null}});
    f.store.addDailyLike(collection.id,'visitor','2026-10-03',false);
    const before=f.store.listItems(true);
    const result=await module.createBackup(f.store);
    assert.equal(result.collectionCount,1);assert.equal(result.momentCount,1);assert.equal(result.assetCount,3);assert.ok(result.size>0);
    const history=await module.listBackups(f.store);assert.deepEqual(history,[result]);
    const restoredDirectory=join(f.root,'restored');mkdirSync(restoredDirectory);
    execFileSync('tar',['-xzf',module.backupArchivePath(f.store,result.id),'-C',restoredDirectory]);
    const restored=new Store(restoredDirectory);
    try{
      assert.deepEqual(restored.listItems(true),before);
      assert.deepEqual(restored.getItem(moment.id)?.images,moment.images);
      assert.deepEqual(restored.getItem(collection.id)?.watch,collection.watch);
      assert.deepEqual(restored.listItems(false),[{...collection,body:''}]);
      assert.equal(restored.getItem(collection.id)?.body,collection.body,'完整备份仍保留站主的简介');
      assert.deepEqual(restored.getProfile(),f.store.getProfile());
      assert.ok(verifyPassword('complete-backup-password',restored.getOwner()!.password));
      assert.equal(restored.getLikes([collection.id],'visitor','2026-10-03',false)[collection.id].count,1);
      for(const {asset,content} of assets){assert.deepEqual(restored.getAsset(asset.id),asset);assert.deepEqual(await restored.readAsset(asset.id),content);}
      assert.match(readFileSync(join(restoredDirectory,'RESTORE.md'),'utf8'),/DATA_DIR/);
      assert.equal(JSON.parse(readFileSync(join(restoredDirectory,'backup.json'),'utf8')).assetCount,3);
    }finally{restored.close();}
    assert.deepEqual(f.store.listItems(true),before);
    assert.equal(readdirSync(module.backupDirectory(f.store)).filter(name=>name.startsWith('.')).length,0);
  }finally{f.close();}
});

test('ordinary requests remain concurrent while a backup waits for pending writes and blocks later writes',async()=>{
  const module=await import('../src/lib/backup-access').catch(()=>null);
  assert.ok(module?.withBackupAccess,'备份请求协调尚未实现');
  const f=fixture();const events:string[]=[];
  const writeRelease=deferred(),backupRelease=deferred(),backupStarted=deferred();
  try{
    const first=module.withBackupAccess(f.store,false,async()=>{events.push('upload-start');await writeRelease.promise;events.push('upload-done');});
    const parallel=module.withBackupAccess(f.store,false,async()=>{events.push('ordinary');});
    await tick();assert.ok(events.includes('ordinary'));
    const exclusive=module.withBackupAccess(f.store,true,async()=>{events.push('backup-start');backupStarted.resolve();await backupRelease.promise;events.push('backup-done');});
    const later=module.withBackupAccess(f.store,false,async()=>{events.push('delete');});
    await tick();assert.ok(!events.includes('backup-start'));assert.ok(!events.includes('delete'));
    writeRelease.resolve();await backupStarted.promise;assert.ok(!events.includes('delete'));
    backupRelease.resolve();await Promise.all([first,parallel,exclusive,later]);
    assert.ok(events.indexOf('upload-done')<events.indexOf('backup-start'));
    assert.ok(events.indexOf('backup-done')<events.indexOf('delete'));
    await assert.rejects(module.withBackupAccess(f.store,true,async()=>{throw new Error('disk failed');}),/disk failed/);
    assert.equal(await module.withBackupAccess(f.store,false,async()=>42),42);
  }finally{writeRelease.resolve();backupRelease.resolve();f.close();}
});

test('a missing attachment aborts the backup and removes incomplete archives and staging data',async()=>{
  const module=await import('../src/lib/backups').catch(()=>null);
  assert.ok(module?.createBackup,'完整备份生成器尚未实现');
  const f=fixture();
  try{
    f.store.addAsset({name:'missing.webp',mime:'image/webp',size:5,category:'收藏'});
    await assert.rejects(module.createBackup(f.store),/ENOENT/);
    assert.deepEqual(await module.listBackups(f.store),[]);
    assert.deepEqual(readdirSync(module.backupDirectory(f.store)),[]);
    assert.equal(f.store.listAssets().length,1);
  }finally{f.close();}
});

test('backup history and archive survive moving only the persistent DATA_DIR to another host',async()=>{
  const module=await import('../src/lib/backups');const f=fixture();
  try{
    const created=await module.createBackup(f.store);
    const relocated=join(f.root,'another-host','data');mkdirSync(join(f.root,'another-host'));
    cpSync(f.store.directory,relocated,{recursive:true});
    const restored=new Store(relocated);
    try{
      assert.deepEqual(await module.listBackups(restored),[created],'只迁移持久化数据目录后，备份历史也应保留');
      assert.deepEqual(readFileSync(module.backupArchivePath(restored,created.id)),readFileSync(module.backupArchivePath(f.store,created.id)));
    }finally{restored.close();}
  }finally{f.close();}
});

test('backup API protects creation, history and downloads and returns a restorable private attachment',async()=>{
  const module=await import('../src/lib/api/backups').catch(()=>null);
  assert.ok(module?.backupsApi,'备份接口尚未实现');
  const {withBackupAccess}=await import('../src/lib/backup-access');
  const f=fixture();const token=newToken();f.store.createSession(token,Date.now()+60000);
  const origin='http://localhost:3000';
  const call=(path='backups',method='GET',owner=true,requestOrigin=origin)=>withRuntime(f.store,{appUrl:origin},()=>withBackupAccess(f.store,method==='POST'&&path==='backups',()=>handleErrors(()=>module.backupsApi(new Request(`${origin}/api/${path}`,{method,headers:{origin:requestOrigin,...(owner?{cookie:`world-session=${token}`}:{})}}),path.split('/'),f.store))));
  try{
    assert.equal((await call('backups','GET',false)).status,401);
    assert.equal((await call('backups','POST',false)).status,401);
    assert.equal((await call('backups','POST',true,'http://evil.example')).status,403);
    assert.equal((await call('backups','DELETE')).status,405);
    assert.deepEqual((await (await call()).json()).backups,[]);
    const response=await call('backups','POST');assert.equal(response.status,201);
    const created=(await response.json()).backup;
    assert.equal((await call(`backups/${created.id}`,'GET',false)).status,401);
    assert.equal((await call('backups/../../data')).status,404);
    assert.equal((await call('backups/00000000-0000-0000-0000-000000000000')).status,404);
    const downloaded=await call(`backups/${created.id}`);assert.equal(downloaded.status,200);
    assert.match(downloaded.headers.get('content-disposition')!,/^attachment;.*\.tar\.gz/);
    assert.equal(downloaded.headers.get('cache-control'),'private, no-store');
    assert.equal(downloaded.headers.get('content-type'),'application/gzip');
    const bytes=Buffer.from(await downloaded.arrayBuffer());assert.equal(bytes.length,created.size);
    const archive=join(f.root,'download.tar.gz');writeFileSync(archive,bytes);
    assert.match(execFileSync('tar',['-tzf',archive],{encoding:'utf8'}),/world\.sqlite/);
    assert.deepEqual((await (await call()).json()).backups,[created]);
  }finally{f.close();}
});

test('renewing a session preserves a download stream without preloading its entire body',async()=>{
  const f=fixture();const token=newToken();f.store.createSession(token,Date.now()+60000);
  let reads=0;
  const stream=new ReadableStream<Uint8Array>({pull(controller){reads++;controller.enqueue(new TextEncoder().encode('archive bytes'));controller.close();}},{highWaterMark:0});
  try{
    const response=await withRuntime(f.store,{},()=>renewSession(new Request('http://localhost:3000/api/backups/id',{headers:{cookie:`world-session=${token}`}}),new Response(stream,{headers:{'content-type':'application/gzip'}})));
    assert.equal(reads,0,'续期不应把备份完整读入内存');
    assert.match(response.headers.get('set-cookie')!,/world-session=/);
    assert.equal(await response.text(),'archive bytes');assert.equal(reads,1);
  }finally{f.close();}
});
