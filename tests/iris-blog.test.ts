import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type IncomingMessage} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {handleErrors,newToken} from '../src/lib/http';
import {irisApi} from '../src/lib/api/iris';
import {itemsApi} from '../src/lib/api/items';
import type {Item} from '../src/lib/types';
import {saveEditorItem} from '../src/lib/editor-save';
import {irisBlogPrompt,manualBlogDraft} from '../src/lib/iris-blog';

const answer={title:'雨天的散步',body:'## 今天\n\n一路慢慢走。',category:'日常',tags:['散步'],summary:'记下雨天的小事。',visibility:'public',status:'published',assetId:'model-cannot-select'};

test('technical image and file examples inside code do not block a text-only preview',async()=>{
 const f=await fixture();try{
  const body='图片懒加载可以使用 `<img loading="lazy">`。\n\n```html\n<img src="/api/files/00000000-0000-4000-8000-000000000001?inline=1">\n```\n\nMarkdown 示例：`![配图](/api/files/00000000-0000-4000-8000-000000000001)`。\n\n    <img loading="lazy">';
  f.setOutput(JSON.stringify({...answer,body}));const response=await f.call({message:'整理这篇技术文章',type:'article',assetIds:[]});
  assert.equal(response.status,200);assert.equal((await response.json()).candidate.body,body);assert.equal(f.store.listItems(true).length,0);
 }finally{await f.close();}
});

test('real generated images and file links remain blocked outside code examples',async()=>{
 const f=await fixture();try{
  for(const body of ['<img loading="lazy">','![配图](https://example.com/image.png)','[文件](/api/files/00000000-0000-4000-8000-000000000001)','![配图][photo]\n\n[photo]: https://example.com/photo.png']){
   f.setOutput(JSON.stringify({...answer,body}));assert.equal((await f.call({message:'整理文字',type:'article',assetIds:[]})).status,502);
  }
  assert.equal(f.store.listItems(true).length,0);
 }finally{await f.close();}
});

test('editorial instructions do not add interview collection intent to an ordinary project reply',()=>{
 const prompt=irisBlogPrompt('整理成博客','article',0,'这个项目整理了 Java 面试题。来源：https://github.com/example/java-interview');
 assert.doesNotMatch(prompt,/搜索|搜集|收集|查找|抓取/);
});

test('inline material photos keep their paragraph positions in article and daily previews',async()=>{
 const f=await fixture();try{
  const photo=f.store.addAsset({name:'插图.png',mime:'image/png',size:8,category:'记录图片'});await f.store.writeAsset(photo.id,Buffer.from([137,80,78,71,13,10,26,10]));
  const image=`![配图](/api/files/${photo.id}?inline=1)`;
  for(const type of ['article','moment']){
   f.setOutput(JSON.stringify({...answer,body:'开头段落\n\n{IRIS_IMAGE_1}\n\n后面的文字'}));
   const response=await f.call({message:`开头\n\n${image}\n\n后面的文字`,type,assetIds:[photo.id]});assert.equal(response.status,200);
   const candidate=(await response.json()).candidate as Item;assert.equal(candidate.body,`开头段落\n\n${image}\n\n后面的文字`);assert.deepEqual(candidate.images,[{assetId:photo.id}]);
   const prompt=(f.received.filter(entry=>entry.path==='/api/chat/stream').at(-1)!.body as {message:string}).message;assert.match(prompt,/\{IRIS_IMAGE_1\}/);assert.ok(!prompt.includes(`/api/files/${photo.id}`));
  }
  f.setOutput(JSON.stringify(answer));assert.equal((await f.call({message:`开头\n\n${image}`,type:'article',assetIds:[photo.id]})).status,502);
  assert.equal(f.store.listItems(true).length,0);
 }finally{await f.close();}
});

test('original writing can be saved and published through the blog while Iris is unavailable',async()=>{
 const f=await fixture();try{
  f.setFail();const photo=f.store.addAsset({name:'原文.png',mime:'image/png',size:8,category:'记录图片'});await f.store.writeAsset(photo.id,Buffer.from([137,80,78,71,13,10,26,10]));
  const doc=f.store.addAsset({name:'私人笔记.pdf',mime:'application/pdf',size:4,category:'素材'});
  for(const type of ['article','moment'] as const){
   const body=`原文标题\n\n![](/api/files/${photo.id}?inline=1 "article-50-right")\n\n这段话不经过模型。`;
   const draft=manualBlogDraft(body,type,[photo,doc]);
   const saved=await f.save({...draft,clientRequestId:draft.id});assert.equal(saved.status,201);assert.equal(f.store.getItem(draft.id)?.body,body);
   assert.equal(f.store.listItems(false).length,type==='article'?0:1);
   const published=await f.save({...draft,status:'published'},draft.id);assert.equal(published.status,200);assert.equal(f.store.getItem(draft.id)?.body,body);
  }
  assert.equal(f.received.length,0);assert.equal(f.store.isPublicAsset(photo.id),true);assert.equal(f.store.isPublicAsset(doc.id),false);
 }finally{await f.close();}
});

