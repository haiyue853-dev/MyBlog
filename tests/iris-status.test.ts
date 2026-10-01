import {test} from 'node:test';
import assert from 'node:assert/strict';
const status=await import('../src/lib/iris-status').catch(()=>null);
test('index stage labels follow the local Iris vocabulary',()=>{
  assert.ok(status,'status helpers are not implemented');
  assert.equal(status.irisStageLabel('queued'),'排队等待索引');
  assert.equal(status.irisStageLabel('parsing'),'正在解析文件内容');
  assert.equal(status.irisStageLabel('chunking'),'正在生成父子切片');
  assert.equal(status.irisStageLabel('embedding'),'正在生成向量索引');
  assert.equal(status.irisStageLabel('completed'),'索引已完成');
  assert.equal(status.irisStageLabel('failed'),'索引失败');
  assert.equal(status.irisStageLabel('brand-new-stage'),'正在建立索引');
});
test('settled stages stop polling and needs a document status bridge',()=>{
  assert.ok(status,'status helpers are not implemented');
  assert.equal(status.irisStageSettled('completed'),true);
  assert.equal(status.irisStageSettled('failed'),true);
  assert.equal(status.irisStageSettled('embedding'),false);
  assert.equal(status.irisDocumentStage('ready'),'completed');
  assert.equal(status.irisDocumentStage('indexing'),'indexing');
  assert.equal(status.irisDocumentStage(undefined),'queued');
});
test('progress lookup returns only the requested document',()=>{
  assert.ok(status,'status helpers are not implemented');
  const payload={items:[{document_id:'doc-a',stage:'queued',message:'等待建立索引'},{document_id:'doc-b',stage:'embedding',message:'正在生成向量索引'}]};
  assert.deepEqual(status.irisProgress(payload,'doc-b'),{stage:'embedding',message:'正在生成向量索引'});
  assert.equal(status.irisProgress(payload,'doc-c'),null);
  assert.equal(status.irisProgress(null,'doc-a'),null);
  assert.equal(status.irisProgress({items:[{document_id:'doc-a',stage:7}]},'doc-a'),null);
});
