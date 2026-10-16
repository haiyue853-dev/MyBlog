import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {searchSite,highlightSearchText} from '../src/lib/site-search';
import {SiteSearch} from '../src/components/site-search';
import {Space} from '../src/components/space';
import {newArticle} from '../src/lib/articles';
import {DEFAULT_PROFILE,type Item} from '../src/lib/types';

const item=(id:string,changes:Partial<Item>={}):Item=>({id,kind:'moment',title:'普通记录',body:'一些文字',category:'日常',tags:[],url:'',assetId:null,visibility:'public',createdAt:'2026-10-03T00:00:00Z',updatedAt:'2026-10-03T00:00:00Z',...changes});
const filters=(query:string,type:'all'|'article'|'review'|'daily'|'collection'='all')=>({query,type});

test('searches titles, body, categories, tags and configured summaries across four content types',()=>{
  const rows=[item('title',{title:'旅途照片',article:newArticle()}),item('body',{body:'旅途的风景'}),item('category',{category:'旅途',kind:'collection'}),item('tags',{tags:['旅途'],article:newArticle(),writingType:'review'}),item('summary',{article:{...newArticle(),summary:'旅途记录'}})];
  const result=searchSite(rows,false,filters('旅途'));
  assert.equal(result.total,5);
  assert.deepEqual(result.counts,{all:5,article:2,review:1,daily:1,collection:1,video:0});
  assert.deepEqual(searchSite(rows,false,filters('旅途','review')).results.map(row=>row.item.id),['tags']);
});

test('normalizes full-width and case, requires every search word, and returns no rows for blank queries',()=>{
  const rows=[item('yes',{title:'JISOO 的日常',tags:['小卡']}),item('no',{title:'JISOO 的舞台'})];
  assert.deepEqual(searchSite(rows,false,filters('  ｊｉｓｏｏ　 小卡  ')).results.map(row=>row.item.id),['yes']);
  const empty=searchSite(rows,true,filters('  '));
  assert.equal(empty.total,0);assert.equal(empty.counts.all,0);
});

test('guest filtering applies before matching, excerpts and facet counts; owners see drafts and private content',()=>{
  const rows=[item('public',{title:'共同关键词'}),item('private',{title:'共同关键词 私密',visibility:'private'}),item('draft',{title:'共同关键词 草稿',status:'draft',article:newArticle()}),item('legacy',{title:'共同关键词 旧记录'})];
  const guest=searchSite(rows,false,filters('共同关键词'));
  assert.deepEqual(guest.results.map(row=>row.item.id),['legacy','public']);assert.equal(guest.counts.all,2);assert.equal(guest.counts.article,0);
  assert.equal(searchSite(rows,true,filters('共同关键词')).total,4);
});

test('ranks title matches before metadata and body, then orders equal matches by date and stable id',()=>{
  const rows=[item('body',{body:'一路旅行',createdAt:'2026-10-05'}),item('tag',{tags:['旅行'],createdAt:'2026-10-04'}),item('old-title',{title:'旅行',createdAt:'2026-10-01'}),item('new-title',{title:'旅行',createdAt:'2026-10-03'}),item('a-title',{title:'旅行',createdAt:'2026-10-03'})];
  assert.deepEqual(searchSite(rows,false,filters('旅行')).results.map(row=>row.item.id),['a-title','new-title','old-title','tag','body']);
});

test('excerpts find a late body match and strip formatting, image configuration and link destinations',()=>{
  const row=item('late',{body:'开头文字。'.repeat(80)+'这里是 **海边散步** 的故事。\n\n![照片](/api/files/1320dc68-c437-4f01-b968-e205811d69dc?inline=1 "article-wide")\n[回家](https://private.example)',article:{...newArticle(),summary:'简短介绍'}});
  const result=searchSite([row],false,filters('海边散步'));
  assert.equal(result.total,1);assert.match(result.results[0].excerpt,/海边散步/);
  assert.ok(Array.from(result.results[0].excerpt).length<=114);
  assert.doesNotMatch(result.results[0].excerpt,/api\/files|article-wide|https:|\*\*/);
  assert.equal(searchSite([row],false,filters('private.example')).total,0);
});

test('recognizes legacy reviews and keeps collections in their own type',()=>{
  const rows=[item('legacy',{title:'喜欢',article:newArticle(),category:'读后感'}),item('explicit',{title:'喜欢',article:newArticle(),category:'工作',writingType:'article'}),item('collection',{title:'喜欢',kind:'collection',category:'观后感'})];
  const result=searchSite(rows,false,filters('喜欢'));
  assert.equal(result.counts.review,1);assert.equal(result.counts.article,1);assert.equal(result.counts.collection,1);
});

test('highlighting treats regex characters literally and search renders escaped text with the full shared header',()=>{
  assert.deepEqual(highlightSearchText('学习 C++ 与 [笔记]','C++'),[{text:'学习 ',match:false},{text:'C++',match:true},{text:' 与 [笔记]',match:false}]);
  const rows=[item('safe',{title:'<img src=x onerror=alert(1)>笔记',body:'**笔记** 正文',article:newArticle()}),item('private',{title:'笔记 私密',visibility:'private'})];
  const ui=renderToStaticMarkup(createElement(SiteSearch,{items:rows,owner:false,filters:filters('笔记'),onFiltersChange:()=>{},onOpen:()=>{},onClose:()=>{}}));
  assert.match(ui,/<mark>笔记<\/mark>/);assert.doesNotMatch(ui,/<img src="?x|笔记 私密/);
  assert.match(ui,/id="site-search-popover" role="dialog"/);assert.doesNotMatch(ui,/site-search-intro/);
  const shell=renderToStaticMarkup(createElement(Space,{initialItems:rows.filter(row=>row.visibility==='public'),initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true}));
  for(const label of ['主页','文章地图','小屋工具','关于我','全站搜索'])assert.ok(shell.includes(label),label);
  assert.equal((shell.match(/<main\b/g)||[]).length,1);assert.doesNotMatch(shell,/笔记 私密/);
  assert.match(shell,/welcome-hero/);assert.match(shell,/aria-expanded="false"/);
});

test('empty popup stays as a small input without replacing the current page or showing empty result panels',()=>{
  const ui=renderToStaticMarkup(createElement(SiteSearch,{items:[],owner:false,filters:filters(''),onFiltersChange:()=>{},onOpen:()=>{},onClose:()=>{}}));
  assert.match(ui,/role="search"/);assert.match(ui,/aria-label="搜索全站内容"/);
  assert.doesNotMatch(ui,/<h1|site-search-types|site-search-empty|site-search-results/);
  const shell=renderToStaticMarkup(createElement(Space,{initialItems:[],initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true,initialView:'collection'}));
  assert.match(shell,/aria-expanded="false"/);assert.doesNotMatch(shell,/site-search-popover" role="dialog"/);
});
