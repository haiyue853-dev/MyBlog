import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Store} from '../src/lib/store';
import {itemsApi} from '../src/lib/api/items';
import {withRuntime} from '../src/lib/runtime';
import {handleErrors,newToken} from '../src/lib/http';
import {initialEditorDraft,readEditorDraft,writeEditorDraft} from '../src/lib/editor-draft';
import {Editor} from '../src/components/editor';
import {Space} from '../src/components/space';
import {ItemGallery} from '../src/components/item-gallery';
import {DEFAULT_PROFILE,type Item} from '../src/lib/types';

const crop={x:25,y:15,zoom:1.6};
const item:Item={id:'88499e97-e6bc-4f2e-8e51-4e53ad1739c5',kind:'moment',title:'笔试通知',body:'先试一试',tags:[],category:'日常',assetId:'88499e97-e6bc-4f2e-8e51-4e53ad1739c6',url:'',visibility:'public',createdAt:'2026-10-15',updatedAt:'2026-10-15',coverCrop:crop};

test('daily records expose a cover preview without switching to article mode',()=>{
  const html=renderToStaticMarkup(createElement(Editor,{kind:'moment',item,onClose(){},onSaved(){}}));
  assert.match(html,/aria-label="封面取景框"/);assert.match(html,/aria-label="封面缩放"/);assert.match(html,/160%/);
  assert.match(html,/cover-crop-card/);assert.doesNotMatch(html,/你的文章标题/);
});

test('daily cards display the saved crop while original gallery photos remain intact',()=>{
  const html=renderToStaticMarkup(createElement(Space,{initialItems:[item],initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true,initialView:'life'}));
  assert.match(html,/<img[^>]*object-position:25% 15%[^>]*transform:scale\(1\.6\)/);
  const gallery=renderToStaticMarkup(createElement(ItemGallery,{item}));
  assert.doesNotMatch(gallery,/object-position|transform:scale/);
  assert.match(gallery,/查看原图/);
});

test('daily cover crop survives draft restore',()=>{
  const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const draft=initialEditorDraft('moment',item);
  writeEditorDraft(storage,'moment',item.id,draft);
  assert.deepEqual(readEditorDraft(storage,'moment',item.id)?.coverCrop,crop);
});

test('API validates and saves daily cover crop, retains it on metadata edits and clears it for a new cover',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'diary-cover-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);
  const origin='http://localhost:3000';
  const call=(method:string,body:unknown,id?:string)=>withRuntime(store,{appUrl:origin},()=>handleErrors(()=>itemsApi(new Request(`${origin}/api/items${id?'/'+id:''}`,{method,headers:{origin,cookie:`world-session=${token}`},body:JSON.stringify(body)}),id?['items',id]:['items'])));
  try{
    const image=store.addAsset({name:'notice.png',mime:'image/png',size:8,category:'日常'});
    const input={...item,id:undefined,assetId:image.id,coverCrop:crop};
    for(const invalid of [{...crop,x:-1},{...crop,y:101},{...crop,zoom:.5},{...crop,zoom:4},{...crop,x:'25'}])assert.equal((await call('POST',{...input,coverCrop:invalid})).status,400);
    const response=await call('POST',input);assert.equal(response.status,201);const saved=(await response.json()).item;
    assert.deepEqual(saved.coverCrop,crop);
    const reopened=new Store(directory);try{assert.deepEqual(reopened.getItem(saved.id)?.coverCrop,crop);}finally{reopened.close();}
    const {coverCrop:omitted,...legacy}=saved;
    const edited=(await (await call('PUT',{...legacy,title:'修改标题'},saved.id)).json()).item;assert.deepEqual(edited.coverCrop,crop);
    const patched=(await (await call('PATCH',{category:'工作'},saved.id)).json()).item;assert.deepEqual(patched.coverCrop,crop);
    const other=store.addAsset({name:'other.png',mime:'image/png',size:8,category:'日常'});
    const changed=(await (await call('PUT',{...legacy,assetId:other.id},saved.id)).json()).item;assert.equal(changed.coverCrop,undefined);
    const cleared=(await (await call('PUT',{...input,coverCrop:null},saved.id)).json()).item;assert.equal(cleared.coverCrop,undefined);
  }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
