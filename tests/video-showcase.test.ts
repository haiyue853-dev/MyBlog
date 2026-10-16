import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {handleErrors,newToken} from '../src/lib/http';
import {itemsApi} from '../src/lib/api/items';
import {filesApi} from '../src/lib/api/files';
import {createBackup,backupArchivePath,listBackups} from '../src/lib/backups';
import {Space} from '../src/components/space';
import {DEFAULT_PROFILE} from '../src/lib/types';
import {readSpaceRoute} from '../src/lib/space-route';
import {searchSite} from '../src/lib/site-search';

const mp4=new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109,109,112,52,50,0,0,0,8,109,100,97,116]);
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-video-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);
  async function call(path:string,method='GET',body?:unknown,owner=true,extra:Record<string,string>={}){
    const headers={host:'localhost:3000',origin:'http://localhost:3000',cookie:owner?`world-session=${token}`:'',...extra};
    const request=new Request(`http://localhost:3000/api/${path}`,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
    const parts=path.split('?')[0].split('/');return withRuntime(store,{},()=>handleErrors(()=>parts[0]==='files'?filesApi(request,parts):itemsApi(request,parts)));
  }
  async function upload(content=mp4,name='edit.mp4',path='files?video=1'){
    const form=new FormData();form.set('file',new File([content],name));return call(path,'POST',form);
  }
  async function create(visibility='public'){
    const uploaded=await upload();assert.equal(uploaded.status,201);const asset=(await uploaded.json()).file;
    const response=await call('items','POST',{kind:'video',title:'舞台剪辑',body:'把喜欢的镜头留下',category:'K-pop',tags:['舞台'],url:'',assetId:null,visibility,video:{assetId:asset.id,duration:32,width:1080,height:1920}});
    assert.equal(response.status,201);return {asset,item:(await response.json()).item};
  }
  return {store,directory,call,upload,create,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}

test('retired video and travel modules keep the shared header without navigation or upload entries',()=>{
  assert.equal(readSpaceRoute(new URL('http://localhost:3000/?view=travel'))?.view,'home');
  assert.equal(readSpaceRoute(new URL('http://localhost:3000/?view=videos'))?.view,'home');
  const html=renderToStaticMarkup(createElement(Space,{initialItems:[],initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true,initialView:'videos'}));
  assert.doesNotMatch(html,/aria-label="视频作品"|视频作品栏目|上传作品|aria-label="旅行足迹"/);assert.match(html,/小屋导航/);
});
test('local videos require owner upload, actual video bytes and a valid video attachment',async()=>{
  const f=fixture();try{
    const form=new FormData();form.set('file',new File([mp4],'clip.mp4'));
    assert.equal((await f.call('files?video=1','POST',form,false)).status,401);
    assert.equal((await f.upload(new Uint8Array([1,2,3]),'fake.mp4')).status,400);
    const {asset,item}=await f.create();assert.equal(asset.mime,'video/mp4');assert.equal(item.video.assetId,asset.id);
    assert.equal(item.article,null);assert.equal(item.status,'published');
    assert.equal((await f.call(`items/${item.id}`,'PUT',{...item,video:{assetId:newToken().slice(0,36)}})).status,400);
    const image=f.store.addAsset({name:'cover.png',mime:'image/png',size:8,category:'封面'});
    assert.equal((await f.call(`items/${item.id}`,'PUT',{...item,video:{assetId:image.id}})).status,400);
    assert.equal((await f.call(`items/${item.id}`,'PUT',{...item,video:{assetId:asset.id,duration:-1}})).status,400);
    assert.equal((await f.call(`items/${item.id}`,'PUT',{...item,kind:'collection'})).status,400);
    assert.equal(f.store.getItem(item.id)?.video?.assetId,asset.id);
  }finally{f.close();}
});
test('video streaming supports exact byte ranges, suffixes, HEAD and unsatisfiable ranges',async()=>{
  const f=fixture();try{
    const {asset}=await f.create();
    const response=await f.call(`files/${asset.id}?inline=1`,'GET',undefined,false,{range:'bytes=4-11'});
    assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'video/mp4');
    assert.equal(response.headers.get('content-range'),`bytes 4-11/${mp4.length}`);assert.equal(response.headers.get('content-length'),'8');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),mp4.slice(4,12));
    const suffix=await f.call(`files/${asset.id}?inline=1`,'GET',undefined,false,{range:'bytes=-4'});assert.deepEqual(new Uint8Array(await suffix.arrayBuffer()),mp4.slice(-4));
    const head=await f.call(`files/${asset.id}?inline=1`,'HEAD',undefined,false);assert.equal(head.status,200);assert.equal(head.headers.get('accept-ranges'),'bytes');assert.equal((await head.arrayBuffer()).byteLength,0);
    const invalid=await f.call(`files/${asset.id}?inline=1`,'GET',undefined,false,{range:'bytes=999-'});assert.equal(invalid.status,416);assert.equal(invalid.headers.get('content-range'),`bytes */${mp4.length}`);
    const open=await f.call(`files/${asset.id}?inline=1`,'GET',undefined,false,{range:'bytes=24-'});assert.deepEqual(new Uint8Array(await open.arrayBuffer()),mp4.slice(24));
    const clamped=await f.call(`files/${asset.id}?inline=1`,'GET',undefined,false,{range:'bytes=24-999'});assert.deepEqual(new Uint8Array(await clamped.arrayBuffer()),mp4.slice(24));
    assert.equal((await f.call(`files/${asset.id}?inline=1`,'GET',undefined,false,{range:'bytes=0-1,4-5'})).status,416);
  }finally{f.close();}
});

