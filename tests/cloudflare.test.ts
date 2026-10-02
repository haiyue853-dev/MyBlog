import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {Store} from '../src/lib/store';
import {hashPassword,parseScryptEncoded} from '../src/lib/security';
import {DEFAULT_PROFILE} from '../src/lib/types';
import {deriveCloudLoginKey,CLOUD_PASSWORD_SCHEME} from '../src/lib/cloud-password';
import {exportCloudflare,migratePassword} from '../scripts/export-cloudflare';
import {verifyCloudPassword} from '../cloudflare/worker';

test('browser scrypt preserves existing Unicode passwords; stored verifier cannot log in',async()=>{
  for(const password of ['original-password-2026','小屋密码♡🎵2026']){
    // 本地哈希现在是 `scrypt$N$r$p$salt$hash`（带成本参数），用 parseScryptEncoded 取字段，
    // 别再按冒号切 —— 那套格式只属于旧的 `scrypt:salt:hash`。
    const original=hashPassword(password);const encoded=migratePassword(original);
    const parsed=parseScryptEncoded(original)!;
    const key=await deriveCloudLoginKey(password,{scheme:CLOUD_PASSWORD_SCHEME,salt:parsed.salt,cost:parsed.N});
    assert.equal(key,parsed.hash);assert.ok(await verifyCloudPassword(key,encoded));
    assert.equal(await verifyCloudPassword(encoded.split(':')[2],encoded),false);
    assert.equal(await verifyCloudPassword('0'.repeat(128),encoded),false);
  }
});

