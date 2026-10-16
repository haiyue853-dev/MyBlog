import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readIrisReply} from '../src/lib/iris-chat';
import {IrisChatMessage} from '../src/components/iris-chat-message';

function stream(events:{type:string;data:Record<string,unknown>}[]){
 return new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode(events.map(event=>JSON.stringify(event)).join('\n')));controller.close();}});
}
test('a model timeout is surfaced instead of an empty reply',async()=>{
 await assert.rejects(readIrisReply(stream([{type:'task_started',data:{task_id:'qa'}},{type:'error',data:{code:'provider_error',message:'模型首个响应超时，请稍后重试'}}])),/模型首个响应超时/);
});
test('metadata-only completion retains the actual streamed answer',async()=>{
 const updates:string[]=[];
 const result=await readIrisReply(stream([{type:'text_delta',data:{content:'今日'}},{type:'text_delta',data:{content:'碎碎念'}},{type:'message_completed',data:{message_id:'qa'}}]),text=>updates.push(text));
 assert.equal(result,'今日碎碎念');assert.equal(updates.at(-1),result);
});
test('empty deltas and an unfinished partial reply cannot count as success',async()=>{
 await assert.rejects(readIrisReply(stream([{type:'text_delta',data:{content:''}},{type:'message_completed',data:{}}])),/没有返回文字/);
 await assert.rejects(readIrisReply(stream([{type:'text_delta',data:{content:'未完成的正文'}}])),/回答未完成/);
});
test('completion text works when the provider emits no deltas',async()=>{
 assert.equal(await readIrisReply(stream([{type:'message_completed',data:{content:'完整回答'}}])),'完整回答');
});
test('a failed chat bubble visibly carries its reason rather than a blank placeholder',()=>{
 const html=renderToStaticMarkup(createElement(IrisChatMessage,{role:'assistant',content:'',error:'模型首个响应超时，请稍后重试'}));
 assert.match(html,/role="alert"/);assert.match(html,/模型首个响应超时/);assert.doesNotMatch(html,/这条回答没有文字/);
});
test('failed partial text remains visible and is labelled incomplete',()=>{
 const html=renderToStaticMarkup(createElement(IrisChatMessage,{role:'assistant',content:'已经收到的一小段正文',error:'回答未完成，请重试。'}));
 assert.match(html,/已经收到的一小段正文/);assert.match(html,/回答未完成/);
});

test('only a finished assistant answer offers the blog preview action',()=>{
 const props={role:'assistant',content:'今天想慢慢记住的一天。',onPrepareBlog:()=>{}};
 assert.match(renderToStaticMarkup(createElement(IrisChatMessage,props)),/整理成博客/);
 for(const override of [{role:'user'},{content:''},{content:'   '},{waiting:true},{error:'回答未完成'}]){
  assert.doesNotMatch(renderToStaticMarkup(createElement(IrisChatMessage,{...props,...override})),/整理成博客/);
 }
});
