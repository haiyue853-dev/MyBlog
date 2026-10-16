import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Item} from '../src/lib/types';

function storage(){
  const values=new Map<string,string>();
  return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
}

test('new writing defaults to public while editing and restoring retain the chosen visibility',async()=>{
  const module=await import('../src/lib/editor-draft');
  assert.equal(module.initialEditorDraft('moment').visibility,'public');
  assert.equal(module.initialEditorDraft('collection').visibility,'private');
  const item:Item={id:'private-writing',kind:'moment',title:'我的记录',body:'正文',category:'工作',tags:[],url:'',assetId:null,visibility:'private',createdAt:'2026-10-03',updatedAt:'2026-10-03'};
  assert.equal(module.initialEditorDraft('moment',item).visibility,'private');
  const store=storage();const draft={...module.initialEditorDraft('moment'),visibility:'private' as const};
  module.writeEditorDraft(store,'moment','new-article',draft);
  assert.equal(module.readEditorDraft(store,'moment','new-article')?.visibility,'private');
});

test('reopening a record restores typed text, visibility, uploaded pictures, cover and order',async()=>{
  const module=await import('../src/lib/editor-draft').catch(()=>null);
  assert.ok(module?.readEditorDraft,'编辑草稿尚未实现');
  const store=storage();
  const original=module.initialEditorDraft('moment');
  const draft={...original,title:'还没写完的周末',body:'第一行\n第二行',tags:'生活，旅行',category:'旅行',url:'',assetId:'photo-2',photos:[{assetId:'photo-1',width:900,height:600},{assetId:'photo-2',width:600,height:900}],visibility:'public' as const};
  assert.equal(module.writeEditorDraft(store,'moment','record-1',draft),true);
  assert.deepEqual(module.readEditorDraft(store,'moment','record-1'),draft);
  assert.equal(module.readEditorDraft(store,'moment','record-2'),null);
  assert.equal(module.readEditorDraft(store,'collection','record-1'),null);
});

test('new-entry drafts and existing-record drafts are separate and only the saved or discarded draft is cleared',async()=>{
  const module=await import('../src/lib/editor-draft').catch(()=>null);
  assert.ok(module?.readEditorDraft,'编辑草稿尚未实现');
  const store=storage();
  const draft={...module.initialEditorDraft('collection',undefined,'Jisoo'),title:'小卡草稿'};
  module.writeEditorDraft(store,'collection',undefined,draft);
  module.writeEditorDraft(store,'collection','existing',draft);
  assert.equal(module.clearEditorDraft(store,'collection','existing'),true);
  assert.equal(module.readEditorDraft(store,'collection','existing'),null);
  assert.deepEqual(module.readEditorDraft(store,'collection'),draft);
});

test('malformed cached data does not break the editor and failed storage writes are reported',async()=>{
  const module=await import('../src/lib/editor-draft').catch(()=>null);
  assert.ok(module?.readEditorDraft,'编辑草稿尚未实现');
  const store=storage();
  store.setItem(module.editorDraftKey('moment'),'{broken');
  assert.equal(module.readEditorDraft(store,'moment'),null);
  store.setItem(module.editorDraftKey('moment'),JSON.stringify({version:1,draft:{title:123}}));
  assert.equal(module.readEditorDraft(store,'moment'),null);
  const blocked={getItem:()=>{throw new Error('unavailable');},setItem:()=>{throw new Error('full');},removeItem:()=>{throw new Error('unavailable');}};
  assert.equal(module.readEditorDraft(blocked,'moment'),null);
  assert.equal(module.writeEditorDraft(blocked,'moment',undefined,module.initialEditorDraft('moment')),false);
  assert.equal(module.clearEditorDraft(blocked,'moment'),false);
});

test('the initial editor draft retains original single-photo sizing and legacy diary attachments',async()=>{
  const module=await import('../src/lib/editor-draft').catch(()=>null);
  assert.ok(module?.initialEditorDraft,'编辑草稿尚未实现');
  const item:Item={id:'card',kind:'collection',title:'Jisoo',body:'喜欢',tags:['小卡'],category:'Jisoo',url:'',assetId:'cover',visibility:'private',cardRatio:'auto',imageWidth:600,imageHeight:900,createdAt:'2026-10-03',updatedAt:'2026-10-03'};
  const collection=module.initialEditorDraft('collection',item);
  assert.deepEqual(collection.imageSize,{width:600,height:900});assert.equal(collection.tags,'小卡');assert.equal(collection.assetId,'cover');
  const moment=module.initialEditorDraft('moment',{...item,kind:'moment'});
  assert.deepEqual(moment.photos,[{assetId:'cover',width:600,height:900}]);
});

test('article cover and facts recover from drafts while older drafts remain compatible',async()=>{
  const module=await import('../src/lib/editor-draft');const store=storage();
  const article={summary:'还没写完的摘要',kicker:'旅行记录',series:'海边手记',spoiler:false,coverPosition:'bottom' as const,facts:[{label:'目的地',value:'海边'}],quote:'慢慢走。'};
  const draft={...module.initialEditorDraft('moment'),article,articleMode:true};
  module.writeEditorDraft(store,'moment','article-1',draft);
  assert.deepEqual(module.readEditorDraft(store,'moment','article-1')?.article,article);
  const paused={...draft,articleMode:false};module.writeEditorDraft(store,'moment','paused',paused);
  assert.deepEqual(module.readEditorDraft(store,'moment','paused'),paused);
  const {article:removed,articleMode:removedMode,...older}=draft;
  store.setItem(module.editorDraftKey('moment','old'),JSON.stringify({version:1,draft:older}));
  assert.deepEqual(module.readEditorDraft(store,'moment','old'),{...older,article:null,articleMode:false});
});
