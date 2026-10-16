import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Item} from '../src/lib/types';
const management=await import('../src/lib/collection-management').catch(()=>null);
const entries:Item[]=['first','second'].map(id=>({id,kind:'collection',title:id,body:'保留说明',tags:['K-pop'],category:'Jisoo',url:'https://example.com',assetId:id,visibility:'private',createdAt:'2026-10-02',updatedAt:'2026-10-02'}));

test('bulk category edit preserves each photo, title and other metadata',async()=>{
  assert.ok(management,'collection management is not implemented');const saved:Item[]=[];
  const result=await management.manageCollections(entries,{type:'category',value:'Jennie'},{save:async item=>{saved.push(item);},remove:async()=>{},onProgress:()=>{}});
  assert.equal(result.completed.length,2);assert.equal(result.failed.length,0);
  assert.deepEqual(saved,entries.map(item=>({...item,category:'Jennie'})));
});
test('bulk visibility uses the selected records and returns only failed ids for retry',async()=>{
  assert.ok(management,'collection management is not implemented');const saved:Item[]=[];
  const result=await management.manageCollections(entries,{type:'visibility',value:'public'},{save:async item=>{if(item.id==='second')throw new Error('网络错误');saved.push(item);},remove:async()=>{},onProgress:()=>{}});
  assert.deepEqual(result.completed,['first']);assert.deepEqual(result.failed.map(value=>value.id),['second']);
  assert.deepEqual(saved,[{...entries[0],visibility:'public'}]);
});
test('bulk delete removes selected records without calling save',async()=>{
  assert.ok(management,'collection management is not implemented');const removed:string[]=[];
  const result=await management.manageCollections(entries,{type:'delete'},{save:async()=>{assert.fail('delete must not save');},remove:async id=>{removed.push(id);},onProgress:()=>{}});
  assert.deepEqual(removed,['first','second']);assert.deepEqual(result.completed,removed);
});

test('bulk content tags change types while keeping the person group',async()=>{
  assert.ok(management);const saved:Item[]=[];
  await management.manageCollections(entries,{type:'tags',value:['小卡']},{save:async item=>{saved.push(item);},remove:async()=>{},onProgress:()=>{}});
  assert.ok(saved.every(item=>item.category==='Jisoo'));
  assert.deepEqual(saved.map(item=>item.tags),[['小卡'],['小卡']]);
});
