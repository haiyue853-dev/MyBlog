import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {getStore} from '../src/lib/store';
import {hashPassword} from '../src/lib/security';
import {GET as handler} from '../src/app/api/[...path]/route';

const directory=mkdtempSync(join(tmpdir(),'world-api-'));process.env.DATA_DIR=directory;process.env.APP_URL='http://localhost:3000';
const store=getStore();store.setOwner('测试站主',hashPassword('test-owner-password'));
after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
async function request(path:string,method='GET',body?:unknown,cookie='',origin:string|null='http://localhost:3000'){
  const headers:Record<string,string>={};if(cookie)headers.cookie=cookie;if(origin)headers.origin=origin;if(body&&! (body instanceof FormData))headers['content-type']='application/json';
  return handler(new Request(`http://localhost:3000/api/${path}`,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined}),{params:Promise.resolve({path:path.split('/')})});
}
let cookie='';
test('API requires login for private operations',async()=>{
  assert.equal((await request('files')).status,401);
  assert.equal((await request('files','POST',new FormData())).status,401);
  assert.equal((await request('items','POST',{title:'secret'})).status,401);
  assert.equal((await request('iris/health')).status,401);
});
test('login issues HttpOnly cookie, rejects cross-origin and invalid password',async()=>{
  assert.equal((await request('auth/login','POST',{password:'test-owner-password'},'', 'http://bad.example')).status,403);
  assert.equal((await request('auth/login','POST',{password:'wrong'})).status,401);
  const response=await request('auth/login','POST',{password:'test-owner-password'});assert.equal(response.status,200);
  const header=response.headers.get('set-cookie')||'';assert.ok(header.includes('HttpOnly'));assert.ok(header.includes('SameSite=Lax'));cookie=header.split(';')[0];
});
test('private file and metadata are protected until explicitly attached to a public item',async()=>{
  const form=new FormData();form.append('file',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'test.png',{type:'image/png'}));
  const uploaded=await request('files','POST',form,cookie);assert.equal(uploaded.status,201);const asset=(await uploaded.json()).file;
  assert.equal((await request(`files/${asset.id}`)).status,401);
  const created=await request('items','POST',{kind:'moment',title:'secret title',body:'private content',visibility:'private',assetId:asset.id,tags:[],category:'生活',url:''},cookie);
  assert.equal(created.status,201);const item=(await created.json()).item;
  assert.equal((await (await request('items')).json()).items.length,0);
  assert.equal((await request(`items/${item.id}`)).status,404);
  assert.equal((await request(`files/${asset.id}`,'DELETE',undefined,cookie)).status,409);
  assert.equal((await request(`items/${item.id}`,'PUT',{...item,visibility:'public'},cookie)).status,200);
  const publicImage=await request(`files/${asset.id}`);assert.equal(publicImage.status,200);assert.equal(publicImage.headers.get('cache-control'),'private, no-store');
  assert.equal((await request(`items/${item.id}`,'PUT',{...item,visibility:'private'},cookie)).status,200);
  assert.equal((await request(`files/${asset.id}`)).status,401);
  assert.equal((await request(`items/${item.id}`,'DELETE',undefined,cookie)).status,200);
  assert.equal((await request(`files/${asset.id}`,'DELETE',undefined,cookie)).status,200);
});
test('Iris proxy preserves local content events without exposing private endpoints',async()=>{
  const upstream=createServer((req,res)=>{if(req.url==='/api/chat/stream'){res.setHeader('Content-Type','application/x-ndjson');res.end('{"type":"text_delta","data":{"content":"来自 Iris"}}\n');}else if(req.url?.endsWith('/source')){res.setHeader('Content-Type','text/html');if(req.url.includes('doc-named'))res.setHeader('Content-Disposition',`inline; filename="plan.pdf"; filename*=UTF-8''%E5%B9%B4%E5%BA%A6%E8%AE%A1%E5%88%92.pdf`);if(req.url.includes('doc-plain'))res.setHeader('Content-Disposition','attachment; filename="quarterly report.xlsx"');if(req.url.includes('doc-traversal'))res.setHeader('Content-Disposition','attachment; filename="../../etc/passwd"');res.end('<html>source</html>');}else {res.setHeader('Content-Type','application/json');res.end('{"status":"ok"}');}});
  await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));const address=upstream.address() as {port:number};process.env.IRIS_BASE_URL=`http://127.0.0.1:${address.port}`;
  try{
    assert.equal((await request('iris/settings', 'GET',undefined,cookie)).status,404);
    const response=await request('iris/chat/stream','POST',{session_id:'session-test',message:'你好'},cookie);assert.equal(response.status,200);assert.ok((await response.text()).includes('来自 Iris'));
    const source=await request('iris/knowledge/doc-test/source','GET',undefined,cookie);assert.equal(source.headers.get('content-disposition'),'attachment; filename="iris-source"');assert.equal(source.headers.get('content-type'),'application/octet-stream');
    const named=await request('iris/knowledge/doc-named/source','GET',undefined,cookie);assert.equal(named.status,200);assert.equal(named.headers.get('content-disposition'),`attachment; filename="____.pdf"; filename*=UTF-8''%E5%B9%B4%E5%BA%A6%E8%AE%A1%E5%88%92.pdf`);
    const plain=await request('iris/knowledge/doc-plain/source','GET',undefined,cookie);assert.equal(plain.headers.get('content-disposition'),'attachment; filename="quarterly report.xlsx"');
    const traversal=await request('iris/knowledge/doc-traversal/source','GET',undefined,cookie);assert.equal(traversal.headers.get('content-disposition'),'attachment; filename="passwd"');
  }finally{await new Promise<void>(resolve=>upstream.close(()=>resolve()));delete process.env.IRIS_BASE_URL;}
});
test('offline Iris returns a useful 503 while the private file cabinet still works',async()=>{
  const unavailable=createServer();await new Promise<void>(resolve=>unavailable.listen(0,'127.0.0.1',resolve));
  const port=(unavailable.address() as {port:number}).port;await new Promise<void>(resolve=>unavailable.close(()=>resolve()));
  process.env.IRIS_BASE_URL=`http://127.0.0.1:${port}`;
  try{const response=await request('iris/health','GET',undefined,cookie);assert.equal(response.status,503);assert.match((await response.json()).error,/资料柜仍可正常使用/);assert.equal((await request('files','GET',undefined,cookie)).status,200);}
  finally{delete process.env.IRIS_BASE_URL;}
});
test('logout invalidates the stored session',async()=>{assert.equal((await request('auth/logout','POST',undefined,cookie)).status,200);assert.equal((await request('files','GET',undefined,cookie)).status,401);});
