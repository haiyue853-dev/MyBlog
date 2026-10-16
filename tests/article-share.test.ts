import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArticleReader} from '../src/components/article-reader';
import {DEFAULT_PROFILE,type Item} from '../src/lib/types';
import {newArticle} from '../src/lib/articles';
const item:Item={id:'88499e97-e6bc-4f2e-8e51-4e53ad1739c5',kind:'moment',title:'海边慢慢走',body:'## 正文\n**收藏**这一阵风。',tags:['旅行'],category:'旅游',assetId:null,url:'',visibility:'public',status:'published',createdAt:'2026-10-03T18:00:00.000Z',updatedAt:'2026-10-04T01:00:00.000Z',article:newArticle()};
test('article sharing appears only for published public articles, including owner views',()=>{
  const render=(entry:Item)=>renderToStaticMarkup(createElement(ArticleReader,{item:entry,articles:[entry],profile:DEFAULT_PROFILE,owner:true,embedded:true}));
  assert.match(render(item),/aria-label="分享这篇文章"/);
  for(const change of [{visibility:'private' as const},{status:'draft' as const},{article:null}])assert.doesNotMatch(render({...item,...change}),/aria-label="分享这篇文章"/);
});
test('share data keeps a canonical article URL and plain bounded text',async()=>{
  const module=await import('../src/lib/article-share-data').catch(()=>null);assert.ok(module?.articleShareData,'分享模型尚未实现');
  const data=module.articleShareData({...item,title:'  海边\n慢慢走  ',article:{...newArticle(),summary:'**喜欢** [这一阵风](https://example.com) <img src=x>'}},DEFAULT_PROFILE,'https://my-room.example/deep?tab=private#chapter')!;
  assert.equal(data.url,`https://my-room.example/posts/${item.id}`);assert.equal(data.title,'海边 慢慢走');assert.equal(data.summary,'喜欢 这一阵风');assert.equal(data.date,'2026/10/04');assert.equal(data.siteName,DEFAULT_PROFILE.name);assert.equal(data.coverId,null);
  assert.equal(module.articleShareData({...item,visibility:'private'},DEFAULT_PROFILE,'https://my-room.example'),null);
  assert.equal(module.articleShareData({...item,status:'draft'},DEFAULT_PROFILE,'https://my-room.example'),null);
  assert.throws(()=>module.articleShareData(item,DEFAULT_PROFILE,'javascript:alert(1)'),/地址/);
});
test('local links receive a preview hint and exported filenames are safe',async()=>{
  const module=await import('../src/lib/article-share-data').catch(()=>null);assert.ok(module?.articleShareData,'分享模型尚未实现');
  for(const host of ['127.0.0.1:3000','localhost:3002','[::1]:3000','192.168.1.5','10.0.0.2','172.16.0.3'])assert.equal(module.articleShareData(item,DEFAULT_PROFILE,`http://${host}`)?.local,true);
  const remote=module.articleShareData({...item,title:'CON / 工作:*? "日记" <笔记>\n🙂'},DEFAULT_PROFILE,'https://my-room.example')!;
  assert.equal(remote.local,false);assert.match(remote.filename,/^文章分享-.+\.png$/);assert.doesNotMatch(remote.filename,/[<>:"/\\|?*\u0000-\u001f]/);
});
test('poster text wraps within its measured width without splitting emoji and truncates long lines',async()=>{
  const module=await import('../src/lib/article-share-data').catch(()=>null);assert.ok(module?.wrapPosterText,'文字分行尚未实现');
  const measure=(value:string)=>[...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(value)].length;
  assert.deepEqual(module.wrapPosterText('一家人👨‍👩‍👧‍👦一起走',measure,4,3),['一家人👨‍👩‍👧‍👦','一起走']);
  const lines=module.wrapPosterText('长标题'.repeat(80),measure,10,3);assert.equal(lines.length,3);assert.ok(lines.every(line=>measure(line)<=10));assert.match(lines[2],/…$/);
  assert.deepEqual(module.wrapPosterText('',measure,10,3),[]);
});
test('share popovers stay below the shared header and inside narrow or short viewports',async()=>{
  const module=await import('../src/lib/article-share-data');assert.ok(module.sharePopoverPosition,'浮层位置处理尚未实现');
  for(const scenario of [{width:1280,height:720,header:108,anchor:{right:867,top:448},panel:600},{width:378,height:844,header:293,anchor:{right:322,top:450},panel:620},{width:378,height:600,header:293,anchor:{right:322,top:300},panel:620}]){
    const position=module.sharePopoverPosition(scenario.anchor,scenario,scenario.header,scenario.panel);
    assert.ok(position.top>=scenario.header+12);assert.ok(position.top+Math.min(scenario.panel,position.maxHeight)<=scenario.height-12);
    assert.ok(position.left>=16);assert.ok(position.left+position.width<=scenario.width-16);
  }
});
