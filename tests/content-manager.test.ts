import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Space} from '../src/components/space';
import {DEFAULT_PROFILE} from '../src/lib/types';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {itemsApi} from '../src/lib/api/items';
import {handleErrors,newToken} from '../src/lib/http';
import type {Item} from '../src/lib/types';

const article={summary:'短摘要',kicker:'',series:'',spoiler:false,coverPosition:'center',facts:[],quote:''};
const base={kind:'moment',title:'观影笔记',body:'未完成的感受',visibility:'public',tags:['电影'],category:'电影',url:'',assetId:null,article,writingType:'review',status:'draft',pinned:false};
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-manager-'));const store=new Store(directory);
  const token=newToken();store.createSession(token,Date.now()+60000);const origin='http://localhost:3000';
  const call=(path:string,method='GET',body?:unknown,owner=true,requestOrigin=origin)=>withRuntime(store,{appUrl:origin},()=>handleErrors(()=>itemsApi(new Request(`${origin}/api/${path}`,{method,headers:{origin:requestOrigin,...owner?{cookie:`world-session=${token}`}:{}} ,body:body===undefined?undefined:JSON.stringify(body)}),path.split('/'))));
  return {store,call,directory,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}

test('saved drafts persist but their records, photos, likes and statistics remain private until published',async()=>{
  const f=fixture();try{
    const asset=f.store.addAsset({name:'draft.png',mime:'image/png',size:8,category:'日记'});
    const response=await f.call('items','POST',{...base,assetId:asset.id});assert.equal(response.status,201);
    const row=(await response.json()).item;assert.equal(row.status,'draft');assert.equal(row.writingType,'review');
    const reopened=new Store(f.directory);try{assert.equal(reopened.getItem(row.id)?.status,'draft');}finally{reopened.close();}
    assert.equal((await f.call(`items/${row.id}`,'GET',undefined,false)).status,404);
    assert.equal(f.store.listItems(false).length,0);assert.equal(f.store.isPublicAsset(asset.id),false);assert.equal(f.store.assetInUse(asset.id),true);
    assert.deepEqual(f.store.getLikes([row.id],'visitor','2026-10-03',false),{});
    assert.equal(f.store.addDailyLike(row.id,'visitor','2026-10-03',false),false);
    assert.equal(f.store.getStatistics('2026-10-03').content.moments,0);
    const published=await f.call(`items/${row.id}`,'PATCH',{status:'published',pinned:true});assert.equal(published.status,200);
    assert.equal(f.store.listItems(false).length,1);assert.equal(f.store.isPublicAsset(asset.id),true);
    assert.equal(f.store.getStatistics('2026-10-03').content.moments,1);
    assert.equal((await f.call(`items/${row.id}`,'PATCH',{status:'draft'})).status,200);
    assert.equal(f.store.getItem(row.id,false),null);assert.equal(f.store.isPublicAsset(asset.id),false);
  }finally{f.close();}
});

test('legacy edits preserve publication, pin and review type while management patches leave body and photos intact',async()=>{
  const f=fixture();try{
    const row=(await (await f.call('items','POST',{...base,status:'published',pinned:true})).json()).item;
    const {status,pinned,writingType,...legacy}=row;
    const updated=await f.call(`items/${row.id}`,'PUT',{...legacy,title:'改标题'});assert.equal(updated.status,200);
    const saved=(await updated.json()).item;assert.equal(saved.status,'published');assert.equal(saved.pinned,true);assert.equal(saved.writingType,'review');
    const patched=(await (await f.call(`items/${row.id}`,'PATCH',{category:'韩剧',visibility:'private'})).json()).item;
    assert.equal(patched.body,base.body);assert.deepEqual(patched.article,article);assert.equal(patched.writingType,'review');assert.equal(patched.category,'韩剧');
  }finally{f.close();}
});

