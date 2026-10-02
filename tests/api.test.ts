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

test('trusted client limits prevent one attacker from blocking the owner and bound request bursts',async()=>{
  process.env.TRUST_PROXY='1';
  const login=(client:string,password:string)=>handler(new Request('http://localhost:3000/api/auth/login',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json','x-little-world-client-ip':client},body:JSON.stringify({password})}),{params:Promise.resolve({path:['auth','login']})});
  try{
    // 阈值现在是 5：前 4 次错密码照常 401，第 5 次触发封禁并写入封禁行，之后一律 429。
    for(let i=0;i<4;i++)assert.equal((await login('192.0.2.1','wrong')).status,401);
    assert.equal((await login('192.0.2.1','wrong')).status,429);
    assert.equal((await login('192.0.2.1','test-owner-password')).status,429);
    assert.equal((await login('192.0.2.2','test-owner-password')).status,200);
    for(let i=0;i<29;i++)assert.equal((await login('192.0.2.2','test-owner-password')).status,200);
    assert.equal((await login('192.0.2.2','test-owner-password')).status,429);
    assert.equal((await login('192.0.2.3','x'.repeat(9000))).status,413);
  }finally{delete process.env.TRUST_PROXY;}
});

test('concurrent slow login bodies cannot bypass the five-failure limit',async()=>{
  process.env.TRUST_PROXY='1';
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  try{
    const pending=Array.from({length:30},()=>{
      const body=new ReadableStream<Uint8Array>({async start(controller){await gate;controller.enqueue(new TextEncoder().encode(JSON.stringify({password:'wrong'})));controller.close();}});
      const init={method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json','x-little-world-client-ip':'192.0.2.4'},body,duplex:'half'} as RequestInit&{duplex:string};
      return handler(new Request('http://localhost:3000/api/auth/login',init),{params:Promise.resolve({path:['auth','login']})});
    });
    await new Promise<void>(resolve=>setImmediate(resolve));release();
    const statuses=(await Promise.all(pending)).map(response=>response.status);
    // 30 个并发里只有前 4 个拿到 401（第 5 个触发封禁），其余 26 个全被 429 挡住。
    assert.equal(statuses.filter(status=>status===401).length,4);
    assert.equal(statuses.filter(status=>status===429).length,26);
  }finally{release();delete process.env.TRUST_PROXY;}
});