test('saved type-specific preferences reach material, chat and revision prompts while preserving tool limits',async()=>{
 const f=await fixture();try{
  const prefs=f.store.getIrisWritingPreferences();prefs.article.instructions='文章偏好独立标记';prefs.article.tone='casual';prefs.moment.instructions='日常偏好独立标记';await f.store.saveIrisWritingPreferences(prefs);
  for(const source of [{},{sourceReply:'虚构聊天稿'},{sourceDraft:{type:'article',title:'当前标题',body:'虚构当前正文',category:'日常',tags:[],summary:'摘要',images:[]}}]){
   assert.equal((await f.call({type:'article',message:'本次请正式一些',assetIds:[],...source})).status,200);
   const chat=f.received.filter(entry=>entry.path==='/api/chat/stream').at(-1)!.body as {message:string;toolsets:string[];use_knowledge:boolean};assert.match(chat.message,/文章偏好独立标记/);assert.doesNotMatch(chat.message,/日常偏好独立标记/);assert.match(chat.message,/本次具体要求优先/);assert.equal(chat.use_knowledge,false);assert.deepEqual(chat.toolsets,Object.keys(source).length?[]:['safe']);
  }
  assert.equal((await f.call({type:'moment',message:'虚构日常',assetIds:[]})).status,200);const prompt=(f.received.filter(entry=>entry.path==='/api/chat/stream').at(-1)!.body as {message:string}).message;assert.match(prompt,/日常偏好独立标记/);assert.doesNotMatch(prompt,/文章偏好独立标记/);assert.equal(f.store.listItems(true).length,0);
 }finally{await f.close();}
});

test('default preferences do not add upstream interview collection intent to a project description',async()=>{
 const f=await fixture();try{
  const source='这是一个用于收集 Java 面试题的项目。';
  // Mirrors the existing upstream quick classifier: negation and quoted text still match.
  const collects=(message:string)=>/面经|面试题|interview/i.test(message)&&/搜索|搜集|收集|查找|抓取/.test(message)&&/知识库|入库|保存|https?:\/\//i.test(message);
  assert.equal(collects(irisBlogPrompt('整理成博客','article',0,source)),false);
  for(const extra of [{},{sourceReply:source}]){
   assert.equal((await f.call({type:'article',message:Object.keys(extra).length?'整理成博客':source,assetIds:[],...extra})).status,200);
   const prompt=(f.received.filter(entry=>entry.path==='/api/chat/stream').at(-1)!.body as {message:string}).message;
   assert.equal(collects(prompt),false);
  }
 }finally{await f.close();}
});

