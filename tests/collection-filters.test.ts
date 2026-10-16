import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Item} from '../src/lib/types';
const filters=await import('../src/lib/collection-filters').catch(()=>null);
const items:Item[]=[['Jisoo','小卡'],['Jisoo','电影'],['Jennie','小卡'],['韩剧','韩剧']].map(([category,tag],index)=>({id:String(index),kind:'collection',title:`收藏 ${index}`,body:'',tags:[tag],category,url:'',assetId:null,visibility:'private',createdAt:'2026-10-02',updatedAt:'2026-10-02'}));
test('person and content-tag filters combine without matching a person name as a type',()=>{
  assert.ok(filters,'collection filters are not implemented');
  assert.deepEqual(filters.filterCollections(items,{group:'Jisoo',tag:'小卡',query:''}).map(item=>item.id),['0']);
  assert.deepEqual(filters.filterCollections(items,{group:'全部',tag:'小卡',query:''}).map(item=>item.id),['0','2']);
  assert.deepEqual(filters.filterCollections(items,{group:'Jisoo',tag:'全部',query:''}).map(item=>item.id),['0','1']);
  assert.deepEqual(filters.filterCollections(items,{group:'Jisoo',tag:'电影',query:'收藏 1'}).map(item=>item.id),['1']);
});
