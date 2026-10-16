import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CollectionManager} from '../src/components/collection-manager';
import type {Item} from '../src/lib/types';
test('remounted manager keeps actions disabled while a parent batch is still running',()=>{
  const item:Item={id:'selected',kind:'collection',title:'jisoo',body:'',category:'Jisoo',tags:['小卡'],url:'',assetId:null,visibility:'private',createdAt:'2026-10-02',updatedAt:'2026-10-02'};
  const props={items:[item],visibleItems:[item],selectedIds:[item.id],onSelect:()=>{},onDone:()=>{},onSaved:()=>{},onBusyChange:()=>{},externalBusy:true};
  const html=renderToStaticMarkup(createElement(CollectionManager,props));
  for(const button of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g))assert.match(button[1],/disabled/,`action remained enabled: ${button[2]}`);
});
