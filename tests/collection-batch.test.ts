import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {ItemInput} from '../src/lib/types';

const batch=await import('../src/lib/collection-batch').catch(()=>null);

test('batch creates one single-image collection per file, preserving order and dimensions',async()=>{
  assert.ok(batch,'collection batch processing is not implemented');
  const photos=[0,1,2].map(index=>({key:String(index),title:`照片 ${index+1}`,file:new File(['photo'],`${index}.png`),previewUrl:'',state:'ready' as const}));
  const saved:ItemInput[]=[];
  const result=await batch.saveCollectionBatch(photos,{category:'旅行',tags:['周末'],visibility:'private'}, {
    upload:async()=>({assetId:randomUUID(),width:800,height:600}),
    save:async input=>{saved.push(input);},onUpdate:()=>{},
  });
  assert.equal(saved.length,3);assert.equal(result.saved,3);assert.equal(result.failed,0);
  assert.deepEqual(saved.map(input=>input.title),['照片 1','照片 2','照片 3']);
  assert.ok(saved.every(input=>input.kind==='collection'&&input.assetId&&input.images===undefined&&input.imageWidth===800&&input.imageHeight===600));
  assert.ok(saved.every(input=>input.visibility==='private'&&input.category==='旅行'));
});

test('retry keeps completed cards and reuses uploaded photos after a save failure',async()=>{
  assert.ok(batch,'collection batch processing is not implemented');
  const photos=[0,1,2].map(index=>({key:String(index),title:`照片 ${index+1}`,file:new File(['photo'],`${index}.png`),previewUrl:'',state:'ready' as const}));
  let uploads=0;let fail=true;const saved:string[]=[];
  const operations={
    upload:async()=>{uploads++;return {assetId:randomUUID()};},
    save:async(input:{title:string})=>{if(input.title==='照片 2'&&fail)throw new Error('暂时无法保存');saved.push(input.title);},onUpdate:()=>{},
  };
  const first=await batch.saveCollectionBatch(photos,{category:'音乐',tags:[],visibility:'private'},operations);
  assert.deepEqual(saved,['照片 1','照片 3']);assert.equal(first.failed,1);
  assert.equal(first.entries[1].state,'failed');assert.ok(first.entries[1].uploaded);
  fail=false;
  const second=await batch.saveCollectionBatch(first.entries,{category:'音乐',tags:[],visibility:'private'},operations);
  assert.equal(uploads,3);assert.deepEqual(saved,['照片 1','照片 3','照片 2']);assert.equal(second.failed,0);assert.equal(second.created,1);
});
