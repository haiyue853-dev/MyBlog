import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

async function formatter(){const module=await import('../src/lib/text-format').catch(()=>null);assert.ok(module?.formatInline,'正文格式工具尚未实现');return module;}

test('paragraph indent inserts two Chinese spaces and retains the selection and surrounding content',async()=>{
  const module=await formatter();assert.ok(module.insertTextIndent,'Tab 缩进尚未实现');
  const edit=module.insertTextIndent('第一段\n下一段',4,4);
  assert.deepEqual(edit,{text:'第一段\n　　下一段',start:6,end:6});
  const selected=module.insertTextIndent('喜欢这段文字',2,6);
  assert.equal(selected.text,'喜欢　　这段文字');assert.equal(selected.text.slice(selected.start,selected.end),'这段文字');
  const html=renderToStaticMarkup(createElement(ReactMarkdown,null,module.insertTextIndent('正文',0,0).text));
  assert.match(html,/<p>　　正文<\/p>/);assert.doesNotMatch(html,/<pre|<code/);
});
test('Tab indentation inside explicit code blocks uses two ASCII spaces',async()=>{
  const module=await formatter();assert.ok(module.insertTextIndent,'Tab 缩进尚未实现');
  const body='```js\nreturn 1;\n```\n\n正文';const start=body.indexOf('return');const edit=module.insertTextIndent(body,start,start);
  assert.equal(edit.text,'```js\n  return 1;\n```\n\n正文');
  const after=body.lastIndexOf('正文');assert.equal(module.insertTextIndent(body,after,after).text.slice(after),'　　正文');
});

test('bold and italic preserve Chinese selections and can be removed again',async()=>{
  const {formatInline}=await formatter();
  const bold=formatInline('今天喜欢这张小卡。',4,8,'bold');
  assert.equal(bold.text,'今天喜欢**这张小卡**。');
  assert.equal(bold.text.slice(bold.start,bold.end),'这张小卡');
  assert.equal(formatInline(bold.text,bold.start,bold.end,'bold').text,'今天喜欢这张小卡。');
  const italic=formatInline('喜欢 Jisoo',3,8,'italic');
  assert.equal(italic.text,'喜欢 *Jisoo*');
  assert.equal(formatInline(italic.text,italic.start,italic.end,'italic').text,'喜欢 Jisoo');
});

test('italic can be added to bold text without removing the bold styling',async()=>{
  const {formatInline}=await formatter();
  const italic=formatInline('**喜欢**',2,4,'italic');
  assert.equal(italic.text,'***喜欢***');
  assert.equal(formatInline(italic.text,italic.start,italic.end,'italic').text,'**喜欢**');
  assert.equal(formatInline('**喜欢**',0,6,'italic').text,'***喜欢***');
});

test('formatting at a caret inserts editable placeholder text without losing the surrounding text',async()=>{
  const {formatInline}=await formatter();
  const result=formatInline('今天\n明天',3,3,'bold');
  assert.equal(result.text,'今天\n**加粗文字**明天');
  assert.equal(result.text.slice(result.start,result.end),'加粗文字');
});

test('heading sizes replace the current line marker and returning to body removes it',async()=>{
  const {formatHeading,headingLevel}=await formatter();
  const result=formatHeading('开场\n喜欢的小卡\n下一段',5,8,2);
  assert.equal(result.text,'开场\n## 喜欢的小卡\n下一段');
  assert.equal(result.text.slice(result.start,result.end),'的小卡');
  assert.equal(headingLevel(result.text,result.start),2);
  const smaller=formatHeading(result.text,result.start,result.end,3);
  assert.equal(smaller.text,'开场\n### 喜欢的小卡\n下一段');
  assert.equal(formatHeading(smaller.text,smaller.start,smaller.end,0).text,'开场\n喜欢的小卡\n下一段');
});

test('multiline headings respect the selected lines and keep following lines unchanged',async()=>{
  const {formatHeading}=await formatter();
  const result=formatHeading('第一行\n第二行\n保持正文',0,8,1);
  assert.equal(result.text,'# 第一行\n# 第二行\n保持正文');
  assert.equal(formatHeading('',0,0,3).text,'### ');
  assert.equal(formatHeading('\n正文',0,0,2).text,'## \n正文');
});

