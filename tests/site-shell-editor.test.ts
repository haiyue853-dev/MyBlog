import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Space} from '../src/components/space';
import {TextEditor} from '../src/components/text-editor';
import {RecordBody} from '../src/components/record-body';
import {newArticle} from '../src/lib/articles';
import {DEFAULT_PROFILE,type Item} from '../src/lib/types';
import {readSpaceRoute} from '../src/lib/space-route';

test('direct article reading retains the complete house navigation and only one main landmark',()=>{
  const article:Item={id:'article-id',kind:'moment',title:'测试文章',body:'正文',category:'工作',tags:[],assetId:null,url:'',visibility:'public',createdAt:'2026-10-03',updatedAt:'2026-10-03',article:newArticle()};
  const html=renderToStaticMarkup(createElement(Space,{initialItems:[article],initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true,initialView:'article',initialArticleId:article.id} as Parameters<typeof Space>[0]));
  for(const label of ['主页','生活碎片','时光轴','文章地图','收藏馆','小屋工具','关于我'])assert.ok(html.includes(label),label);
  assert.match(html,/<h1[^>]*>测试文章<\/h1>/);
  assert.doesNotMatch(html,/article-site-header/);
  assert.equal((html.match(/<main\b/g)||[]).length,1);
});
test('heading selection uses the theme combobox instead of a native select',()=>{
  const html=renderToStaticMarkup(createElement(TextEditor,{label:'正文',value:'一段文字',onChange:()=>{}}));
  assert.match(html,/role="combobox"/);assert.match(html,/aria-label="字号与小标题"/);assert.doesNotMatch(html,/<select\b/);
});
test('indented prose preserves spacing and formatting as paragraphs',()=>{
  const html=renderToStaticMarkup(createElement(RecordBody,{body:'    项目总结，**认真记下**。\n\n    下一段也缩进。'}));
  assert.doesNotMatch(html,/<pre\b/);assert.match(html,/<strong>认真记下<\/strong>/);assert.match(html,/<p>[\s\S]*项目总结/);
});
test('explicit fenced code keeps its indentation and code block',()=>{
  const html=renderToStaticMarkup(createElement(RecordBody,{body:'```js\n    console.log("hello");\n```'}));
  assert.match(html,/<pre><code class="language-js">/);assert.match(html,/    console\.log/);
});
test('direct paths and browser history resolve article and filtered map destinations',()=>{
  assert.equal(readSpaceRoute(new URL('http://localhost/posts/article-id'))?.articleId,'article-id');
  const map=readSpaceRoute(new URL('http://localhost/posts?category=工作&series=手记'));
  assert.equal(map?.view,'posts');assert.equal(map?.filters.category,'工作');assert.equal(map?.filters.series,'手记');
  assert.equal(readSpaceRoute(new URL('http://localhost/timeline'))?.view,'timeline');
  assert.equal(readSpaceRoute(new URL('http://localhost/?view=collection'))?.view,'collection');
  assert.equal(readSpaceRoute(new URL('http://localhost/api/files')),null);
});
