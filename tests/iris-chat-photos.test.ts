import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {irisApi} from '../src/lib/api/iris';
import {handleErrors,newToken} from '../src/lib/http';
import {isChatImage,chatImageUrl} from '../src/lib/iris-chat-files';
import {chatReplyPhotos,mergeIrisChatPhotos,prepareIrisChatBlogWithPhotos} from '../src/lib/iris-chat-blog';
import {IrisChatPhotoPicker} from '../src/components/iris-chat-photo-picker';
import {IrisChatComposer} from '../src/components/iris-chat-composer';
import {IrisChatMessage} from '../src/components/iris-chat-message';
import {newArticle} from '../src/lib/articles';
import type {Item} from '../src/lib/types';
const picture={id:'photo-one',original_name:'photo.png',media_type:'image/png'};const doc={id:'document-one',original_name:'note.txt',media_type:'text/plain'};
const draft:Item={id:'00000000-0000-0000-0000-000000000001',kind:'moment',title:'故事',body:'正文',category:'日常',tags:[],url:'',assetId:null,images:[],article:newArticle(),status:'draft',visibility:'private',createdAt:'2026-10-13',updatedAt:'2026-10-13'};
test('only the related user message supplies photos; valid image URLs are private and cannot traverse paths',()=>{
 assert.ok(isChatImage(picture));assert.ok(!isChatImage(doc));assert.ok(!isChatImage({original_name:'x.svg',media_type:'image/svg+xml'}));
 const messages=[{role:'user',attachments:[picture,doc]},{role:'assistant'},{role:'user',attachments:[]},{role:'assistant'}];assert.deepEqual(chatReplyPhotos(messages,1),[picture]);assert.deepEqual(chatReplyPhotos(messages,3),[]);
 assert.equal(chatImageUrl('session-one','photo-one'),'/api/iris/sessions/session-one/attachments/photo-one/download');assert.equal(chatImageUrl('../bad','photo-one'),null);
});
test('conversion imports only checked photos, reuses copied files on retry, and stops without a candidate',async()=>{
 const originalFetch=globalThis.fetch;const imageDescriptor=Object.getOwnPropertyDescriptor(globalThis,'Image');const calls:string[]=[];let controller:AbortController|undefined;
 class TestImage {naturalWidth=200;naturalHeight=100;onload:(()=>void)|null=null;set src(_value:string){queueMicrotask(()=>this.onload?.());}}
 Object.defineProperty(globalThis,'Image',{configurable:true,value:TestImage});
 const assetId='00000000-0000-0000-0000-000000000002';
 globalThis.fetch=(async(url,options)=>{calls.push(String(url));if(String(url)==='/api/iris/blog/prepare')return Response.json({candidate:draft});if(String(url)==='/api/files'){controller?.abort();assert.ok(options?.signal);return Response.json({file:{id:assetId,mime:'image/webp'}});}return new Response(new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]),{headers:{'Content-Type':'image/webp'}});}) as typeof fetch;
 const source={content:'虚构回答',sessionId:'session-one',photos:[{...picture,original_name:'a.webp',media_type:'image/webp'},{id:'photo-two',original_name:'b.webp',media_type:'image/webp'}]};const cache=new Map();
 try{
  const first=await prepareIrisChatBlogWithPhotos(source,'article',['photo-one'],cache,new AbortController().signal);assert.equal(first.images?.length,1);assert.ok(first.body.includes(assetId));assert.equal(calls.filter(url=>url.includes('download')).length,1);assert.ok(!calls.some(url=>url.includes('photo-two')));
  await prepareIrisChatBlogWithPhotos(source,'article',['photo-one'],cache);assert.equal(calls.filter(url=>url==='/api/files').length,1);
  const count=calls.length;await assert.rejects(prepareIrisChatBlogWithPhotos(source,'article',['not-related'],cache));assert.equal(calls.length,count);
  controller=new AbortController();await assert.rejects(prepareIrisChatBlogWithPhotos(source,'article',['photo-two'],cache,controller.signal),{name:'AbortError'});
 }finally{globalThis.fetch=originalFetch;if(imageDescriptor)Object.defineProperty(globalThis,'Image',imageDescriptor);else Reflect.deleteProperty(globalThis,'Image');}
});
test('selected photos become only private candidate references and article inline images; moments stay galleries',()=>{
 const photo={assetId:'00000000-0000-0000-0000-000000000002',width:200,height:100};const candidate=mergeIrisChatPhotos(draft,[photo]);
 assert.equal(candidate.id,draft.id);assert.equal(candidate.visibility,'private');assert.equal(candidate.status,'draft');assert.equal(candidate.assetId,null);assert.deepEqual(candidate.images,[photo]);assert.ok(candidate.body.includes(photo.assetId));assert.ok(!candidate.body.includes('photo-one'));assert.deepEqual(mergeIrisChatPhotos(draft,[]),draft);
 const moment=mergeIrisChatPhotos({...draft,article:null},[photo]);assert.equal(moment.body,draft.body);assert.equal(moment.assetId,photo.assetId);
});
test('pending, history and explicit selection expose image preview buttons but never preview documents as images',()=>{
 const html=renderToStaticMarkup(createElement(IrisChatPhotoPicker,{sessionId:'session-one',photos:[picture],selected:[],disabled:false,onChange:()=>{}}));assert.match(html,/选择博客配图/);assert.match(html,/查看图片：photo.png/);assert.doesNotMatch(html,/checked=""/);
 const message=renderToStaticMarkup(createElement(IrisChatMessage,{role:'user',content:'看看照片',attachments:[picture,doc],sessionId:'session-one'}));assert.match(message,/查看图片：photo.png/);assert.doesNotMatch(message,/查看图片：note.txt/);
 const pending=renderToStaticMarkup(createElement(IrisChatComposer,{files:[{key:'one',file:new File(['x'],'photo.png',{type:'image/png'})}],question:'',online:true,sending:false,onFiles:()=>{},onRemove:()=>{},onQuestion:()=>{},onSubmit:()=>{},onStop:()=>{}}));assert.match(pending,/查看图片：photo.png/);
});
test('photo proxy enforces owner, IDs, methods, real image bytes and size before exposing attachment data',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'iris-chat-photos-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);let reads=0;let mode='image';
 const png=Buffer.from([137,80,78,71,13,10,26,10]);const upstream=createServer((req,res)=>{reads++;assert.equal(req.url,'/api/sessions/session-one/attachments/photo-one/download');assert.equal(req.headers.authorization,'Bearer internal-test');if(mode==='missing'){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','text/html');if(mode==='large')res.setHeader('Content-Length',21*1024*1024);res.end(mode==='image'?png:Buffer.from('<html>bad</html>'));});await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const origin='http://localhost:3000';const base=`http://127.0.0.1:${(upstream.address() as {port:number}).port}`;const path=['iris','sessions','session-one','attachments','photo-one','download'];
 const call=(owner=true,parts=path,method='GET')=>withRuntime(store,{appUrl:origin,irisBaseUrl:base,irisApiToken:'internal-test'},()=>handleErrors(()=>irisApi(new Request(`${origin}/api/${parts.join('/')}`,{method,headers:{origin,...(owner?{cookie:`world-session=${token}`}:{})}}),parts)));
 try{assert.equal((await call(false)).status,401);assert.equal((await call(true,['iris','sessions','..','attachments','photo-one','download'])).status,400);assert.equal((await call(true,path,'POST')).status,405);assert.equal(reads,0);
  const response=await call();assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.match(response.headers.get('cache-control')||'',/no-store/);assert.match(response.headers.get('x-content-type-options')||'',/nosniff/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  mode='bad';assert.equal((await call()).status,400);mode='large';assert.equal((await call()).status,413);mode='missing';assert.equal((await call()).status,404);assert.equal(store.listItems(true).length,0);assert.equal(store.listAssets().length,0);
 }finally{await new Promise<void>(resolve=>upstream.close(()=>resolve()));store.close();rmSync(directory,{recursive:true,force:true});}
});