test('retiring the video module restores the ordinary upload limit even for the old video flag',async()=>{
  const f=fixture();try{
    const content=new Uint8Array(21*1024*1024);content.set(mp4);
    assert.equal((await f.upload(content,'large.mp4','files')).status,413);
    const response=await f.upload(content,'large.mp4');assert.equal(response.status,413);assert.equal(f.store.listAssets().length,0);
    assert.equal((await f.call('files?video=1','POST',undefined,true,{'content-length':String(102*1024*1024)})).status,413);
  }finally{f.close();}
});
test('private, draft and trashed videos protect both their video and cover, including range requests',async()=>{
  const f=fixture();try{
    const {asset,item}=await f.create();const cover=f.store.addAsset({name:'cover.png',mime:'image/png',size:8,category:'封面'});
    const linked={...item,assetId:cover.id};f.store.saveItem(linked);assert.ok(f.store.isPublicAsset(cover.id));
    for(const input of [{...linked,visibility:'private' as const},{...linked,status:'draft' as const}]){
      f.store.saveItem(input);
      assert.equal((await f.call(`files/${asset.id}?inline=1`,'GET',undefined,false,{range:'bytes=0-3'})).status,401);
      assert.equal(f.store.isPublicAsset(cover.id),false);assert.ok(f.store.assetInUse(asset.id));
    }
    f.store.saveItem(linked);f.store.trashItem(item.id);
    assert.equal((await f.call(`files/${asset.id}?inline=1`,'HEAD',undefined,false)).status,401);
    assert.equal((await f.call(`files/${asset.id}`,'DELETE')).status,409);assert.ok(f.store.assetInUse(cover.id));
    f.store.restoreItem(item.id);assert.ok(f.store.isPublicAsset(asset.id));
  }finally{f.close();}
});
test('retired video works are excluded from site search without appearing as daily notes',async()=>{
  const f=fixture();try{
    const {item}=await f.create();const privateItem={...item,id:newToken().slice(0,36),visibility:'private' as const};
    const result=searchSite([item,privateItem],false,{query:'舞台',type:'all'});
    assert.equal(result.results.length,0);assert.equal(result.counts.video,0);assert.equal(result.counts.daily,0);
  }finally{f.close();}
});
test('complete backups restore original video bytes, metadata, covers and retained travel settings',async()=>{
  const f=fixture();try{
    const {asset,item}=await f.create();const places=[{cityId:'350500',status:'home' as const,note:'家乡',date:'',itemId:null}];f.store.saveTravelPlaces(places);
    const cover=f.store.addAsset({name:'cover.png',mime:'image/png',size:8,category:'封面'});await f.store.writeAsset(cover.id,Buffer.from([137,80,78,71,13,10,26,10]));f.store.saveItem({...item,assetId:cover.id});
    const backup=await createBackup(f.store);assert.equal(backup.videoCount,1);assert.equal((await listBackups(f.store))[0].videoCount,1);const destination=join(f.directory,'restored');mkdirSync(destination);execFileSync('tar',['-xzf',backupArchivePath(f.store,backup.id),'-C',destination]);
    const restored=new Store(destination);try{assert.deepEqual(await restored.readAsset(asset.id),Buffer.from(mp4));assert.equal(restored.getItem(item.id)?.assetId,cover.id);assert.deepEqual(restored.getTravelPlaces(),places);assert.ok(restored.assetInUse(asset.id));}finally{restored.close();}
  }finally{f.close();}
});
