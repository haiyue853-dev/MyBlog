import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareIrisChatBlogDraft} from '../src/lib/iris-chat-blog';
import {newArticle} from '../src/lib/articles';
import type {Item} from '../src/lib/types';
import {readIrisBlogWorkspace,writeIrisBlogWorkspace} from '../src/lib/iris-blog-workspace';
const candidate:Item={id:'00000000-0000-0000-0000-000000000001',kind:'moment',title:'让打字顺便成为学习',body:'最近发现了一种更轻松的学习方式。',category:'工具分享',tags:['输入法','英语'],url:'',assetId:null,images:[],article:{...newArticle(),summary:'把语言学习放进日常打字。'},status:'draft',visibility:'public',createdAt:'2026-10-07',updatedAt:'2026-10-07'};

test('chat conversion requests a complete model-written draft rather than using the first line',async()=>{
 const original=globalThis.fetch;const received:{url:string;options?:RequestInit}[]=[];
 globalThis.fetch=(async(url,options)=>{received.push({url:String(url),options});return Response.json({candidate});}) as typeof fetch;
 try{
  const content='我先确认一下项目。抓取超时了。\n\n下面是预览稿：\n\n一个让我顺手学英语的输入工具';
  const result=await prepareIrisChatBlogDraft(content,'article');
  assert.deepEqual(result,candidate);assert.notEqual(result.title,content.split('\n')[0]);
  assert.equal(received.length,1);assert.equal(received[0].url,'/api/iris/blog/prepare');
  const body=JSON.parse(String(received[0].options?.body));assert.equal(body.sourceReply,content);assert.equal(body.type,'article');assert.deepEqual(body.assetIds,[]);
  assert.ok(result.article?.summary&&result.category&&result.tags.length);
 }finally{globalThis.fetch=original;}
});

test('a failed or stopped conversion cannot fall back to a copied chat title',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=(async()=>Response.json({error:'模型暂时超时'},{status:502})) as typeof fetch;
  await assert.rejects(prepareIrisChatBlogDraft('我先确认一下项目','moment'),/模型暂时超时/);
  const controller=new AbortController();
  globalThis.fetch=(async(_url,options)=>new Promise((_resolve,reject)=>{options?.signal?.addEventListener('abort',()=>reject(new DOMException('stopped','AbortError')),{once:true});})) as typeof fetch;
  const pending=prepareIrisChatBlogDraft('今天的心情','moment',controller.signal);controller.abort();
  await assert.rejects(pending,{name:'AbortError'});
 }finally{globalThis.fetch=original;}
});

test('empty or oversized answers are rejected before requesting a model; long valid replies are sent intact',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=(async(_url,options)=>{calls++;assert.equal(JSON.parse(String(options?.body)).sourceReply.length,50000);return Response.json({candidate:{...candidate,article:null,writingType:undefined}});}) as typeof fetch;
 try{
  for(const value of ['', '   ', 'x'.repeat(50001)])await assert.rejects(prepareIrisChatBlogDraft(value,'moment'));
  assert.equal(calls,0);const result=await prepareIrisChatBlogDraft('x'.repeat(50000),'moment');assert.equal(result.article,null);assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});

test('chat previews and uploaded material workspaces restore independently',()=>{
 const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 writeIrisBlogWorkspace(storage,{message:'我的文档素材',type:'article',materials:[],candidate:null});
 writeIrisBlogWorkspace(storage,{message:'',type:'article',materials:[],candidate},'little-world-iris-chat-blog:v1');
 assert.equal(readIrisBlogWorkspace(storage)?.message,'我的文档素材');assert.equal(readIrisBlogWorkspace(storage,'little-world-iris-chat-blog:v1')?.candidate?.title,candidate.title);
});