test('management patches require owner and origin and reject malformed or unrelated fields',async()=>{
  const f=fixture();try{
    const row=(await (await f.call('items','POST',base)).json()).item;
    assert.equal((await f.call(`items/${row.id}`,'PATCH',{status:'published'},false)).status,401);
    assert.equal((await f.call(`items/${row.id}`,'PATCH',{status:'published'},true,'https://evil.test')).status,403);
    for(const change of [{status:'wrong'},{pinned:'yes'},{visibility:'wrong'},{category:'a'.repeat(41)},{body:'overwrite'},{}])assert.equal((await f.call(`items/${row.id}`,'PATCH',change)).status,400);
    for(const change of [{status:'wrong'},{status:['draft']},{visibility:['public']},{pinned:'yes'},{writingType:'wrong'},{writingType:['review']}])assert.equal((await f.call('items','POST',{...base,...change})).status,400);
    const daily=(await (await f.call('items','POST',{...base,article:null,writingType:undefined,status:'published'})).json()).item;
    assert.equal((await f.call(`items/${daily.id}`,'PATCH',{pinned:true})).status,400);
    assert.equal(f.store.getItem(row.id)?.status,'draft');
  }finally{f.close();}
});

test('content filters separate review type from category and use inclusive Shanghai dates',async()=>{
  const module=await import('../src/lib/content-management').catch(()=>null);assert.ok(module?.filterManagedContent,'管理筛选尚未实现');
  const row={...base,id:'review',createdAt:'2026-10-02T17:00:00Z',updatedAt:'2026-10-03T00:00:00Z'} as unknown as Item;
  const rows=[row,{...row,id:'article',writingType:'article',category:'工作',status:'published'},{...row,id:'daily',article:null,writingType:undefined},{...row,id:'legacy',writingType:undefined,category:'读后感'},{...row,id:'collection',kind:'collection'}] as Item[];
  assert.equal(module.managedContentType(row),'review');
  assert.deepEqual(module.filterManagedContent(rows,{type:'review',from:'2026-10-03',to:'2026-10-03'}).map(item=>item.id).sort(),['legacy','review']);
  assert.equal(module.filterManagedContent(rows,{type:'review',from:'2026-10-04'}).length,0);
  assert.equal(module.filterManagedContent(rows,{type:'review',query:'观影',category:'电影',visibility:'public',status:'draft'}).length,1);
});

test('homepage pins published articles before recent ones without exposing drafts or private records',async()=>{
  const module=await import('../src/lib/content-management').catch(()=>null);assert.ok(module?.homepageArticles,'首页置顶尚未实现');
  const row={...base,id:'recent',status:'published',writingType:'article',createdAt:'2026-10-03T00:00:00Z',updatedAt:''} as unknown as Item;
  const rows=[row,{...row,id:'pinned',pinned:true,createdAt:'2026-01-01T00:00:00Z'},{...row,id:'draft',status:'draft',pinned:true},{...row,id:'private',visibility:'private',pinned:true},{...row,id:'daily',article:null,pinned:true}] as Item[];
  assert.deepEqual(module.homepageArticles(rows,false).map(item=>item.id),['pinned','recent']);
  assert.ok(module.homepageArticles(rows,true).some(item=>item.id==='private'));
  assert.ok(!module.homepageArticles(rows,true).some(item=>item.id==='draft'));
});


test('management entry and interface appear only for the owner and retain the site header',()=>{
  const props={initialItems:[],initialProfile:DEFAULT_PROFILE,configured:true,initialView:'content' as const};
  const guest=renderToStaticMarkup(createElement(Space,{...props,initialOwner:false}));
  assert.doesNotMatch(guest,/站主内容管理中心|title="内容管理"/);
  const owner=renderToStaticMarkup(createElement(Space,{...props,initialOwner:true}));
  assert.match(owner,/站主内容管理中心/);assert.match(owner,/title="内容管理" aria-current="page"/);
  assert.match(owner,/写文章/);assert.match(owner,/写观后感/);assert.match(owner,/记小事/);
  assert.equal((owner.match(/aria-label="小屋导航"/g)||[]).length,1);
});

test('saved editor caches restore draft status, pin setting and review identity independently of category',async()=>{
  const module=await import('../src/lib/editor-draft');const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const config={...article,coverPosition:'center' as const};
  const draft={...module.initialEditorDraft('moment'),category:'韩剧',article:config,articleMode:true,writingType:'review' as const,status:'draft' as const,pinned:true};
  module.writeEditorDraft(storage,'moment','new-review',draft);
  assert.deepEqual(module.readEditorDraft(storage,'moment','new-review'),draft);
  assert.equal(module.readEditorDraft(storage,'moment','new-article'),null);
});
