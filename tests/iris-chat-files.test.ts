import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {irisApi} from '../src/lib/api/iris';
import {handleErrors,newToken} from '../src/lib/http';
import {appendChatFiles,validateChatFile,uploadChatFiles,droppedChatFiles,MAX_CHAT_FILE_SIZE} from '../src/lib/iris-chat-files';
import {IrisChatComposer} from '../src/components/iris-chat-composer';
import {IrisChatMessage} from '../src/components/iris-chat-message';

test('dragged and chosen files share validation, keep current files on invalid additions and cap at ten',()=>{
 const file=new File(['虚构资料'],'测试.md');const selected=appendChatFiles([], [file]);assert.equal(selected.length,1);assert.equal(selected[0].file,file);
 for(const input of [{name:'bad.exe',size:5},{name:'empty.txt',size:0},{name:'large.pdf',size:MAX_CHAT_FILE_SIZE+1}])assert.throws(()=>validateChatFile(input));
 assert.throws(()=>appendChatFiles(selected,Array(10).fill(file)));assert.equal(selected.length,1);
 assert.throws(()=>appendChatFiles(selected,[new File(['x'],'bad.zip')]));assert.equal(selected[0].file,file);
 assert.deepEqual(droppedChatFiles({types:['Files'],files:[file] as unknown as FileList}),[file]);
 assert.deepEqual(droppedChatFiles({types:['text/plain'],files:[file] as unknown as FileList}),[]);
});
test('upload retries reuse completed files only in the same session; failed extraction remains an error',async()=>{
 const original=globalThis.fetch;let count=0;let fail=false;let badText=false;
 globalThis.fetch=(async()=>{count++;if(fail&&count===2)return Response.json({error:'第二份失败'},{status:503});return Response.json({attachment:{id:`attachment-${count}`,original_name:'notes.txt',extraction_status:badText?'failed':'ready',media_type:'text/plain',size_bytes:5}});}) as typeof fetch;
 try{
  const files=appendChatFiles([],[new File(['one'],'one.txt'),new File(['two'],'two.txt')]);fail=true;
  await assert.rejects(uploadChatFiles('first-session',files,undefined,(key,uploaded)=>{files.find(file=>file.key===key)!.uploaded=uploaded;}),/第二份失败/);
  fail=false;const ids=await uploadChatFiles('first-session',files);assert.deepEqual(ids,['attachment-1','attachment-3']);assert.equal(count,3);
  await uploadChatFiles('another-session',files);assert.equal(count,5);
  badText=true;await assert.rejects(uploadChatFiles('third-session',[files[1]]),/读取/);
 }finally{globalThis.fetch=original;}
});
test('composer exposes a drop area, accessible picker, pending names and removal; messages retain names',()=>{
 const files=appendChatFiles([],[new File(['x'],'便签.md')]);
 const html=renderToStaticMarkup(createElement(IrisChatComposer,{files,question:'',online:true,sending:false,onFiles:()=>{},onRemove:()=>{},onQuestion:()=>{},onSubmit:()=>{},onStop:()=>{}}));
 assert.match(html,/aria-label="Iris 文件拖放区"/);assert.match(html,/aria-label="给 Iris 添加附件"/);assert.match(html,/便签.md/);assert.match(html,/移除附件 便签.md/);
 assert.doesNotMatch(html,/disabled=""[^>]*aria-label="发送问题"/);
 const message=renderToStaticMarkup(createElement(IrisChatMessage,{role:'user',content:'看看文件',attachments:[{id:'attachment-1',original_name:'便签.md'}]}));assert.match(message,/便签.md/);
});
test('private multipart proxy forwards actual bytes and chat attachment IDs without any blog write',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'iris-chat-files-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);const seen:{url:string;body:unknown;authorized:boolean}[]=[];
 const server=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks);let body:unknown;
  if(req.url?.endsWith('/attachments')){const form=await new Request('http://localhost',{method:'POST',headers:{'Content-Type':req.headers['content-type']!},body:bytes}).formData();const file=form.get('file') as File;body={name:file.name,text:await file.text()};res.setHeader('Content-Type','application/json');res.writeHead(201);res.end(JSON.stringify({attachment:{id:'attachment-1',original_name:file.name,size_bytes:file.size,media_type:file.type,extraction_status:'ready'}}));}
  else{body=JSON.parse(bytes.toString());res.setHeader('Content-Type','application/x-ndjson');res.end('{"type":"message_completed","data":{"content":"已读到虚构资料"}}\n');}
  seen.push({url:req.url||'',body,authorized:req.headers.authorization==='Bearer server-test-only'});
 });await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://localhost:3000';const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const call=(path:string[],body?:FormData|object,owner=true,source=origin,method='POST',length?:string)=>withRuntime(store,{appUrl:origin,irisBaseUrl:base,irisApiToken:'server-test-only'},()=>handleErrors(()=>irisApi(new Request(`${origin}/api/${path.join('/')}`,{method,headers:{origin:source,...(owner?{cookie:`world-session=${token}`}:{ }),...(length?{'content-length':length}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined}),path)));
 const form=(name='notes.txt')=>{const data=new FormData();data.append('file',new File(['虚构附件资料'],name,{type:'text/plain'}));return data;};const upload=['iris','sessions','session-one','attachments'];
 try{
  assert.equal((await call(upload,form(),false)).status,401);assert.equal((await call(upload,form(),true,'https://evil.test')).status,403);
  assert.equal((await call(upload,form('bad.exe'))).status,400);assert.equal((await call(upload,new FormData())).status,400);assert.equal((await call(upload,form(),true,origin,'POST',String(MAX_CHAT_FILE_SIZE+100000))).status,413);
  assert.equal((await call(upload,undefined,true,origin,'GET')).status,405);assert.equal((await call(['iris','sessions','..','attachments'],form())).status,400);assert.equal(seen.length,0);
  const response=await call(upload,form());assert.equal(response.status,201);assert.equal((await response.json()).attachment.id,'attachment-1');assert.deepEqual(seen[0].body,{name:'notes.txt',text:'虚构附件资料'});assert.ok(seen[0].authorized);
  const chat={session_id:'session-one',message:'看看附件',attachment_ids:['attachment-1'],toolsets:['automation'],use_knowledge:false};assert.equal((await call(['iris','chat','stream'],chat)).status,200);assert.deepEqual((seen.at(-1)?.body as Record<string,unknown>).attachment_ids,['attachment-1']);assert.deepEqual((seen.at(-1)?.body as Record<string,unknown>).toolsets,['safe','knowledge','research']);
  const before=seen.length;for(const ids of [['../bad'],['attachment-1','attachment-1'],Array(11).fill('a'),{},null])assert.equal((await call(['iris','chat','stream'],{...chat,attachment_ids:ids})).status,400);assert.equal(seen.length,before);assert.equal(store.listItems(true).length,0);assert.equal(store.listAssets().length,0);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));store.close();rmSync(directory,{recursive:true,force:true});}
});
