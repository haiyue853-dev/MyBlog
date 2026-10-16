import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {Item} from '../src/lib/types';
import * as watch from '../src/lib/watch-collection';
import {WatchLibrary} from '../src/components/watch-library';

const tagInput=await import('../src/components/watch-tag-input').catch(()=>null);
const metadata={type:'韩剧' as const,state:'completed' as const,rating:null,episodes:null,watched:0,year:'',reviewId:null};
const base:Item={id:'one',kind:'collection',title:'一部剧',body:'私人感受',category:'韩剧',tags:['爱情','悬疑'],url:'',assetId:null,visibility:'public',createdAt:'',updatedAt:'',watch:metadata};

test('genre selection toggles without duplicating tags and retains custom entries',()=>{
  assert.ok(watch.WATCH_TAGS&&watch.toggleWatchTag,'影视标签多选尚未实现');
  assert.ok(watch.WATCH_TAGS.includes('爱情'));assert.ok(watch.WATCH_TAGS.includes('悬疑'));
  assert.equal(watch.toggleWatchTag('爱情，自己起的标签','悬疑'),'爱情，自己起的标签，悬疑');
  assert.equal(watch.toggleWatchTag('爱情，自己起的标签，悬疑','爱情'),'自己起的标签，悬疑');
  assert.equal(watch.toggleWatchTag(' 爱情,爱情，治愈 ','悬疑'),'爱情，治愈，悬疑');
  const ten=Array.from({length:10},(_,index)=>`标签${index}`).join('，');
  assert.equal(watch.toggleWatchTag(ten,'悬疑'),ten);
  assert.equal(watch.toggleWatchTag(ten,'标签0').split('，').length,9);
});

test('genre picker labels selected tags and allows custom tags',()=>{
  assert.ok(tagInput?.WatchTagInput,'影视标签选择器尚未实现');
  const html=renderToStaticMarkup(createElement(tagInput.WatchTagInput,{value:'爱情，自定义',onChange:()=>{}}));
  assert.match(html,/aria-label="标签：爱情" aria-pressed="true"/);
  assert.match(html,/aria-label="标签：悬疑" aria-pressed="false"/);
  assert.match(html,/aria-label="影视标签"/);assert.match(html,/爱情，自定义/);
  const disabled=renderToStaticMarkup(createElement(tagInput.WatchTagInput,{value:'爱情',onChange:()=>{},disabled:true}));
  assert.match(disabled,/<fieldset[^>]*disabled/);
});

test('genre filters combine with title, type and state and exclude private dramas for guests',()=>{
  const items=[base,{...base,id:'two',title:'古装爱情',tags:['爱情','古装'],watch:{...metadata,type:'国产电视剧' as const}},{...base,id:'private',title:'私人校园剧',visibility:'private' as const,tags:['校园']},{...base,id:'not-exact',tags:['爱情喜剧']}];
  const publicItems=watch.screenCollections(items,false);
  assert.deepEqual(watch.filterScreenCollections(publicItems,{type:'全部',state:'全部',query:'',tag:'悬疑'}).map(item=>item.id),['one']);
  assert.equal(watch.filterScreenCollections(publicItems,{type:'全部',state:'全部',query:'',tag:'爱情'}).length,2);
  assert.equal(watch.filterScreenCollections(publicItems,{type:'国产电视剧',state:'completed',query:'古装',tag:'爱情'}).length,1);
  assert.equal(watch.filterScreenCollections(publicItems,{type:'全部',state:'watching',query:'',tag:'爱情'}).length,0);
  assert.equal(watch.filterScreenCollections(publicItems,{type:'全部',state:'全部',query:'',tag:'校园'}).length,0);
  assert.equal(watch.filterScreenCollections(publicItems,{type:'全部',state:'全部',query:'',tag:'全部'}).length,3);
});

test('watch library exposes genre filters and counts only visible titles',()=>{
  const items=[base,{...base,id:'private',visibility:'private' as const,tags:['私密专用标签']}];
  const html=renderToStaticMarkup(createElement(WatchLibrary,{items,owner:false,onAdd:()=>{},onEdit:()=>{},onRemove:()=>{},onOpen:()=>{}}));
  assert.match(html,/aria-label="题材标签筛选"/);
  assert.match(html,/aria-label="筛选影视标签：爱情"/);assert.match(html,/爱情<small>1<\/small>/);
  assert.doesNotMatch(html,/私密专用标签/);
});