test('full package keeps private import outside public assets; Workers enforce auth, uploads and origin',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'little-world-cloudflare-'));const source=join(directory,'source');const output=join(directory,'package');
  const store=new Store(source);let mf:Miniflare|undefined;
  try{
    store.setOwner('迁移站主',hashPassword('cloudflare-test-password'));
    store.db.prepare('INSERT INTO settings(key,data) VALUES(?,?)').run('iris','PRIVATE_IRIS_TOKEN_MARKER');
    store.createSession('PRIVATE_OLD_SESSION_MARKER',Date.now()+60000);
    const avatar=store.addAsset({name:'avatar.png',mime:'image/png',size:8,category:'头像'});
    writeFileSync(join(source,'files',avatar.id),Buffer.from([137,80,78,71,13,10,26,10]));
    store.saveProfile({...DEFAULT_PROFILE,name:'Cloudflare验收小屋',avatarId:avatar.id});
    store.saveItem({kind:'moment',title:'公开记录',body:'PUBLIC_BODY_MARKER',visibility:'public',tags:[],category:'生活',url:'',assetId:null});
    store.saveItem({kind:'moment',title:'私人记录',body:'PRIVATE_BODY_MARKER'+"汉字🎵'".repeat(10000),visibility:'private',tags:[],category:'生活',url:'',assetId:null});
    store.close();
    const result=await exportCloudflare(source,output);assert.equal(result.itemCount,2);
    const sql=readFileSync(join(output,'private-import/data.sql'),'utf8');
    assert.ok(!sql.includes('PRIVATE_IRIS_TOKEN_MARKER'));assert.ok(!sql.includes('PRIVATE_OLD_SESSION_MARKER'));
    assert.ok(!/scrypt:[a-f0-9]{32}:[a-f0-9]{128}/.test(sql));
    assert.ok(readdirSync(join(output,'public')).every(name=>!name.includes('private')));
    const client=readFileSync(join(output,'public/assets/site.js'),'utf8');
    assert.ok(!client.includes('PRIVATE_BODY_MARKER'));assert.ok(!client.includes('PUBLIC_BODY_MARKER'));assert.ok(!client.includes(avatar.id));
    assert.ok(!readFileSync(join(output,'worker.js'),'utf8').includes('node:sqlite'));
    mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'test',modules:true,scriptPath:join(output,'worker.js'),compatibilityDate:'2026-10-02',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],stripCfConnectingIp:false}]}));
    const db=await mf.getD1Database('DB');const files=await mf.getR2Bucket('FILES');
    // Match Wrangler execute: statements can be replayed after interrupted initial import.
    for(const statement of readFileSync(join(output,'schema.sql'),'utf8').split('\n').filter(Boolean))await db.exec(statement);
    for(const statement of sql.split('\n').filter(Boolean)){assert.ok(Buffer.byteLength(statement)<100000);await db.exec(statement);}
    for(const statement of sql.split('\n').filter(Boolean))await db.exec(statement);
    await files.put(avatar.id,Buffer.from([137,80,78,71,13,10,26,10]));
    const call=async(path:string,method='GET',body?:unknown,cookie='',ip='192.0.2.10',origin='https://little-world.test')=>{
      const headers:Record<string,string>={origin,'cf-connecting-ip':ip};if(cookie)headers.cookie=cookie;
      if(body&&!(body instanceof FormData))headers['content-type']='application/json';
      const request=new Request(`https://little-world.test/api/${path}`,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
      return mf!.dispatchFetch(request.url,{method,headers:Object.fromEntries(request.headers),body:body?await request.arrayBuffer():undefined});
    };
    const bootstrap=await (await call('bootstrap')).json() as {items:{id:string;body:string}[];owner:boolean};
    assert.equal(bootstrap.owner,false);assert.deepEqual(bootstrap.items.map(item=>item.body),['PUBLIC_BODY_MARKER']);
    const publicId=bootstrap.items[0].id;
    const firstVisit=await call(`likes?ids=${publicId}`);
    assert.equal(firstVisit.status,200);
    const visitorCookie=firstVisit.headers.get('set-cookie')!.split(';')[0];
    assert.ok(firstVisit.headers.get('set-cookie')!.includes('HttpOnly'));
    const votes=await Promise.all(Array.from({length:16},()=>call(`likes/${publicId}`,'POST',undefined,visitorCookie)));
    const voteData=await Promise.all(votes.map(response=>response.json() as Promise<{added:boolean}>));
    assert.equal(voteData.filter(value=>value.added).length,1,'D1 atomically accepts only one concurrent vote');
    const anotherVisitor=(await call(`likes?ids=${publicId}`)).headers.get('set-cookie')!.split(';')[0];
    const anotherVote=await (await call(`likes/${publicId}`,'POST',undefined,anotherVisitor)).json() as {like:{count:number;liked:boolean}};
    assert.deepEqual(anotherVote.like,{count:2,liked:true});
    assert.equal((await call(`likes/${publicId}`,'POST',undefined,visitorCookie,'192.0.2.10','https://evil.test')).status,403);
    const storedVotes=await db.prepare('SELECT count FROM item_like_counts WHERE item_id=?').bind(publicId).first<{count:number}>();
    assert.equal(storedVotes!.count,2);
    const beforeStats=await (await call('stats')).json() as {stats:{totalViews:number;content:{moments:number;collections:number;likes:number}}};
    assert.equal(beforeStats.stats.totalViews,0);assert.deepEqual(beforeStats.stats.content.moments,1);assert.equal(beforeStats.stats.content.collections,0);assert.equal(beforeStats.stats.content.likes,2);
    const sameEvent=randomUUID();
    const repeatedViews=await Promise.all(Array.from({length:16},()=>call('stats','POST',{view:'about',eventId:sameEvent},visitorCookie)));
    const repeatedStats=await Promise.all(repeatedViews.map(response=>response.json() as Promise<{recorded:boolean}>));
    assert.equal(repeatedStats.filter(value=>value.recorded).length,1,'D1 records a navigation event once');
    const otherViews=await Promise.all(Array.from({length:16},()=>call('stats','POST',{view:'stats',eventId:randomUUID()},anotherVisitor)));
    assert.ok(otherViews.every(response=>response.status===200));
    const realStats=await (await call('stats')).json() as {stats:{totalViews:number;totalVisitors:number;todayVisitors:number}};
    assert.equal(realStats.stats.totalViews,17);assert.equal(realStats.stats.totalVisitors,2);assert.equal(realStats.stats.todayVisitors,2);
    assert.equal((await call('stats','POST',{view:'settings',eventId:randomUUID()},visitorCookie)).status,400);
    assert.equal((await call('stats','POST',{view:'home',eventId:randomUUID()},visitorCookie,'192.0.2.10','https://invalid.example')).status,403);
    assert.equal((await call('files')).status,401);
    assert.equal((await call(`files/${avatar.id}?inline=1`)).status,200);
    assert.equal((await call('auth/setup','POST',{password:'cannot-reset'})).status,409);
    const auth=await (await call('auth')).json() as {challenge:{scheme:typeof CLOUD_PASSWORD_SCHEME;salt:string}};
    assert.ok(!JSON.stringify(auth).includes('password'));assert.ok(!JSON.stringify(auth).includes('scrypt-client-sha256-v1:'));
    const key=await deriveCloudLoginKey('cloudflare-test-password',auth.challenge);
    const wrongOrigin=await call('auth/login','POST',{password:key},'','192.0.2.10','https://evil.test');assert.equal(wrongOrigin.status,403);
    const login=await call('auth/login','POST',{password:key});assert.equal(login.status,200);
    const setCookie=login.headers.get('set-cookie')!;assert.ok(setCookie.includes('HttpOnly')&&setCookie.includes('Secure'));
    const cookie=setCookie.split(';')[0];
    const privateItems=await (await call('items','GET',undefined,cookie)).json() as {items:{body:string}[]};
    assert.equal(privateItems.items.length,2);assert.equal(privateItems.items.find(item=>item.body.startsWith('PRIVATE'))!.body,'PRIVATE_BODY_MARKER'+"汉字🎵'".repeat(10000));
    const form=new FormData();form.append('file',new File(['PRIVATE_UPLOAD_MARKER'],'秘密.md',{type:'text/markdown'}));
    const uploaded=await call('files','POST',form,cookie);assert.equal(uploaded.status,201);
    const upload=await uploaded.json() as {file:{id:string}};const id=upload.file.id;
    assert.equal((await call(`files/${id}`)).status,401);
    assert.equal(await (await call(`files/${id}`,'GET',undefined,cookie)).text(),'PRIVATE_UPLOAD_MARKER');
    assert.equal((await call(`files/${id}`,'DELETE',undefined,cookie)).status,200);
    assert.equal((await call(`files/${id}`,'GET',undefined,cookie)).status,404);
    assert.equal((await call(`files/${avatar.id}`,'DELETE',undefined,cookie)).status,409);
    assert.equal((await call('iris/health','GET',undefined,cookie)).status,503);
    const failures=await Promise.all(Array.from({length:20},()=>call('auth/login','POST',{password:'0'.repeat(128)},'','192.0.2.20')));
    // 并发不能绕过阈值：真正拿到密码校验机会（401）的绝不超过 4 次，其余一律 429。
    // 这里不写死 4/16 —— D1 是异步的，20 个请求交错时具体有几个抢到名额并不确定（实测常是 1~4），
    // 但「不会多于 阈值-1」才是要守住的安全性质。
    const guessed=failures.filter(response=>response.status===401).length;
    assert.ok(guessed<=4,`concurrency must not grant more than 4 guesses, got ${guessed}`);
    assert.equal(failures.filter(response=>response.status===429).length,20-guessed);
    assert.equal((await call('auth/login','POST',{password:key},'','192.0.2.21')).status,200);
    assert.equal((await call('auth/logout','POST',undefined,cookie)).status,200);
    assert.equal((await call('files','GET',undefined,cookie)).status,401);
    await assert.rejects(exportCloudflare(source,output),/EEXIST/);
    await assert.rejects(exportCloudflare(source,join(source,'unsafe')),/数据目录之外/);
  }finally{await mf?.dispose();try{store.close();}catch{}rmSync(directory,{recursive:true,force:true});}
});
