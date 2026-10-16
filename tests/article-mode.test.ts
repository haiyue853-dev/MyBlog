import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {itemsApi} from '../src/lib/api/items';
import {handleErrors,newToken} from '../src/lib/http';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Space} from '../src/components/space';
import {Editor} from '../src/components/editor';
import {DEFAULT_PROFILE,type Item} from '../src/lib/types';

const article={summary:'只在首页显示这句摘要。',kicker:'观影手记',series:'',spoiler:true,coverPosition:'top' as const,facts:[{label:'导演',value:'自己填写'},{label:'初看',value:'2026 年 10 月'}],quote:'把值得记下的感受收好。'};
const base={kind:'moment',title:'我的观影笔记',body:'## 一个小标题\n\n**喜欢**这一段。',visibility:'private',tags:['电影'],category:'读后感',url:'',assetId:null,article};
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-article-'));const store=new Store(directory);
  const token=newToken();store.createSession(token,Date.now()+60000);const origin='http://localhost:3000';
  const call=(path:string,method='GET',body?:unknown,owner=true)=>withRuntime(store,{appUrl:origin},()=>handleErrors(()=>itemsApi(new Request(`${origin}/api/${path}`,{method,headers:{origin,...(owner?{cookie:`world-session=${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)}),path.split('/'))));
  return {store,call,directory,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}

test('article configuration persists alongside the diary and survives reopening the store',async()=>{
  const f=fixture();try{
    const response=await f.call('items','POST',base);assert.equal(response.status,201);
    const item=(await response.json()).item;assert.deepEqual(item.article,article);
    const reopened=new Store(f.directory);try{assert.deepEqual(reopened.getItem(item.id)?.article,article);}finally{reopened.close();}
    assert.equal((await f.call(`items/${item.id}`,'GET',undefined,false)).status,404);
  }finally{f.close();}
});

test('legacy updates keep article configuration unless the owner explicitly returns to diary mode',async()=>{
  const f=fixture();try{
    const item=(await (await f.call('items','POST',base)).json()).item;
    const legacy={...item,title:'新的标题'};delete legacy.article;
    const kept=await f.call(`items/${item.id}`,'PUT',legacy);assert.deepEqual((await kept.json()).item.article,article);
    const cleared=await f.call(`items/${item.id}`,'PUT',{...legacy,article:null});assert.equal((await cleared.json()).item.article,null);
  }finally{f.close();}
});

test('saving and managing an article preserves paragraph indentation and boundary whitespace',async()=>{
  const f=fixture();try{
    const body='　　第一段\n\n　　第二段\n';
    const created=await f.call('items','POST',{...base,body});assert.equal(created.status,201);const row=(await created.json()).item;
    assert.equal(row.body,body);assert.equal(f.store.getItem(row.id)?.body,body);
    const changed='　　修改后的段落\n\n尾段  ';
    const saved=await f.call(`items/${row.id}`,'PUT',{...base,body:changed});assert.equal(saved.status,200);assert.equal((await saved.json()).item.body,changed);
    const managed=await f.call(`items/${row.id}`,'PATCH',{visibility:'public'});assert.equal(managed.status,200);assert.equal((await managed.json()).item.body,changed);
  }finally{f.close();}
});

test('invalid article fields never save or change a record',async()=>{
  const f=fixture();try{
    const cases=[{...article,summary:'a'.repeat(241)},{...article,spoiler:'yes'},{...article,coverPosition:'elsewhere'},{...article,facts:Array(7).fill({label:'上映',value:'2019'})},{...article,facts:[{label:42,value:'bad'}]}];
    for(const invalid of cases)assert.equal((await f.call('items','POST',{...base,article:invalid})).status,400);
    assert.equal((await f.call('items','POST',{...base,kind:'collection'})).status,400);
    assert.equal(f.store.listItems(true).length,0);
  }finally{f.close();}
});

test('article neighbours include only visible articles and respect chronological ordering',async()=>{
  const module=await import('../src/lib/articles').catch(()=>null);assert.ok(module?.articleContext,'文章导航尚未实现');
  const rows=[
    {...base,id:'older',createdAt:'2026-01-01',updatedAt:'',visibility:'public'},
    {...base,id:'private',createdAt:'2026-01-02',updatedAt:''},
    {...base,id:'current',createdAt:'2026-01-03',updatedAt:'',visibility:'public'},
    {...base,id:'diary',createdAt:'2026-01-04',updatedAt:'',visibility:'public',article:null},
    {...base,id:'newer',createdAt:'2026-01-05',updatedAt:'',visibility:'public'},
  ] as import('../src/lib/types').Item[];
  const guest=module.articleContext(rows,'current',false)!;
  assert.equal(guest.previous?.id,'older');assert.equal(guest.next?.id,'newer');
  assert.equal(module.articleContext(rows,'private',false),null);
  assert.equal(module.articleContext(rows,'diary',true),null);
  assert.equal(module.articleContext(rows,'current',true)?.previous?.id,'private');
  const seriesRows=rows.map(row=>({...row,article:row.article?{...row.article,series:row.id==='newer'?'另一个故事':'同一个故事'}:null}));
  assert.equal(module.articleContext(seriesRows,'current',false)?.next,null);
});

test('card summaries are short plain text and custom summaries take priority',async()=>{
  const module=await import('../src/lib/articles').catch(()=>null);assert.ok(module?.itemExcerpt,'文章摘要尚未实现');
  assert.equal(module.itemExcerpt(base),article.summary);
  assert.equal(module.itemExcerpt({...base,article:null,body:'## 小标题\n**喜欢** [电影](https://example.com)'}),'小标题 喜欢 电影');
  assert.equal(module.itemExcerpt({...base,article:null,body:'小'.repeat(200)},88).length,89);
  assert.equal(module.articleMetrics('**喜欢**\n\n电影').characters,4);
});

test('static-hosted readers use the existing detail view without links to unavailable article routes',()=>{
  const row={...base,kind:'moment',visibility:'public',id:'article-id',createdAt:'2026-10-03T00:00:00Z',updatedAt:'2026-10-03T00:00:00Z'} as Item;
  const props={initialItems:[row],initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true,initialView:'life' as const};
  const supported=renderToStaticMarkup(createElement(Space,{...props,articlePages:true}));
  assert.match(supported,/href="\/posts\/article-id"/);
  const fallback=renderToStaticMarkup(createElement(Space,{...props,articlePages:false}));
  assert.doesNotMatch(fallback,/href="\/posts/);
  assert.match(fallback,/<button[^>]*>我的观影笔记<\/button>/);
});

test('timeline groups by Shanghai year and month and excludes private and collection entries',async()=>{
  const module=await import('../src/lib/articles');assert.ok(module.timelineGroups,'时间轴尚未实现');
  const rows=[
    {...base,id:'new-year',visibility:'public',createdAt:'2025-12-31T17:00:00Z',updatedAt:''},
    {...base,id:'last-year',visibility:'public',article:null,createdAt:'2025-12-30T12:00:00Z',updatedAt:''},
    {...base,id:'secret',createdAt:'2026-01-02T00:00:00Z',updatedAt:''},
    {...base,id:'photo',kind:'collection',visibility:'public',createdAt:'2026-01-03T00:00:00Z',updatedAt:''},
  ] as Item[];
  const groups=module.timelineGroups(rows,false);
  assert.deepEqual(groups.map(group=>group.year),['2026','2025']);
  assert.equal(groups[0].months[0].month,'01');
  assert.equal(groups[0].months[0].items[0].id,'new-year');
  assert.equal(groups[1].months[0].items[0].id,'last-year');
});

test('home separates article links from the small daily-notes menu',()=>{
  const row={...base,kind:'moment',visibility:'public',id:'article-id',createdAt:'2026-10-03T00:00:00Z',updatedAt:'2026-10-03T00:00:00Z'} as Item;
  const note={...row,id:'note-id',title:'今天的小心情',article:null};
  const html=renderToStaticMarkup(createElement(Space,{initialItems:[row,note],initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true,initialView:'home'}));
  assert.match(html,/<h2>最近更新/);assert.match(html,/href="\/posts\/article-id"/);
  assert.match(html,/aria-label="最近的小事"/);assert.match(html,/今天的小心情/);
  assert.match(html,/title="时光轴"/);
});


test('embedded reading views retain one site header and exclude private and collection records',()=>{
  const publicRow={...base,kind:'moment',visibility:'public',id:'public-article',title:'公开观后感',category:'观后感',createdAt:'2026-10-03T00:00:00Z',updatedAt:''} as Item;
  const secret={...publicRow,id:'secret',title:'私密文章',visibility:'private'} as Item;
  const collection={...publicRow,id:'collection',title:'一张小卡',kind:'collection'} as Item;
  for(const view of ['timeline','posts'] as const){
    const html=renderToStaticMarkup(createElement(Space,{initialItems:[publicRow,secret,collection],initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true,initialView:view}));
    assert.equal((html.match(/aria-label="小屋导航"/g)||[]).length,1);
    assert.doesNotMatch(html,/aria-label="文章导航"/);
    assert.equal((html.match(/<main\b/g)||[]).length,1);
    assert.match(html,/公开观后感/);assert.doesNotMatch(html,/私密文章|一张小卡/);
    assert.match(html,new RegExp(`title="${view==='timeline'?'时光轴':'文章地图'}" aria-current="page"`));
  }
});

test('editor offers separate article and viewing-review choices and reopens reviews correctly',()=>{
  const row={...base,kind:'moment',id:'review',category:'观后感',createdAt:'2026-10-03T00:00:00Z',updatedAt:''} as Item;
  const html=renderToStaticMarkup(createElement(Editor,{kind:'moment',item:row,onClose:()=>{},onSaved:()=>{}}));
  assert.match(html,/>日常记录<\/label>/);assert.match(html,/>文章<\/label>/);
  assert.match(html,/checked=""[^>]*\/>观后感<\/label>/);
  assert.doesNotMatch(html,/文章／读后感|读后感/);
  assert.match(html,/编辑这篇观后感/);
});
