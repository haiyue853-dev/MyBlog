import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RecordBody} from '../src/components/record-body';

function article(body:string){return renderToStaticMarkup(createElement(RecordBody,{body,articleHeadings:true} as Parameters<typeof RecordBody>[0]));}

test('article headings have stable ids and preserve inline formatting',()=>{
  const html=article('# 一次工作中的进步\n\n## **认真**记下 `代码`\n\n### 想留下的片段');
  assert.match(html,/<h1[^>]*id="section-一次工作中的进步"[^>]*data-article-heading="1"/);
  assert.match(html,/<h2[^>]*id="section-认真记下-代码"/);
  assert.match(html,/<strong>认真<\/strong>记下 <code>代码<\/code>/);
  assert.match(html,/<h3[^>]*data-article-heading="3"/);
  assert.equal(article('# 一次工作中的进步'),article('# 一次工作中的进步'));
});
test('repeated headings and literal numbered names all receive unique ids',()=>{
  const html=article('## 片段\n\n## 片段\n\n## 片段-2\n\n## 片段');
  const ids=Array.from(html.matchAll(/id="(section-[^"]+)"/g),match=>match[1]);
  assert.equal(ids.length,4);assert.equal(new Set(ids).size,4);
  assert.equal(ids[0],'section-片段');assert.equal(ids[1],'section-片段-2');
});
test('only actual rendered headings at levels one to three receive chapter markers',()=>{
  const html=article('```md\n## 不是章节\n```\n\n    ## 缩进的文字\n\n#### 更小标题\n\n普通句子：## 不算标题\n\n真正的章节\n------');
  assert.equal((html.match(/data-article-heading=/g)||[]).length,1);
  assert.match(html,/id="section-真正的章节"/);
  assert.match(html,/<pre><code class="language-md">/);
});
test('normal diary and editor rendering do not acquire article chapter ids',()=>{
  const html=renderToStaticMarkup(createElement(RecordBody,{body:'# 日常的小标题'}));
  assert.doesNotMatch(html,/data-article-heading|section-/);
});