test('current preview revision protects images, uses no tools and never writes a blog record',async()=>{
 const f=await fixture();try{
  const id='00000000-0000-0000-0000-000000000001';
  const sourceDraft={type:'article',title:'手动新标题',body:`手动的新内容\n\n![说明](/api/files/${id}?inline=1 "article-50")`,category:'手动分类',tags:['我的标签'],summary:'我的摘要',images:[id]};
  const valid={message:'标题自然一点',type:'article',assetIds:[],sourceDraft};
  assert.equal((await f.call(valid,false)).status,401);assert.equal((await f.call(valid,true,'https://evil.test')).status,403);
  for(const body of [{...valid,sourceReply:'冲突'},{...valid,assetIds:[id]},{...valid,sourceDraft:{...sourceDraft,body:''}},{...valid,type:'moment'}])assert.equal((await f.call(body)).status,400);
  assert.equal(f.received.length,0);
  f.setOutput(JSON.stringify({...answer,body:'新的内容\n\n{IRIS_IMAGE_1}'}));
  const response=await f.call(valid);assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.revision.body,`新的内容\n\n![说明](/api/files/${id}?inline=1 "article-50")`);assert.equal(result.revision.title,answer.title);assert.equal(result.candidate,undefined);
  const chat=f.received.find(entry=>entry.path==='/api/chat/stream')!.body as {message:string;toolsets:string[];use_knowledge:boolean;attachment_ids:string[]};
  assert.ok(chat.message.includes('手动新标题'));assert.ok(chat.message.includes('手动的新内容'));assert.ok(chat.message.includes('标题自然一点'));assert.deepEqual(chat.toolsets,[]);assert.equal(chat.use_knowledge,false);assert.deepEqual(chat.attachment_ids,[]);
  assert.equal(f.received.filter(entry=>entry.path.endsWith('/attachments')).length,0);assert.equal(f.store.listItems(true).length,0);
  f.setOutput(JSON.stringify(answer));assert.equal((await f.call(valid)).status,502);assert.equal(f.store.listItems(true).length,0);
 }finally{await f.close();}
});
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-iris-blog-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);
  let output=JSON.stringify(answer);let fail=false;let prelude=false;const received:{path:string;body:unknown}[]=[];
  async function bytes(req:IncomingMessage){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks);}
  const server=createServer(async(req,res)=>{
    const raw=await bytes(req);let body:unknown;
    if(req.url?.endsWith('/attachments')){const form=await new Request('http://localhost',{method:'POST',headers:{'Content-Type':req.headers['content-type']||''},body:raw}).formData();const file=form.get('file') as File;body={name:file.name,size:file.size};}
    else body=raw.length?JSON.parse(raw.toString()):null;
    received.push({path:req.url||'',body});
    if(fail){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"detail":"unavailable"}');return;}
    if(req.url==='/api/sessions'){res.setHeader('Content-Type','application/json');res.end('{"id":"blog-session","name":"博客写作"}');}
    else if(req.url?.endsWith('/attachments')){res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({attachment:{id:`attachment-${received.length}`,extraction_status:'ready'}}));}
    else if(req.url==='/api/chat/stream'){res.setHeader('Content-Type','application/x-ndjson');if(prelude){res.write(JSON.stringify({type:'text_delta',data:{content:'我先读取素材。'}})+'\n');res.write(JSON.stringify({type:'tool_started',data:{name:'read_attachment'}})+'\n');res.write(JSON.stringify({type:'tool_finished',data:{name:'read_attachment'}})+'\n');}const midpoint=Math.floor(output.length/2);res.write(JSON.stringify({type:'text_delta',data:{content:output.slice(0,midpoint)}})+'\n');res.end(JSON.stringify({type:'text_delta',data:{content:output.slice(midpoint)}})+'\n'+JSON.stringify({type:'message_completed',data:{message_id:'final-message'}})+'\n');}
    else {res.writeHead(404);res.end();}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://localhost:3000';const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const call=(body:unknown,owner=true,source=origin,method='POST')=>withRuntime(store,{appUrl:origin,irisBaseUrl:base,irisApiToken:'server-only-test-token'},()=>handleErrors(()=>irisApi(new Request(`${origin}/api/iris/blog/prepare`,{method,headers:{origin:source,...(owner?{cookie:`world-session=${token}`}:{})},body:method==='GET'?undefined:JSON.stringify(body)}),['iris','blog','prepare'])));
  const save=(body:unknown,id?:string)=>withRuntime(store,{appUrl:origin},()=>handleErrors(()=>itemsApi(new Request(`${origin}/api/items${id?'/'+id:''}`,{method:id?'PUT':'POST',headers:{origin,cookie:`world-session=${token}`},body:JSON.stringify(body)}),id?['items',id]:['items'])));
  const read=(id:string)=>withRuntime(store,{appUrl:origin},()=>handleErrors(()=>itemsApi(new Request(`${origin}/api/items/${id}`,{headers:{cookie:`world-session=${token}`}}),['items',id])));
  return {store,call,save,read,received,setOutput(value:string){output=value;},setPrelude(){prelude=true;},setFail(){fail=true;},async close(){await new Promise<void>(resolve=>server.close(()=>resolve()));store.close();rmSync(directory,{recursive:true,force:true});}};
}

