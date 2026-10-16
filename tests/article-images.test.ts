import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RecordBody} from '../src/components/record-body';
import type {ItemImage} from '../src/lib/types';

const image:ItemImage={assetId:'11111111-1111-1111-1111-111111111111',width:900,height:600};
const url=`/api/files/${image.assetId}?inline=1`;
function rendered(body:string,images:ItemImage[]=[image]){return renderToStaticMarkup(createElement(RecordBody,{body,images} as Parameters<typeof RecordBody>[0]));}
async function tool(){const module=await import('../src/lib/article-images').catch(()=>null);assert.ok(module?.formatArticleImage,'正文插图尚未实现');return module;}

test('inserting an image preserves surrounding paragraphs and stores caption and width',async()=>{
  const {formatArticleImage}=await tool();
  const result=formatArticleImage('前一段后一段',3,image.assetId,'海边 [日落] (今天)','wide');
  assert.ok(result.text.startsWith('前一段\n\n!['));assert.ok(result.text.endsWith('\n\n后一段'));
  assert.ok(result.text.includes('"article-wide"'));
  const html=rendered(result.text);assert.match(html,/article-body-image is-wide/);assert.ok(html.includes('海边 [日落] (今天)'));
  assert.ok(html.indexOf('前一段')<html.indexOf('data-article-image'));assert.ok(html.indexOf('data-article-image')<html.indexOf('后一段'));
});
test('normal image markup renders only the attached photo and accessible caption',()=>{
  const html=rendered(`![沿途的风景](${url} "article-normal")`);
  assert.match(html,/article-body-image is-normal/);assert.match(html,/aria-label="放大查看：沿途的风景"/);
  assert.match(html,/class="article-image-caption">沿途的风景/);assert.ok(html.includes(`src="${url.replace('&','&amp;')}"`));
});

test('image alignment survives size changes, Markdown parsing and published rendering',async()=>{
 const module=await tool();
 for(const alignment of ['left','center','right'] as const){
  const text=module.formatArticleImage('',0,image.assetId,'说明',50,alignment).text;
  const occurrence=module.articleImageOccurrences(text,[image])[0];assert.equal(occurrence.alignment,alignment);assert.equal(occurrence.width,50);
  const resized=module.updateArticleImage(text,occurrence,'说明',75);
  assert.equal(module.articleImageOccurrences(resized.text,[image])[0].alignment,alignment);
  assert.match(rendered(resized.text),new RegExp(`data-image-align="${alignment}"`));assert.match(rendered(resized.text),/width:75%/);
 }
});
test('external and unattached photos are not loaded as article illustrations',()=>{
  const html=rendered(`![外部图片](https://example.com/a.png)\n\n![未附加](/api/files/22222222-2222-2222-2222-222222222222?inline=1)`);
  assert.doesNotMatch(html,/<img\b|data-article-image/);
  assert.doesNotMatch(rendered(`![图片](${url})`,[]),/<img\b/);
});
test('code examples stay code and image captions remain ordinary escaped text',async()=>{
  const {formatArticleImage}=await tool();
  assert.doesNotMatch(rendered('```md\n![代码里的图片]('+url+')\n```'),/<img\b/);
  const result=formatArticleImage('',0,image.assetId,'<script>alert(1)</script> \\ 记忆','normal');
  const html=rendered(result.text);assert.doesNotMatch(html,/<script\b/);assert.match(html,/&lt;script&gt;/);
  assert.ok(html.includes('记忆'));
});
test('image metadata does not enter the article excerpt or reading metrics',async()=>{
  const {formatArticleImage}=await tool();const {plainArticleText}=await import('../src/lib/articles');
  const body=formatArticleImage('前文\n\n后文',4,image.assetId,'海边 [日落]','wide').text;
  assert.equal(plainArticleText(body),'前文 后文');
});

test('percentage image widths survive formatting and rendering with safe fallback',async()=>{
  const module=await tool();
  for(const width of [25,50,100]){
    const edit=module.formatArticleImage('',0,image.assetId,'风景',width);
    assert.match(edit.text,new RegExp(`article-${width}`));
    assert.match(rendered(edit.text),new RegExp(`style="width:${width}%"`));
  }
  assert.equal(module.articleImageWidth('article-wide'),'wide');
  for(const title of ['article-0','article-101','article-27','article-50;position:fixed'])assert.equal(module.articleImageWidth(title),'normal');
});

