import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {handleErrors,newToken} from '../src/lib/http';
import {irisApi} from '../src/lib/api/iris';

test('owner chat receives web reading tools without accepting client tool escalation',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'iris-web-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);
 const received:Record<string,unknown>[]=[];
 const server=createServer(async(req,res)=>{let text='';for await(const chunk of req)text+=chunk;received.push(JSON.parse(text));res.setHeader('Content-Type','application/x-ndjson');res.end('{"type":"message_completed","data":{"content":"已读取网页"}}\n');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://localhost:3000';const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const call=(owner=true,source=origin,useKnowledge=false)=>withRuntime(store,{appUrl:origin,irisBaseUrl:base},()=>handleErrors(()=>irisApi(new Request(`${origin}/api/iris/chat/stream`,{method:'POST',headers:{origin:source,...(owner?{cookie:`world-session=${token}`}:{})},body:JSON.stringify({session_id:'web-check',message:'请读取 https://github.com/qingjian-team/qingjian',use_knowledge:useKnowledge,toolsets:['coding','browser','automation','mcp']})}),['iris','chat','stream'])));
 try{
  assert.equal((await call(false)).status,401);assert.equal((await call(true,'https://evil.test')).status,403);assert.equal(received.length,0);
  for(const knowledge of [false,true]){const response=await call(true,origin,knowledge);assert.equal(response.status,200);await response.text();assert.deepEqual(received.at(-1)?.toolsets,['safe','knowledge','research']);assert.equal(received.at(-1)?.use_knowledge,knowledge);}
  assert.equal(store.listItems(true).length,0);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));store.close();rmSync(directory,{recursive:true,force:true});}
});