test('selection edge spaces remain outside inline markers and the result actually renders',async()=>{
  const {formatInline}=await formatter();
  const bold=formatInline('喜欢这张小卡 今天',0,7,'bold');
  assert.equal(bold.text,'**喜欢这张小卡** 今天');
  assert.match(renderToStaticMarkup(createElement(ReactMarkdown,null,bold.text)),/<strong>喜欢这张小卡<\/strong> 今天/);
  const italic=formatInline(' 想强调的文字 ',0,8,'italic');
  assert.equal(italic.text,' *想强调的文字* ');
  assert.match(renderToStaticMarkup(createElement(ReactMarkdown,null,italic.text)),/<em>想强调的文字<\/em>/);
  assert.equal(formatInline(italic.text,italic.start,italic.end,'italic').text,' 想强调的文字 ');
});

test('whole-paragraph selections format each paragraph and can be toggled off',async()=>{
  const {formatInline}=await formatter();
  const body='第一段\n\n第二段';
  const bold=formatInline(body,0,body.length,'bold');
  assert.equal(bold.text,'**第一段**\n\n**第二段**');
  const rendered=renderToStaticMarkup(createElement(ReactMarkdown,null,bold.text));
  assert.equal((rendered.match(/<strong>/g)||[]).length,2);
  assert.equal(formatInline(bold.text,bold.start,bold.end,'bold').text,body);
});

test('code insertion preserves indentation and cannot be closed by pasted backticks',async()=>{
  const module=await formatter();assert.ok(module.formatCodeBlock,'代码块插入尚未实现');
  const code='    console.log("hello");\n```\n保留这行';
  const result=module.formatCodeBlock('前文后文',2,2,code,'js');
  assert.ok(result.text.startsWith('前文\n\n````js\n'));
  assert.ok(result.text.includes(code+'\n````\n\n后文'));
  const html=renderToStaticMarkup(createElement(ReactMarkdown,null,result.text));
  assert.match(html,/<code class="language-js">/);assert.match(html,/    console\.log/);
});

test('bullet and numbered lists format selected lines and toggle off without losing text',async()=>{
  const module=await formatter();assert.ok(module.formatBlock,'列表与引用工具尚未实现');
  const body='第一项\n第二项\n保持正文';const result=module.formatBlock(body,0,7,'bullet');
  assert.equal(result.text,'- 第一项\n- 第二项\n保持正文');
  assert.equal(module.formatBlock(result.text,result.start,result.end,'bullet').text,body);
  const ordered=module.formatBlock(body,0,7,'number');assert.equal(ordered.text,'1. 第一项\n2. 第二项\n保持正文');
  assert.equal(module.formatBlock(ordered.text,ordered.start,ordered.end,'bullet').text,result.text);
});
test('block formatting preserves blank paragraphs and inline emphasis',async()=>{
  const module=await formatter();assert.ok(module.formatBlock,'列表与引用工具尚未实现');
  const result=module.formatBlock('**第一段**\n\n第二段',0,12,'quote');
  assert.equal(result.text,'> **第一段**\n\n> 第二段');
  const html=renderToStaticMarkup(createElement(ReactMarkdown,null,result.text));
  assert.match(html,/<blockquote>/);assert.match(html,/<strong>第一段<\/strong>/);
});
test('enter continues list numbering and an empty item exits the list',async()=>{
  const module=await formatter();assert.ok(module.continueBlock,'列表换行尚未实现');
  assert.equal(module.continueBlock('3. 第三项',6,6)?.text,'3. 第三项\n4. ');
  assert.equal(module.continueBlock('- 第一项\n- ',8,8)?.text,'- 第一项\n\n');
  assert.equal(module.continueBlock('普通正文',4,4),null);
  const code='```js\n- code';assert.equal(module.continueBlock(code,code.length,code.length),null);
  const quote='> 喜欢这句话';assert.equal(module.continueBlock(quote,quote.length,quote.length)?.text,quote+'\n> ');
});