test('image controls locate actual attached images rather than Markdown examples',async()=>{
  const module=await tool();assert.ok(module.articleImageOccurrences,'图片位置解析尚未实现');
  const markup=module.formatArticleImage('',0,image.assetId,'海边 [日落] (今天)','normal').text.trim();
  const body=`前言\n\n\`\`\`md\n${markup}\n\`\`\`\n\n\`${markup}\`\n\n\\${markup}\n\n${markup}\n\n![外部](https://example.com/a.png)\n\n![未附加](/api/files/22222222-2222-2222-2222-222222222222)`;
  const occurrences=module.articleImageOccurrences(body,[image]);
  assert.equal(occurrences.length,1);assert.equal(occurrences[0].caption,'海边 [日落] (今天)');
  assert.equal(body.slice(occurrences[0].start,occurrences[0].end),markup);
  assert.equal(occurrences[0].image.assetId,image.assetId);
});

test('changing one image occurrence preserves duplicate photos and surrounding text',async()=>{
  const module=await tool();assert.ok(module.updateArticleImage,'图片修改尚未实现');
  const markup=module.formatArticleImage('',0,image.assetId,'原说明','normal').text.trim();
  const body=`前文\n\n${markup}\n\n中间文字\n\n${markup}\n\n后文`;
  const occurrences=module.articleImageOccurrences(body,[image]);
  const edit=module.updateArticleImage(body,occurrences[1],'新说明 [海边]',50);
  assert.equal(edit.text.slice(0,occurrences[1].start),body.slice(0,occurrences[1].start));
  assert.equal(edit.text.slice(edit.end),body.slice(occurrences[1].end));
  const updated=module.articleImageOccurrences(edit.text,[image]);
  assert.equal(updated.length,2);assert.equal(updated[0].caption,'原说明');assert.equal(updated[0].width,'normal');
  assert.equal(updated[1].caption,'新说明 [海边]');assert.equal(updated[1].width,50);
  assert.throws(()=>module.updateArticleImage('多出前文'+body,occurrences[1],'改变',25),/正文.*变化/);
});

test('editing articles and daily records shows visual image editing and size controls',async()=>{
  const {TextEditor}=await import('../src/components/text-editor');
  const body=`![风景](${url} "article-50")`;
  const html=renderToStaticMarkup(createElement(TextEditor,{label:'正文',value:body,onChange:()=>{},article:true,images:[image]}));
  assert.match(html,/aria-label="正文图片"/);assert.match(html,/调整图片/);assert.match(html,/风景/);assert.match(html,/50%/);
  for(const article of [true,false]){
   const edit=renderToStaticMarkup(createElement(TextEditor,{label:'正文',value:body,onChange:()=>{},article,images:[image]}));
   assert.match(edit,/class="iris-material-editor"/);assert.match(edit,/aria-label="正文图片"/);assert.doesNotMatch(edit,/<textarea[^>]*>[\s\S]*?article-50[\s\S]*?<\/textarea>/);
  }
});

test('reference image controls match rendered first definitions including nested definitions',async()=>{
  const module=await tool();const other={...image,assetId:'22222222-2222-2222-2222-222222222222'};
  for(const first of [`[ref]: ${url} "article-50"`,`> [ref]: ${url} "article-50"`]){
    const body=`![风景][ref]\n\n${first}\n\n[ref]: /api/files/${other.assetId}?inline=1 "article-100"`;
    const html=rendered(body,[image,other]);assert.ok(html.includes(`data-article-image="${image.assetId}"`));
    const occurrences=module.articleImageOccurrences(body,[image,other]);assert.equal(occurrences.length,1);
    assert.equal(occurrences[0].image.assetId,image.assetId);assert.equal(occurrences[0].width,50);
    const updated=module.updateArticleImage(body,occurrences[0],'新说明',25);
    assert.ok(rendered(updated.text,[image,other]).includes(`data-article-image="${image.assetId}"`));
  }
});
