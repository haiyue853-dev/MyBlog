import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {trashApi} from '../src/lib/api/trash';
import {itemsApi} from '../src/lib/api/items';
import {filesApi} from '../src/lib/api/files';
import {handleErrors,newToken} from '../src/lib/http';
import {saveCollectionBatch} from '../src/lib/collection-batch';
import {newArticle} from '../src/lib/articles';

function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-diary-'));
  const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);
  const origin='http://localhost:3000';
  const call=(path:string,method='GET',body?:unknown,owner=true)=>withRuntime(store,{appUrl:origin},()=>handleErrors(()=>{
    const request=new Request(`${origin}/api/${path}`,{method,headers:{origin,...(owner?{cookie:`world-session=${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const parts=path.split('?')[0].split('/');
    return parts[0]==='trash'?trashApi(request,parts):parts[0]==='items'?itemsApi(request,parts):filesApi(request,parts);
  }));
  const image=()=>store.addAsset({name:'photo.png',mime:'image/png',size:8,category:'记录图片'});
  return {store,directory,call,image,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}
const base={kind:'moment',title:'周末照片',body:'一起收好',visibility:'private',tags:[],category:'生活',url:''};

test('inline article photos do not become covers unless the owner explicitly chooses one',async()=>{
  const f=fixture();try{
    const photo=f.image();await f.store.writeAsset(photo.id,Buffer.from('testimg'));
    const response=await f.call('items','POST',{...base,visibility:'public',article:newArticle(),assetId:null,images:[{assetId:photo.id}],body:`![正文](/api/files/${photo.id}?inline=1)`});
    assert.equal(response.status,201);const item=(await response.json()).item;assert.equal(item.assetId,null);assert.equal(item.images[0].assetId,photo.id);
    assert.equal((await f.call(`files/${photo.id}`,'GET',undefined,false)).status,200);
    const covered=(await (await f.call(`items/${item.id}`,'PUT',{...item,assetId:photo.id})).json()).item;assert.equal(covered.assetId,photo.id);
    const cleared=(await (await f.call(`items/${item.id}`,'PUT',{...covered,assetId:null})).json()).item;assert.equal(cleared.assetId,null);assert.equal(cleared.images[0].assetId,photo.id);
  }finally{f.close();}
});

test('lost save response can be retried without creating a duplicate collection',async()=>{
  const f=fixture();let lost=true;
  try{
    const entry={key:randomUUID(),title:'jisoo',file:new File(['photo'],'jisoo.png'),previewUrl:'',state:'ready' as const};
    const operations={upload:async()=>({assetId:f.image().id}),onUpdate:()=>{},save:async(input:unknown)=>{
      const response=await f.call('items','POST',input);assert.equal(response.status,201);
      if(lost){lost=false;throw new Error('Failed to fetch');}
    }};
    const defaults={category:'jisoo',tags:[],visibility:'private' as const};
    const first=await saveCollectionBatch([entry],defaults,operations);assert.equal(first.failed,1);
    assert.equal(f.store.listItems(true).length,1);
    const retry=await saveCollectionBatch(first.entries,defaults,operations);assert.equal(retry.failed,0);
    assert.equal(f.store.listItems(true).length,1);
  }finally{f.close();}
});

test('collection saves a photo group with cover dimensions and protects every attachment',async()=>{
  const f=fixture();
  try{
    const first=f.image();const second=f.image();
    const response=await f.call('items','POST',{...base,kind:'collection',assetId:second.id,images:[{assetId:first.id,width:800,height:600},{assetId:second.id,width:600,height:900}]});
    assert.equal(response.status,201);const item=(await response.json()).item;
    assert.equal(item.images.length,2);assert.equal(item.imageWidth,600);assert.equal(item.imageHeight,900);
    assert.equal(f.store.assetInUse(first.id),true);assert.equal(f.store.isPublicAsset(first.id),false);
    await f.call(`items/${item.id}`,'PUT',{...item,visibility:'public'});
    assert.equal(f.store.isPublicAsset(first.id),true);
    await f.call(`items/${item.id}`,'PUT',{...item,images:[item.images[1]]});
    assert.equal(f.store.assetInUse(first.id),false);
  }finally{f.close();}
});

test('diary saves photo order and a separate cover, persists after reopening',async()=>{
  const f=fixture();
  try{
    const first=f.image();const second=f.image();
    const images=[{assetId:first.id,width:800,height:600},{assetId:second.id,width:600,height:900}];
    const response=await f.call('items','POST',{...base,assetId:second.id,images});assert.equal(response.status,201);
    const item=(await response.json()).item;
    assert.deepEqual(item.images,images);assert.equal(item.assetId,second.id);
    assert.equal(item.imageWidth,600);assert.equal(item.imageHeight,900);
    const changed=await f.call(`items/${item.id}`,'PUT',{...item,images:[images[1],images[0]],assetId:first.id});
    assert.equal(changed.status,200);assert.deepEqual((await changed.json()).item.images,[images[1],images[0]]);
    const reopened=new Store(f.directory);
    try{assert.deepEqual(reopened.getItem(item.id)?.images,[images[1],images[0]]);}finally{reopened.close();}
  }finally{f.close();}
});

test('every attached photo follows visibility, deletion protection and unused-file cleanup',async()=>{
  const f=fixture();
  try{
    const first=f.image();const second=f.image();const orphan=f.image();
    for(const asset of [first,second,orphan])await f.store.writeAsset(asset.id,Buffer.from([137,80,78,71,13,10,26,10]));
    const response=await f.call('items','POST',{...base,assetId:first.id,images:[{assetId:first.id},{assetId:second.id}]});
    assert.equal(response.status,201);const item=(await response.json()).item;
    assert.equal(f.store.assetInUse(second.id),true);
    assert.deepEqual(f.store.listUnusedAssets().map(asset=>asset.id),[orphan.id]);
    assert.equal((await f.call(`files/${second.id}`,'DELETE')).status,409);
    assert.equal((await f.call(`files/${second.id}`,'GET',undefined,false)).status,401);
    await f.call(`items/${item.id}`,'PUT',{...item,visibility:'public'});
    assert.equal((await f.call(`files/${second.id}`,'GET',undefined,false)).status,200);
    await f.call(`items/${item.id}`,'PUT',{...item,visibility:'private'});
    assert.equal((await f.call(`files/${second.id}`,'GET',undefined,false)).status,401);
    // A photo shared by another public diary remains visible until its last public reference is removed.
    const sharedResponse=await f.call('items','POST',{...base,visibility:'public',assetId:second.id,images:[{assetId:second.id}]});
    const shared=(await sharedResponse.json()).item;
    await f.call(`items/${item.id}`,'PUT',{...item,assetId:first.id,images:[{assetId:first.id}]});
    assert.equal(f.store.isPublicAsset(second.id),true);assert.equal(f.store.assetInUse(second.id),true);
    await f.call(`items/${shared.id}`,'DELETE');
    assert.equal(f.store.isPublicAsset(second.id),false);assert.equal(f.store.assetInUse(second.id),true);
    assert.deepEqual(await (await f.call('files?cleanup=1','POST',{ids:[first.id,second.id]})).json(),{ok:true,removed:0,skipped:2});
    assert.equal((await f.call(`trash/${shared.id}`,'DELETE')).status,200);assert.equal(f.store.assetInUse(second.id),false);
    const cleanup=await f.call('files?cleanup=1','POST',{ids:[first.id,second.id]});
    assert.deepEqual(await cleanup.json(),{ok:true,removed:1,skipped:1});
    await f.call(`items/${item.id}`,'DELETE');assert.equal(f.store.assetInUse(first.id),true);
    await f.call(`trash/${item.id}`,'DELETE');assert.equal(f.store.assetInUse(first.id),false);
  }finally{f.close();}
});

test('legacy single-photo records can still be edited without a photo array',async()=>{
  const f=fixture();
  try{
    const asset=f.image();const response=await f.call('items','POST',{...base,assetId:asset.id,imageWidth:1200,imageHeight:800});
    assert.equal(response.status,201);const item=(await response.json()).item;
    assert.equal(item.assetId,asset.id);assert.equal(item.imageWidth,1200);
    assert.equal(f.store.assetInUse(asset.id),true);
    assert.equal((await f.call(`items/${item.id}`,'PUT',{...base,assetId:asset.id})).status,200);
  }finally{f.close();}
});

test('invalid photo lists never save or change publication permissions',async t=>{
  const f=fixture();
  try{
    const asset=f.image();const other=f.image();
    const document=f.store.addAsset({name:'notes.txt',mime:'application/octet-stream',size:8,category:'笔记'});
    const cases=[
      {name:'non-array',images:'bad'},
      {name:'too many',images:Array.from({length:13},()=>({assetId:randomUUID()}))},
      {name:'duplicate',images:[{assetId:asset.id},{assetId:asset.id}]},
      {name:'unknown image',images:[{assetId:asset.id},{assetId:randomUUID()}]},
      {name:'non-image',images:[{assetId:asset.id},{assetId:document.id}]},
      {name:'cover outside list',images:[{assetId:other.id}]},
      {name:'empty list with cover',images:[]},
      {name:'invalid entry',images:[null]},
    ];
    for(const value of cases)await t.test(value.name,async()=>{
      const response=await f.call('items','POST',{...base,visibility:'public',assetId:asset.id,images:value.images});
      assert.equal(response.status,400);
      assert.equal(f.store.isPublicAsset(asset.id),false);
    });
    assert.equal(f.store.listItems(true).length,0);
  }finally{f.close();}
});

test('missing cover defaults to first photo and clearing all photos leaves a text diary',async()=>{
  const f=fixture();
  try{
    const asset=f.image();const response=await f.call('items','POST',{...base,assetId:null,images:[{assetId:asset.id}]});
    assert.equal(response.status,201);const item=(await response.json()).item;
    assert.equal(item.assetId,asset.id);
    const edited=await f.call(`items/${item.id}`,'PUT',{...item,assetId:null,images:[]});
    assert.equal(edited.status,200);const cleared=(await edited.json()).item;
    assert.equal(cleared.assetId,null);assert.deepEqual(cleared.images,[]);assert.equal(f.store.assetInUse(asset.id),false);
  }finally{f.close();}
});