test('Iris generates a private preview with attached materials and publishes only through an explicit blog save',async()=>{
  const f=await fixture();try{
    const photo=f.store.addAsset({name:'雨天.png',mime:'image/png',size:8,category:'记录图片'});await f.store.writeAsset(photo.id,Buffer.from([137,80,78,71,13,10,26,10]));
    const doc=f.store.addAsset({name:'笔记.md',mime:'application/octet-stream',size:6,category:'Iris 素材'});await f.store.writeAsset(doc.id,Buffer.from('笔记'));
    const response=await f.call({message:'把今天的散步整理成一篇文章。',type:'article',assetIds:[photo.id,doc.id]});assert.equal(response.status,200);
    const candidate=(await response.json()).candidate as Item;
    assert.equal(candidate.title,'雨天的散步');assert.ok(candidate.body.startsWith(answer.body));assert.ok(candidate.body.includes(`/api/files/${photo.id}?inline=1`));assert.equal(candidate.status,'draft');assert.equal(candidate.article?.summary,answer.summary);
    assert.equal(candidate.assetId,photo.id);assert.deepEqual(candidate.images,[{assetId:photo.id}]);
    assert.deepEqual(f.store.listItems(true),[]);assert.equal(f.store.isPublicAsset(photo.id),false);assert.equal(f.store.isPublicAsset(doc.id),false);
    assert.deepEqual(f.received.filter(entry=>entry.path.endsWith('/attachments')).map(entry=>entry.body),[{name:'雨天.png',size:8},{name:'笔记.md',size:6}]);
    const chat=f.received.find(entry=>entry.path==='/api/chat/stream')!.body as {attachment_ids:string[];message:string;toolsets:string[]};
    assert.equal(chat.attachment_ids.length,2);assert.ok(chat.message.includes('把今天的散步'));assert.deepEqual(chat.toolsets,['safe']);
    const saved=await f.save({...candidate,status:'published',clientRequestId:candidate.id});assert.equal(saved.status,201);
    assert.equal(f.store.listItems(false).length,1);assert.equal(f.store.isPublicAsset(photo.id),true);assert.equal(f.store.isPublicAsset(doc.id),false);
    assert.equal((await f.save({...candidate,status:'published',clientRequestId:candidate.id})).status,201);assert.equal(f.store.listItems(true).length,1);
  }finally{await f.close();}
});

test('preview generation rejects anonymous, cross-site and invalid material requests before reaching Iris',async()=>{
  const f=await fixture();try{
    const valid={message:'今天的记录',type:'moment',assetIds:[]};
    assert.equal((await f.call(valid,false)).status,401);assert.equal((await f.call(valid,true,'https://evil.test')).status,403);
    for(const body of [{...valid,type:'unknown'},{...valid,message:''},{...valid,assetIds:['bad']},{...valid,assetIds:Array(11).fill('00000000-0000-0000-0000-000000000000')},{...valid,message:'x'.repeat(10001)}])assert.equal((await f.call(body)).status,400);
    assert.equal((await f.call({...valid,assetIds:['00000000-0000-0000-0000-000000000000']})).status,404);
    assert.equal((await f.call(valid,true,undefined,'GET')).status,405);assert.equal(f.received.length,0);assert.equal(f.store.listItems(true).length,0);
  }finally{await f.close();}
});

test('chat replies are edited into complete blog metadata with no tools and no automatic save',async()=>{
 const f=await fixture();try{
  const sourceReply='我先确认项目，抓取超时。\n\n下面是预览稿：\n一个让我顺手学英语的工具。';
  const response=await f.call({message:'把回答整理成博客',type:'article',assetIds:[],sourceReply});assert.equal(response.status,200);
  const result=(await response.json()).candidate;assert.equal(result.title,answer.title);assert.equal(result.article.summary,answer.summary);assert.deepEqual(result.tags,answer.tags);assert.equal(result.category,answer.category);
  const chat=f.received.find(entry=>entry.path==='/api/chat/stream')!.body as {message:string;toolsets:string[];use_knowledge:boolean};
  assert.ok(chat.message.includes(sourceReply));assert.match(chat.message,/重新拟定/);assert.match(chat.message,/过程说明/);assert.match(chat.message,/未核实/);
  assert.deepEqual(chat.toolsets,[]);assert.equal(chat.use_knowledge,false);assert.equal(result.status,'draft');assert.equal(f.store.listItems(true).length,0);
 }finally{await f.close();}
});

test('invalid chat source replies and mixed materials are rejected before reaching Iris',async()=>{
 const f=await fixture();try{
  const body={message:'整理聊天',type:'moment',assetIds:[]};
  for(const sourceReply of ['', '  ', null, 123, 'x'.repeat(50001)])assert.equal((await f.call({...body,sourceReply})).status,400);
  assert.equal((await f.call({...body,sourceReply:'有效回答',assetIds:['00000000-0000-0000-0000-000000000000']})).status,400);
  assert.equal((await f.call({...body,sourceReply:'有效回答'},false)).status,401);assert.equal(f.received.length,0);
 }finally{await f.close();}
});

