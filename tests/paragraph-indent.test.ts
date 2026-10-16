import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RecordBody} from '../src/components/record-body';
const render=(body:string)=>renderToStaticMarkup(createElement(RecordBody,{body}));
test('a single newline after ASCII-indented prose never creates an extra paragraph',()=>{
  for(const [prefix,next] of [['       ','　　'],['       ',''],['\t',''],['    ','  ']]){
    const html=render(`${prefix}上一行。\n${next}下一行。\n最后一行。`);
    assert.equal((html.match(/<p>/g)||[]).length,1,JSON.stringify({prefix,next}));
    assert.ok(html.includes('上一行。\n'));
    assert.ok(html.includes('下一行。\n最后一行。'));
    assert.doesNotMatch(html,/<pre/);
  }
});
test('explicit blank lines and Markdown block boundaries survive indented prose',()=>{
  const html=render('    第一段。\n\n    第二段。\n　　接续。\n\n## 小标题\n\n- 第一项\n\n```js\n  return 1;\n```');
  assert.equal((html.match(/<p>/g)||[]).length,2);
  assert.ok(html.includes('第二段。\n　　接续。'));
  assert.match(html,/<h2>小标题<\/h2>/);
  assert.match(html,/<ul>\s*<li>第一项<\/li>\s*<\/ul>/);
  assert.match(html,/<pre><code class="language-js">  return 1;/);
});
test('indentation after a bold title survives a Markdown soft line break',()=>{
  const html=render('**剧情介绍** \n       周浩镇，**一位**译员。\n  下一行');
  assert.ok(html.includes('\n'+'\u00a0'.repeat(7)+'周浩镇，'));
  assert.ok(html.includes('\n\u00a0\u00a0下一行'));assert.match(html,/<strong>剧情介绍<\/strong>/);assert.match(html,/<strong>一位<\/strong>/);assert.doesNotMatch(html,/<pre/);
});
test('paragraph starts and indented bold lines retain whitespace without affecting structural Markdown',()=>{
  assert.ok(render('  普通段落').includes('<p>\u00a0\u00a0普通段落</p>'));
  assert.ok(render('**剧情介绍**\n  **周浩镇**').includes('\n\u00a0\u00a0<strong>周浩镇</strong>'));
  assert.ok(render('**剧情介绍**  \n  周浩镇').includes('<br/>\n\u00a0\u00a0周浩镇'));
  const html=render('- 第一项\n  接续\n\n> 引用\n\n```js\n  return 1;\n```');
  assert.match(html,/<ul>/);assert.match(html,/<blockquote>/);assert.match(html,/  return 1;/);assert.ok(!html.includes('\u00a0'));
});
