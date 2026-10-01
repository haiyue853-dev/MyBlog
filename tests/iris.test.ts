import {test} from 'node:test';
import assert from 'node:assert/strict';
const iris=await import('../src/lib/iris-stream').catch(()=>null);
test('NDJSON parser preserves split UTF-8 text and final line without newline',async()=>{
  assert.ok(iris,'stream parser is not implemented');
  const bytes=new TextEncoder().encode('{"type":"text_delta","data":{"text":"你好"}}\n{"type":"message_completed","data":{}}');
  const stream=new ReadableStream<Uint8Array>({start(controller){for(let i=0;i<bytes.length;i+=3)controller.enqueue(bytes.slice(i,i+3));controller.close();}});
  const events=[];
  for await(const event of iris.readIrisEvents(stream))events.push(event);
  assert.equal(events[0].data.text,'你好');
  assert.equal(events[1].type,'message_completed');
});
test('Iris allowlist rejects configuration endpoints and traversal',()=>{
  assert.ok(iris,'stream parser is not implemented');
  assert.equal(iris.allowedIrisPath(['settings']),false);
  assert.equal(iris.allowedIrisPath(['..','settings']),false);
  assert.equal(iris.allowedIrisPath(['chat','stream']),true);
  assert.equal(iris.allowedIrisPath(['knowledge','collections']),true);
});
test('Iris delta adapter reads the actual local Agent content field',()=>{
  assert.ok(iris,'stream parser is not implemented');
  assert.equal(typeof iris.irisTextDelta,'function','actual Iris delta adapter is missing');
  assert.equal(iris.irisTextDelta({type:'text_delta',data:{content:'本地 Iris'}}),'本地 Iris');
});
