import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Iris} from '../src/components/iris';
import {Editor} from '../src/components/editor';
import {newArticle} from '../src/lib/articles';
import type {Item} from '../src/lib/types';
import {readIrisBlogWorkspace} from '../src/lib/iris-blog-workspace';
import {IrisBlogPreview} from '../src/components/iris-blog-preview';
import {ItemGallery} from '../src/components/item-gallery';
import {manualBlogDraft} from '../src/lib/iris-blog';
import {IrisBlogAssistant} from '../src/components/iris-blog-assistant';

const candidate:Item={id:'00000000-0000-0000-0000-000000000001',kind:'moment',title:'Iris 整理的故事',body:'这是待确认的正文。',category:'日常',tags:['散步'],url:'',assetId:null,images:[],article:{...newArticle(),summary:'一段预览摘要。'},status:'draft',visibility:'public',createdAt:'2026-10-06',updatedAt:'2026-10-06'};

test('manual publishing preserves original text and image layout without requiring Iris',()=>{
 const photo={id:'00000000-0000-4000-8000-000000000002',name:'图片.png',mime:'image/png'};const document={...photo,id:'00000000-0000-4000-8000-000000000003',name:'笔记.pdf',mime:'application/pdf'};
 const body=`我自己写的正文\n\n![](/api/files/${photo.id}?inline=1 "article-50-right")\n\n不需要模型改写。`;
 for(const type of ['article','moment'] as const){const draft=manualBlogDraft(body,type,[photo,document]);assert.equal(draft.body,body);assert.equal(draft.title,'我自己写的正文');assert.deepEqual(draft.images,[{assetId:photo.id}]);assert.equal(draft.status,'draft');assert.equal(!!draft.article,type==='article');}
 const html=renderToStaticMarkup(createElement(IrisBlogAssistant,{online:false}));assert.match(html,/>直接编辑并发布<\/button>/);assert.match(html,/仍可直接编辑发布或保存草稿/);
});

test('the Iris page offers a blog writing composer alongside ordinary chat',()=>{
  const html=renderToStaticMarkup(createElement(Iris));
  assert.match(html,/让 Iris 帮我写博客/);assert.match(html,/整理成预览/);
  assert.match(html,/aria-label="上传写作素材"/);assert.match(html,/aria-label="给 Iris 的问题"/);
  assert.match(html,/contentEditable="true"|contentEditable="false"/);assert.match(html,/粘贴截图或拖入图片/);
});

test('daily inline photos render between text without a duplicate photo gallery',()=>{
 const id='00000000-0000-4000-8000-000000000002';const daily={...candidate,article:null,images:[{assetId:id}],assetId:id,body:`开头\n\n![配图](/api/files/${id}?inline=1)\n\n结尾`};
 const html=renderToStaticMarkup(createElement(IrisBlogPreview,{candidate:daily,onEdit:()=>{},onDiscard:()=>{}}));
 assert.ok(html.indexOf('开头')<html.indexOf('data-article-image'));assert.ok(html.indexOf('data-article-image')<html.indexOf('结尾'));assert.doesNotMatch(html,/class="iris-blog-photos"/);
 assert.equal(renderToStaticMarkup(createElement(ItemGallery,{item:daily})), '');
 const editor=renderToStaticMarkup(createElement(Editor,{kind:'moment',assistantDraft:daily,onClose:()=>{},onSaved:()=>{}}));assert.match(editor,/data-article-image=/);
});

test('the assistant editor starts from the generated candidate and requires a publish action',()=>{
  const html=renderToStaticMarkup(createElement(Editor,{kind:'moment',assistantDraft:candidate,onClose:()=>{},onSaved:()=>{}} as Parameters<typeof Editor>[0]));
  assert.match(html,/value="Iris 整理的故事"/);assert.match(html,/这是待确认的正文。/);
  assert.match(html,/预览并发布内容/);assert.match(html,/确认发布文章/);assert.match(html,/保存草稿/);
  assert.match(html,/value="散步"/);
  assert.match(html,/role="region" aria-label="正文预览"/);
  assert.match(html,/<p>这是待确认的正文。<\/p>/);
  assert.match(html,/返回编辑/);
  assert.match(html,/让 Iris 继续改稿/);assert.match(html,/aria-label="告诉 Iris 怎么改"/);
});

test('regular writing keeps its existing title and controls',()=>{
  const html=renderToStaticMarkup(createElement(Editor,{kind:'moment',initialArticle:true,onClose:()=>{},onSaved:()=>{}}));
  assert.match(html,/写下自己的故事/);assert.doesNotMatch(html,/确认发布文章/);
  assert.doesNotMatch(html,/aria-label="正文预览"/);
  assert.doesNotMatch(html,/让 Iris 继续改稿/);
});

test('returning to Iris restores the candidate and its independent editor draft key',()=>{
  const snapshot=JSON.stringify({version:1,message:'待继续的整理要求',type:'article',materials:[],candidate});
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{sessionStorage:{getItem:(key:string)=>key==='little-world-iris-blog:v1'?snapshot:null,setItem:()=>{},removeItem:()=>{}}}});
  try{
    const restored=readIrisBlogWorkspace(window.sessionStorage);assert.equal(restored?.message,'待继续的整理要求');assert.equal(restored?.candidate?.id,candidate.id);
    const html=renderToStaticMarkup(createElement(Editor,{kind:'moment',assistantDraft:restored!.candidate!,onClose:()=>{},onSaved:()=>{}}));assert.match(html,/Iris 整理的故事/);assert.match(html,/确认发布文章/);
  }finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