test('malformed or oversized Iris answers never create content; Markdown JSON fences are accepted',async()=>{
  const f=await fixture();try{
    for(const output of ['Iris 尚未整理完成。',JSON.stringify({...answer,title:'x'.repeat(161)}),JSON.stringify({...answer,body:'x'.repeat(50001)}),JSON.stringify({...answer,tags:['x'.repeat(31)]}),JSON.stringify({...answer,body:12}),JSON.stringify({...answer,body:'![secret](/api/files/00000000-0000-0000-0000-000000000000?inline=1)'})]){
      f.setOutput(output);assert.equal((await f.call({message:'整理一下',type:'article',assetIds:[]})).status,502);assert.equal(f.store.listItems(true).length,0);
    }
    f.setOutput('```json\n'+JSON.stringify(answer)+'\n```');const response=await f.call({message:'整理一下',type:'moment',assetIds:[]});assert.equal(response.status,200);const candidate=(await response.json()).candidate;assert.equal(candidate.article,null);assert.equal(candidate.status,'draft');
    f.setFail();assert.equal((await f.call({message:'整理一下',type:'moment',assetIds:[]})).status,503);assert.equal(f.store.listItems(true).length,0);
  }finally{await f.close();}
});

test('attachment-reading commentary is excluded from the final structured preview',async()=>{
  const f=await fixture();try{
    f.setPrelude();const response=await f.call({message:'读取素材并整理文章',type:'article',assetIds:[]});assert.equal(response.status,200);
    assert.equal((await response.json()).candidate.title,answer.title);assert.equal(f.store.listItems(true).length,0);
  }finally{await f.close();}
});

test('retrying an already-created assistant post applies later edits and a private draft choice',async()=>{
  const f=await fixture();const realFetch=globalThis.fetch;try{
    const candidate=(await (await f.call({message:'整理文章',type:'article',assetIds:[]})).json()).candidate as Item;
    await f.save({...candidate,status:'published',clientRequestId:candidate.id});
    // The first save committed, but its response was lost. The next browser request uses the same ID.
    globalThis.fetch=(async(url,options)=>{
      const path=String(url);if(!path.startsWith('/api/items'))return realFetch(url,options);
      if(!options?.method||options.method==='GET')return f.read(path.split('/').pop()!);
      return f.save(JSON.parse(String(options?.body)),options?.method==='PUT'?path.split('/').pop():undefined);
    }) as typeof fetch;
    const saved=await saveEditorItem({...candidate,title:'重试后修改的标题',body:'保留我的新正文。',visibility:'private',status:'draft'},undefined,candidate.id);
    assert.equal(saved.title,'重试后修改的标题');assert.equal(saved.visibility,'private');assert.equal(saved.status,'draft');
    assert.equal(f.store.getItem(candidate.id)?.body,'保留我的新正文。');assert.equal(f.store.listItems(false).length,0);assert.equal(f.store.listItems(true).length,1);
  }finally{globalThis.fetch=realFetch;await f.close();}
});

test('a retry can change its cover and privacy after the original creation response was lost',async()=>{
  const f=await fixture();const realFetch=globalThis.fetch;try{
    const candidate=(await (await f.call({message:'整理文章',type:'article',assetIds:[]})).json()).candidate as Item;
    await f.save({...candidate,status:'published',clientRequestId:candidate.id});
    const cover=f.store.addAsset({name:'cover.png',mime:'image/png',size:8,category:'图片'});await f.store.writeAsset(cover.id,Buffer.from([137,80,78,71,13,10,26,10]));
    globalThis.fetch=(async(url,options)=>{const path=String(url);if(!path.startsWith('/api/items'))return realFetch(url,options);if(!options?.method||options.method==='GET')return f.read(path.split('/').pop()!);return f.save(JSON.parse(String(options?.body)),options.method==='PUT'?path.split('/').pop():undefined);}) as typeof fetch;
    const saved=await saveEditorItem({...candidate,assetId:cover.id,images:[{assetId:cover.id}],visibility:'private',status:'draft'},undefined,candidate.id);
    assert.equal(saved.assetId,cover.id);assert.equal(saved.visibility,'private');assert.equal(saved.status,'draft');assert.equal(f.store.listItems(false).length,0);assert.equal(f.store.listItems(true).length,1);
  }finally{globalThis.fetch=realFetch;await f.close();}
});
