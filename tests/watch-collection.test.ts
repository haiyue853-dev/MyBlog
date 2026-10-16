import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {itemsApi} from '../src/lib/api/items';
import {handleErrors,newToken} from '../src/lib/http';
import {newArticle} from '../src/lib/articles';
import {initialEditorDraft,readEditorDraft,writeEditorDraft} from '../src/lib/editor-draft';
import type {Item} from '../src/lib/types';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WatchFields} from '../src/components/watch-fields';
import {WatchDetails,WatchLibrary} from '../src/components/watch-library';
import {searchSite} from '../src/lib/site-search';

const watch=await import('../src/lib/watch-collection').catch(()=>null);
const drafts=await import('../src/lib/editor-draft');
const config={type:'韩剧',state:'watching',rating:8.5,episodes:16,watched:4,year:'2026',reviewId:null};
const base={kind:'collection',title:'一部韩剧',body:'喜欢这段故事',category:'韩剧',tags:['爱情'],url:'',assetId:null,visibility:'public'};
test('completed dramas need no episode fields and never show unstarted progress',()=>{
  for(const progress of [{episodes:null,watched:0},{episodes:16,watched:16}]){
    const completed={...config,...progress,state:'completed' as const,type:'韩剧' as const};
    const item={...base,id:'completed',createdAt:'',updatedAt:'',kind:'collection',visibility:'public',watch:completed} as Item;
    const fields=renderToStaticMarkup(createElement(WatchFields,{value:completed,onChange:()=>{},reviews:[],disabled:false}));
    assert.doesNotMatch(fields,/aria-label="总集数"|aria-label="看到第几集"/);
    const card=renderToStaticMarkup(createElement(WatchLibrary,{items:[item],owner:false,onAdd:()=>{},onEdit:()=>{},onRemove:()=>{},onOpen:()=>{}}));
    assert.match(card,/state-completed/);assert.doesNotMatch(card,/未开始|screen-progress/);
    const details=renderToStaticMarkup(createElement(WatchDetails,{item,items:[],owner:false}));
    assert.doesNotMatch(details,/集数待定|看到第|共 16 集/);
  }
});
test('watching dramas still allow episode tracking and show saved progress',()=>{
  const watching={...config,state:'watching' as const,type:'韩剧' as const};
  const item={...base,id:'watching',createdAt:'',updatedAt:'',kind:'collection',visibility:'public',watch:watching} as Item;
  const fields=renderToStaticMarkup(createElement(WatchFields,{value:watching,onChange:()=>{},reviews:[],disabled:false}));
  assert.match(fields,/aria-label="总集数"/);assert.match(fields,/aria-label="看到第几集"/);
  const card=renderToStaticMarkup(createElement(WatchLibrary,{items:[item],owner:false,onAdd:()=>{},onEdit:()=>{},onRemove:()=>{},onOpen:()=>{}}));
  assert.match(card,/已看 4/);assert.match(card,/16 集/);assert.match(card,/screen-progress/);
});
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-watch-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);const origin='http://localhost:3000';
  const call=(path:string,method='GET',body?:unknown,owner=true)=>withRuntime(store,{appUrl:origin},()=>handleErrors(()=>itemsApi(new Request(`${origin}/api/${path}`,{method,headers:{origin,...(owner?{cookie:`world-session=${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)}),path.split('/'))));
  return {store,directory,call,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}
test('collection introductions are owner-only in page data, APIs and search',async()=>{
  const f=fixture();try{
    for(const extra of [{watch:config},{}]){
      const response=await f.call('items','POST',{...base,body:'结局剧透专用标记',...extra});assert.equal(response.status,201);
      const item=(await response.json()).item as Item;
      assert.equal(item.body,'结局剧透专用标记');
      assert.equal(f.store.listItems(false).find(entry=>entry.id===item.id)?.body,'');
      assert.equal(f.store.getItem(item.id,false)?.body,'');
      const guestDetail=await f.call(`items/${item.id}`,'GET',undefined,false);
      assert.doesNotMatch(await guestDetail.text(),/结局剧透专用标记/);
      assert.equal(searchSite([item],false,{query:'结局剧透专用标记',type:'all'}).total,0);
      assert.equal(searchSite([item],true,{query:'结局剧透专用标记',type:'all'}).total,1);
      const byTitle=searchSite([item],false,{query:item.title,type:'all'}).results[0];
      assert.equal(byTitle.item.body,'');assert.equal(byTitle.excerpt,'');
      if(item.watch)assert.equal(watch!.filterScreenCollections(watch!.screenCollections([item],false),{type:'全部',state:'全部',query:'结局剧透专用标记'}).length,0);
      assert.equal((await (await f.call(`items/${item.id}`)).json()).item.body,item.body);
      assert.equal(f.store.listItems(true).find(entry=>entry.id===item.id)?.body,item.body);
    }
    assert.doesNotMatch(await (await f.call('items','GET',undefined,false)).text(),/结局剧透专用标记/);
    const daily=(await (await f.call('items','POST',{...base,kind:'moment',body:'公开日常文字'})).json()).item;
    assert.equal(f.store.getItem(daily.id,false)?.body,'公开日常文字');
  }finally{f.close();}
});
test('watch config validates scores and episode progress without inventing a rating',()=>{
  assert.ok(watch,'watch collections are not implemented');
  assert.deepEqual(watch.parseWatchConfig(config),config);
  assert.equal(watch.newWatch().rating,null);
  for(const update of [{rating:11},{rating:NaN},{watched:17},{watched:-1},{episodes:0},{episodes:1.5},{state:'unknown'},{type:'unknown'},{year:'bad'},{reviewId:'bad'}])assert.equal(watch.parseWatchConfig({...config,...update}),null);
  assert.ok(watch.parseWatchConfig({...config,rating:0,episodes:null,watched:4,year:''}));
});
test('screen filters and statistics exclude small cards and private titles for visitors',()=>{
  assert.ok(watch);
  const entries=[
    {...base,id:'one',createdAt:'',updatedAt:'',watch:config},
    {...base,id:'two',createdAt:'',updatedAt:'',title:'看完的电影',watch:{...config,type:'电影',state:'completed',rating:null}},
    {...base,id:'three',createdAt:'',updatedAt:'',visibility:'private',watch:{...config,rating:2}},
    {...base,id:'card',createdAt:'',updatedAt:'',tags:['小卡']},
  ] as Item[];
  const publicItems=watch.screenCollections(entries,false);assert.equal(publicItems.length,2);
  assert.deepEqual(watch.watchStatistics(publicItems),{total:2,completed:1,watching:1,planned:0,rated:1,average:8.5});
  assert.equal(watch.filterScreenCollections(publicItems,{type:'韩剧',state:'watching',query:'爱情'}).length,1);
  assert.equal(watch.filterScreenCollections(publicItems,{type:'全部',state:'completed',query:'电影'}).length,1);
  assert.equal(watch.screenCollections(entries,true).length,3);
});
test('watch items save, reopen, edit and preserve old collection data',async()=>{
  const f=fixture();try{
    const response=await f.call('items','POST',{...base,watch:config});assert.equal(response.status,201);
    const item=(await response.json()).item;assert.deepEqual(item.watch,config);
    assert.deepEqual((await (await f.call(`items/${item.id}`)).json()).item.watch,config);
    const edited=(await (await f.call(`items/${item.id}`,'PUT',{...item,watch:{...config,state:'completed',watched:16}})).json()).item;assert.equal(edited.watch.watched,16);
    assert.equal(edited.watch.state,'completed');
    const legacy=(await (await f.call('items','POST',{...base,category:'jisoo',tags:['小卡']})).json()).item;assert.equal(legacy.watch,undefined);
    assert.equal((await f.call('items','POST',{...base,watch:{...config,watched:100}})).status,400);
    assert.equal((await f.call('items','POST',{...base,kind:'moment',watch:config})).status,400);
  }finally{f.close();}
});
test('watch review links are validated and private or removed reviews are hidden from visitors',async()=>{
  const f=fixture();try{
    const review=(await (await f.call('items','POST',{...base,kind:'moment',article:newArticle(),writingType:'review',visibility:'private'})).json()).item;
    const response=await f.call('items','POST',{...base,watch:{...config,reviewId:review.id}});assert.equal(response.status,201);const item=(await response.json()).item;
    assert.equal(item.watch.reviewId,review.id);
    assert.equal(f.store.listItems(false).find(entry=>entry.id===item.id)?.watch?.reviewId,null);
    assert.equal((await (await f.call(`items/${item.id}`,'GET',undefined,false)).json()).item.watch.reviewId,null);
    await f.call(`items/${review.id}`,'PUT',{...review,visibility:'public'});
    assert.equal((await (await f.call(`items/${item.id}`,'GET',undefined,false)).json()).item.watch.reviewId,review.id);
    f.store.trashItem(review.id);
    const publicItems=(await (await f.call('items','GET',undefined,false)).json()).items;
    assert.equal(publicItems.find((entry:Item)=>entry.id===item.id).watch.reviewId,null);
    assert.equal((await f.call('items','POST',{...base,watch:{...config,reviewId:crypto.randomUUID()}})).status,400);
  }finally{f.close();}
});
test('watch drafts retain metadata and old drafts without watch still restore',()=>{
  const memory=new Map<string,string>();const storage={getItem:(key:string)=>memory.get(key)||null,setItem:(key:string,value:string)=>{memory.set(key,value);},removeItem:(key:string)=>{memory.delete(key);}};
  const original=initialEditorDraft('collection');assert.equal(writeEditorDraft(storage,'collection','film',{...original,watch:config} as typeof original),true);
  assert.deepEqual((readEditorDraft(storage,'collection','film') as unknown as {watch:unknown})?.watch,config);
  assert.equal(writeEditorDraft(storage,'collection','old',original),true);assert.ok(readEditorDraft(storage,'collection','old'));
});
test('unchanged watch drafts do not trigger a close warning because of field order',()=>{
  const changed=(drafts as unknown as {editorDraftChanged?:(original:unknown,next:unknown)=>boolean}).editorDraftChanged;
  assert.ok(changed,'draft changes must compare field values');
  const original={...initialEditorDraft('collection'),watch:config};
  const reordered={watch:config,...initialEditorDraft('collection')};
  assert.equal(changed(original,reordered),false);
  assert.equal(changed(original,{...reordered,watch:{...config,watched:5}}),true);
  assert.equal(changed(original,{...reordered,body:'  内容缩进'}),true);
});

test('public watch synopses survive saving, guest APIs and search while personal feelings stay private',async()=>{
  const f=fixture();try{
    const synopsis='摄影师重返海岛家乡，与青梅竹马再次相遇。';
    const synopsisSource='https://www.netflix.com/sg-zh/title/81697983';
    const response=await f.call('items','POST',{...base,body:'私人感受保密标记',watch:{...config,synopsis,synopsisSource}});
    assert.equal(response.status,201);
    const saved=(await response.json()).item as Item;
    assert.equal(saved.watch?.synopsis,synopsis);
    for(const item of [f.store.getItem(saved.id,false),(await (await f.call(`items/${saved.id}`,'GET',undefined,false)).json()).item,(await (await f.call('items','GET',undefined,false)).json()).items.find((item:Item)=>item.id===saved.id)]){
      assert.equal(item.body,'');assert.equal(item.watch.synopsis,synopsis);assert.equal(item.watch.synopsisSource,synopsisSource);
    }
    assert.equal(f.store.getItem(saved.id,true)?.body,'私人感受保密标记');
    assert.equal(searchSite([saved],false,{query:'海岛家乡',type:'all'}).total,1);
    assert.equal(searchSite([saved],false,{query:'私人感受保密标记',type:'all'}).total,0);
    assert.equal(watch!.filterScreenCollections(watch!.screenCollections([saved],false),{type:'全部',state:'全部',query:'海岛家乡'}).length,1);
  }finally{f.close();}
});

test('synopsis fields validate and survive restoring editor drafts without changing legacy feelings',()=>{
  const synopsis='公开的剧情简介';const synopsisSource='https://www.netflix.com/title/81697983';
  const configWithSynopsis={...config,synopsis,synopsisSource};
  assert.deepEqual(watch!.parseWatchConfig(configWithSynopsis),configWithSynopsis);
  for(const update of [{synopsis:123},{synopsis:'长'.repeat(3001)},{synopsisSource:'javascript:alert(1)'},{synopsisSource:42},{synopsisSource:'https://example.com/'+ 'a'.repeat(2000)}])assert.equal(watch!.parseWatchConfig({...config,...update}),null);
  const memory=new Map<string,string>();const storage={getItem:(key:string)=>memory.get(key)||null,setItem:(key:string,value:string)=>{memory.set(key,value);},removeItem:(key:string)=>{memory.delete(key);}};
  const draft={...initialEditorDraft('collection'),watch:configWithSynopsis,body:'原来的个人感受'};
  assert.equal(writeEditorDraft(storage,'collection','separate-prose',draft as ReturnType<typeof initialEditorDraft>),true);
  const restored=readEditorDraft(storage,'collection','separate-prose');
  assert.equal(restored?.watch?.synopsis,synopsis);assert.equal(restored?.body,'原来的个人感受');
  assert.deepEqual(watch!.parseWatchConfig(config),config);
});

test('watch details show the synopsis to visitors and label feelings only for the owner',()=>{
  const item={...base,id:'separate-prose',createdAt:'',updatedAt:'',body:'只有我知道的感受',watch:{...config,synopsis:'海岛上的重逢故事',synopsisSource:'https://www.netflix.com/title/81697983'}} as Item;
  const guest=renderToStaticMarkup(createElement(WatchDetails,{item,items:[],owner:false}));
  assert.match(guest,/简介/);assert.match(guest,/海岛上的重逢故事/);assert.doesNotMatch(guest,/只有我知道的感受|个人感受/);
  const owner=renderToStaticMarkup(createElement(WatchDetails,{item,items:[],owner:true}));
  assert.match(owner,/个人感受/);assert.match(owner,/仅自己可见/);assert.match(owner,/只有我知道的感受/);
  const fields=renderToStaticMarkup(createElement(WatchFields,{value:item.watch!,onChange:()=>{},reviews:[],disabled:false}));
  assert.match(fields,/aria-label="简介"/);assert.match(fields,/海岛上的重逢故事/);
});

test('editing an old watch draft preserves researched synopsis unless explicitly cleared',async()=>{
  const f=fixture();try{
    const synopsis='网上整理的简介';const synopsisSource='https://www.netflix.com/title/81697983';
    const saved=(await (await f.call('items','POST',{...base,watch:{...config,synopsis,synopsisSource}})).json()).item;
    const edited=(await (await f.call(`items/${saved.id}`,'PUT',{...saved,body:'修改后的个人感受',watch:{...config,rating:9}})).json()).item;
    assert.equal(edited.watch.synopsis,synopsis);assert.equal(edited.watch.synopsisSource,synopsisSource);assert.equal(edited.body,'修改后的个人感受');
    const cleared=(await (await f.call(`items/${saved.id}`,'PUT',{...edited,watch:{...edited.watch,synopsis:'',synopsisSource:''}})).json()).item;
    assert.equal(cleared.watch.synopsis,'');assert.equal(cleared.watch.synopsisSource,'');
  }finally{f.close();}
});
