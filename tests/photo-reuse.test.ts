import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {filesApi} from '../src/lib/api/files';
import {handleErrors,newToken} from '../src/lib/http';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const bytes=Buffer.from([137,80,78,71,13,10,26,10,1]);
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'photo-reuse-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);
  const origin='http://localhost:3000';
  async function add(content=bytes){const asset=store.addAsset({name:'original.png',mime:'image/png',size:content.length,category:'记录图片'});await store.writeAsset(asset.id,content);return asset;}
  async function upload(content:Buffer,reuse:unknown,reuseOnly=false,owner=true,requestOrigin=origin){
    const form=new FormData();form.append('file',new File([new Uint8Array(content)],'renamed.png'));form.append('category','记录图片');
    if(reuse!==undefined)form.append('reuseImageIds',JSON.stringify(reuse));if(reuseOnly)form.append('reuseOnly','1');
    return withRuntime(store,{appUrl:origin},()=>handleErrors(()=>filesApi(new Request(`${origin}/api/files`,{method:'POST',headers:{origin:requestOrigin,...(owner?{cookie:`world-session=${token}`}:{})},body:form}),['files'])));
  }
  return {store,add,upload,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}
test('same image bytes reuse the current record photo without creating another file',async()=>{
  const f=fixture();try{const old=await f.add();const result=await f.upload(bytes,[old.id]);assert.equal(result.status,200);assert.equal((await result.json()).file.id,old.id);assert.equal(f.store.listAssets().length,1);assert.deepEqual(await f.store.readAsset(old.id),bytes);}finally{f.close();}
});
test('different content and pictures outside the candidate list create separate uploads',async()=>{
  const f=fixture();try{const old=await f.add();const changed=await f.upload(Buffer.from([...bytes.slice(0,-1),2]),[old.id]);assert.equal(changed.status,201);assert.notEqual((await changed.json()).file.id,old.id);const unscoped=await f.upload(bytes,[]);assert.equal(unscoped.status,201);assert.notEqual((await unscoped.json()).file.id,old.id);}finally{f.close();}
});
test('reuse-only capacity allows duplicates and rejects a new photo without creating an asset',async()=>{
  const f=fixture();try{const old=await f.add();assert.equal((await f.upload(bytes,[old.id],true)).status,200);assert.equal((await f.upload(Buffer.from([...bytes,3]),[old.id],true)).status,400);assert.equal(f.store.listAssets().length,1);}finally{f.close();}
});
test('invalid candidates and unauthorized requests are rejected before asset reads or writes',async()=>{
  const f=fixture();try{const old=await f.add();let reads=0;const read=f.store.readAsset.bind(f.store);f.store.readAsset=async id=>{reads++;return read(id);};
    for(const candidates of ['not-an-array',[12],['bad'],Array(13).fill(old.id)])assert.equal((await f.upload(bytes,candidates)).status,400);
    assert.equal((await f.upload(bytes,[old.id],false,false)).status,401);assert.equal((await f.upload(bytes,[old.id],false,true,'https://evil.example')).status,403);assert.equal(reads,0);assert.equal(f.store.listAssets().length,1);
  }finally{f.close();}
});
test('a missing older file does not prevent uploading a replacement',async()=>{
  const f=fixture();try{const old=await f.add();await f.store.removeAsset(old.id);assert.equal((await f.upload(bytes,[old.id])).status,201);}finally{f.close();}
});
test('merging reused attachments keeps one photo and the original order',async()=>{
  const module=await import('../src/lib/item-images');assert.ok(module.appendItemPhoto,'附件合并尚未实现');
  const first={assetId:'11111111-1111-1111-1111-111111111111',width:300,height:200};const second={assetId:'22222222-2222-2222-2222-222222222222'};
  assert.deepEqual(module.appendItemPhoto([first],{...first}),[first]);assert.deepEqual(module.appendItemPhoto([first],second),[first,second]);
});
test('the photo picker remains available at capacity so an existing picture can be reused',async()=>{
  const {DiaryPhotos}=await import('../src/components/diary-photos');
  const images=Array.from({length:12},(_,index)=>({assetId:`00000000-0000-0000-0000-${String(index).padStart(12,'0')}`}));
  const html=renderToStaticMarkup(createElement(DiaryPhotos,{images,coverId:null,onChange:()=>{},onUploadingChange:()=>{}}));
  const picker=html.match(/<input[^>]*aria-label="添加日记照片"[^>]*>/)?.[0];assert.ok(picker);assert.doesNotMatch(picker,/disabled/);
});
