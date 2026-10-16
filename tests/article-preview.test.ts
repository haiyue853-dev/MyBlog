import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,type FunctionComponent} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Space} from '../src/components/space';
import {ArticleMap} from '../src/components/article-map';
import {Timeline} from '../src/components/timeline';
import {SiteSearch} from '../src/components/site-search';
import {newArticle} from '../src/lib/articles';
import {DEFAULT_PROFILE,type Item} from '../src/lib/types';
const item:Item={id:'88499e97-e6bc-4f2e-8e51-4e53ad1739c5',kind:'moment',title:'观影手记',body:'一段短摘要',tags:[],category:'观后感',writingType:'review',assetId:'88499e97-e6bc-4f2e-8e51-4e53ad1739c6',url:'',visibility:'public',status:'published',createdAt:'2026-10-05T00:00:00Z',updatedAt:'2026-10-05T00:00:00Z',article:{...newArticle(),spoiler:true,coverCrop:{x:75,y:30,zoom:2}}};
const render=<P extends object>(Component:FunctionComponent<P>,props:P)=>renderToStaticMarkup(createElement(Component,props));
test('home and life keep compact text cards and show a spoiler warning before opening',()=>{
  for(const initialView of ['home','life'] as const){
    const html=render(Space,{initialItems:[item],initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true,initialView});
    assert.match(html,/含剧透/);assert.doesNotMatch(html,/aria-label="查看封面并阅读全文|article-preview-cover/);
    const plain=render(Space,{initialItems:[{...item,assetId:null,article:{...newArticle(),spoiler:false}}],initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true,initialView});
    assert.doesNotMatch(plain,/含剧透|查看封面并阅读全文/);
  }
});
test('map, timeline and search warn about spoilers before following article links',()=>{
  const map=render(ArticleMap,{articles:[item],profile:DEFAULT_PROFILE,embedded:true});assert.match(map,/含剧透/);assert.doesNotMatch(map,/查看封面并阅读全文|article-preview-cover/);
  assert.match(render(Timeline,{items:[item],profile:DEFAULT_PROFILE,owner:false,embedded:true}),/含剧透/);
  assert.match(render(SiteSearch,{items:[item],owner:false,filters:{query:'观影',type:'all'},onFiltersChange(){},onOpen(){},onClose(){}}),/含剧透/);
});
