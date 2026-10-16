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
    const importedArticle=store.saveItem({kind:'moment',title:'公开记录',body:'PUBLIC_BODY_MARKER',visibility:'public',tags:[],category:'生活',url:'',assetId:null,article:{summary:'',kicker:'',series:'',spoiler:false,coverPosition:'center',facts:[],quote:''}});
    const importedComment=store.addComment({itemId:importedArticle.id,visitor:'migration-guest',name:'迁移访客',body:'迁移时保留留言与已读状态',owner:false})!;store.markCommentRead(importedArticle.id,importedComment.id,true);
    store.saveCommentReply(importedArticle.id,importedComment.id,'迁移站主','迁移时保留关联回复');
    store.saveItem({kind:'moment',title:'私人记录',body:'PRIVATE_BODY_MARKER'+"汉字🎵'".repeat(10000),visibility:'private',tags:[],category:'生活',url:'',assetId:null});
    const importedTrash=store.saveItem({...importedArticle,id:randomUUID(),title:'迁移回收站',assetId:avatar.id});store.trashItem(importedTrash.id);
    const importedTravel=[{cityId:'350100',status:'visited' as const,note:'迁移保留旅行手记',date:'2026-04-04',itemId:importedArticle.id}];store.saveTravelPlaces(importedTravel);
    store.close();
    const result=await exportCloudflare(source,output);assert.equal(result.itemCount,3);
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
    for(const [path,method,body] of [
      ['iris/health','GET',undefined],['iris/sessions','GET',undefined],
      ['iris/sessions/private-session','GET',undefined],['iris/knowledge','GET',undefined],
      ['iris/knowledge/collections','GET',undefined],['iris/knowledge/private-document/source','GET',undefined],
      ['iris/sessions','POST',{name:'private'}],['iris/chat/stream','POST',{session_id:'private',message:'hello'}],
      ['iris/import','POST',{assetId:avatar.id}],
    ] as const){
      for(const session of ['',`world-session=${'f'.repeat(64)}`])
        assert.equal((await call(path,method,body,session)).status,401,`${method} ${path} requires the owner before checking Iris configuration`);
    }
    const bootstrap=await (await call('bootstrap')).json() as {items:{id:string;body:string}[];owner:boolean};
    assert.equal(bootstrap.owner,false);assert.deepEqual(bootstrap.items.map(item=>item.body),['PUBLIC_BODY_MARKER']);
    const publicId=bootstrap.items[0].id;
    assert.deepEqual(await (await call('travel')).json(),{places:importedTravel});
    assert.equal((await call('travel','PUT',{places:[]})).status,401);
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
    assert.equal((await call('travel','PUT',{places:[]},cookie,'192.0.2.10','https://evil.test')).status,403);
    assert.equal((await call('travel','PUT',{places:[...importedTravel,{cityId:'350200',status:'wish',note:'下一站',date:'',itemId:null}]},cookie)).status,200);
    assert.equal(((await (await call('travel')).json()) as {places:unknown[]}).places.length,2);
    assert.equal((await call('trash')).status,401);
    const migratedTrash=await (await call('trash','GET',undefined,cookie)).json() as {entries:{item:unknown}[]};assert.equal(migratedTrash.entries.length,1);assert.deepEqual(migratedTrash.entries[0].item,importedTrash);
    assert.equal((await call(`trash/${importedTrash.id}`,'POST',undefined,cookie,'192.0.2.10','https://evil.test')).status,403);
    assert.equal((await call(`trash/${importedTrash.id}`,'POST',undefined,cookie)).status,200);
    assert.deepEqual((await (await call(`items/${importedTrash.id}`,'GET',undefined,cookie)).json() as {item:unknown}).item,importedTrash);
    assert.equal((await call(`trash/${importedTrash.id}`,'DELETE',undefined,cookie)).status,404);
    await call(`items/${importedTrash.id}`,'DELETE',undefined,cookie);await call(`trash/${importedTrash.id}`,'DELETE',undefined,cookie);
    const migratedComments=await (await call('comments','GET',undefined,cookie)).json() as {total:number;unread:number;comments:{id:string;unread:boolean}[]};assert.equal(migratedComments.total,1);assert.equal(migratedComments.unread,0);assert.equal(migratedComments.comments[0].id,importedComment.id);assert.equal(migratedComments.comments[0].unread,false);
    const importedPublic=await (await call(`comments/${importedArticle.id}`)).json() as {comments:{reply:{body:string;name:string}}[]};assert.equal(importedPublic.comments[0].reply.body,'迁移时保留关联回复');assert.equal(importedPublic.comments[0].reply.name,'迁移站主');
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
    const photoIds:string[]=[];
    for(let index=0;index<2;index++){
      const photoForm=new FormData();photoForm.append('file',new File([new Uint8Array([137,80,78,71,13,10,26,10])],`diary-${index}.png`,{type:'image/png'}));
      const photoResponse=await call('files','POST',photoForm,cookie);assert.equal(photoResponse.status,201);
      photoIds.push(((await photoResponse.json()) as {file:{id:string}}).file.id);
    }
    const diaryInput={kind:'moment',title:'多图日记',body:'两张照片',visibility:'public',tags:[],category:'生活',url:'',assetId:photoIds[0],images:photoIds.map(assetId=>({assetId}))};
    const diaryResponse=await call('items','POST',diaryInput,cookie);assert.equal(diaryResponse.status,201);
    const diary=(await diaryResponse.json()) as {item:{id:string;images:{assetId:string}[]}};
    assert.deepEqual(diary.item.images,diaryInput.images);
    const watchConfig={type:'韩剧',state:'watching',rating:8.5,episodes:16,watched:4,year:'2026',reviewId:null};
    const watchResponse=await call('items','POST',{...diaryInput,kind:'collection',assetId:null,images:undefined,watch:watchConfig},cookie);assert.equal(watchResponse.status,201);
    const watchItem=((await watchResponse.json()) as {item:{id:string;watch:unknown}}).item;assert.deepEqual(watchItem.watch,watchConfig);
    assert.deepEqual(((await (await call(`items/${watchItem.id}`)).json()) as {item:{watch:unknown}}).item.watch,watchConfig);
    for(const path of ['bootstrap','items',`items/${watchItem.id}`]){
      const data=await (await call(path)).json() as {items?:{id:string;body:string}[];item?:{id:string;body:string}};
      assert.equal((data.item||data.items!.find(item=>item.id===watchItem.id))!.body,'');
    }
    assert.equal(((await (await call(`items/${watchItem.id}`,'GET',undefined,cookie)).json()) as {item:{body:string}}).item.body,diaryInput.body);
    assert.equal((await call('items','POST',{...diaryInput,kind:'collection',images:undefined,watch:{...watchConfig,watched:17}},cookie)).status,400);
    const createId=randomUUID();
    const repeated=await Promise.all([0,1].map(()=>call('items','POST',{...diaryInput,kind:'collection',images:undefined,clientRequestId:createId},cookie)));
    for(const response of repeated){assert.equal(response.status,201);assert.equal(((await response.json()) as {item:{id:string}}).item.id,createId);}
    const batchItems=await (await call('items','GET',undefined,cookie)).json() as {items:{id:string}[]};
    assert.equal(batchItems.items.filter(item=>item.id===createId).length,1);
    assert.equal((await call(`items/${createId}`,'DELETE',undefined,cookie)).status,200);
    assert.equal((await call('items','POST',{...diaryInput,kind:'collection',images:undefined,clientRequestId:createId},cookie)).status,409);
    assert.equal((await call(`items/${createId}`,'GET',undefined,cookie)).status,404);
    const trashedLikes=await (await call(`likes?ids=${createId}`,'GET',undefined,cookie)).json() as {likes:unknown};assert.deepEqual(trashedLikes.likes,{});
    assert.equal((await call(`files/${photoIds[1]}?inline=1`)).status,200);
    assert.equal((await call(`files/${photoIds[1]}`,'DELETE',undefined,cookie)).status,409);
    const unused=await (await call('files?unused=1','GET',undefined,cookie)).json() as {files:{id:string}[]};
    assert.ok(!unused.files.some(file=>photoIds.includes(file.id)));
    assert.equal((await call(`items/${diary.item.id}`,'PUT',{...diaryInput,visibility:'private'},cookie)).status,200);
    assert.equal((await call(`files/${photoIds[1]}?inline=1`)).status,401);
    assert.equal((await call(`items/${diary.item.id}`,'DELETE',undefined,cookie)).status,200);
    const draftInput={...diaryInput,title:'D1 观后感草稿',status:'draft',writingType:'review',article:{summary:'摘要',kicker:'',series:'',spoiler:false,coverPosition:'center',facts:[],quote:''}};
    const draftResponse=await call('items','POST',draftInput,cookie);assert.equal(draftResponse.status,201);
    const draft=(await draftResponse.json()) as {item:{id:string;status:string}};assert.equal(draft.item.status,'draft');
    assert.equal((await call(`items/${draft.item.id}`)).status,404);
    const draftList=await (await call('items')).json() as {items:{id:string}[]};assert.ok(!draftList.items.some(item=>item.id===draft.item.id));
    for(const photoId of photoIds)assert.equal((await call(`files/${photoId}?inline=1`)).status,401);
    assert.deepEqual(((await (await call(`likes?ids=${draft.item.id}`)).json()) as {likes:unknown}).likes,{});
    assert.equal((await call(`items/${draft.item.id}`,'PATCH',{status:'published',pinned:true},cookie)).status,200);
    assert.equal((await call(`items/${draft.item.id}`)).status,200);
    assert.equal((await call('visitor','POST',{name:'D1访客'},visitorCookie)).status,200);
    const commentResponse=await call(`comments/${draft.item.id}`,'POST',{body:'这篇观后感很喜欢。'},visitorCookie);assert.equal(commentResponse.status,201);
    const comment=(await commentResponse.json() as {comment:{id:string;name:string;owner:boolean}}).comment;assert.equal(comment.name,'D1访客');assert.equal(comment.owner,false);
    assert.equal((await call('comments')).status,401);
    const managed=await (await call('comments?status=unread','GET',undefined,cookie)).json() as {unread:number;comments:{id:string;item:{type:string}}[]};assert.equal(managed.unread,1);assert.equal(managed.comments[0].item.type,'review');
    assert.equal((await call(`comments/${draft.item.id}/${comment.id}`,'PATCH',{read:true},visitorCookie)).status,401);
    assert.equal((await call(`comments/${draft.item.id}/${comment.id}`,'PATCH',{read:true},cookie)).status,200);
    assert.equal((await (await call('comments?status=unread','GET',undefined,cookie)).json() as {unread:number}).unread,0);
    const replyPath=`comments/${draft.item.id}/${comment.id}/reply`;
    assert.equal((await call(replyPath,'PUT',{body:'伪造站主回复'},visitorCookie)).status,401);
    assert.equal((await call(replyPath,'DELETE',undefined,visitorCookie)).status,401);
    assert.equal((await call(replyPath,'PUT',{body:'感谢你的喜欢。'},cookie)).status,200);
    const replied=await (await call(`comments/${draft.item.id}`)).json() as {comments:{reply:{body:string;createdAt:string}}[]};assert.equal(replied.comments[0].reply.body,'感谢你的喜欢。');
    assert.equal((await call(replyPath,'PUT',{body:'修改后的回复'},cookie)).status,200);
    const editedReply=await (await call(`comments/${draft.item.id}`)).json() as {comments:{reply:{body:string;createdAt:string}}[]};assert.equal(editedReply.comments[0].reply.body,'修改后的回复');assert.equal(editedReply.comments[0].reply.createdAt,replied.comments[0].reply.createdAt);
    assert.equal((await call(replyPath,'DELETE',undefined,cookie)).status,200);
    assert.equal((await call(replyPath,'PUT',{body:'随原留言一起清理'},cookie)).status,200);
    const located=await (await call(`comments/${draft.item.id}?focus=${comment.id}`)).json() as {page:number;comments:{id:string}[]};assert.equal(located.page,1);assert.equal(located.comments[0].id,comment.id);
    assert.equal((await call(`comments/${draft.item.id}/${comment.id}`,'DELETE')).status,403);
    for(const photoId of photoIds)assert.equal((await call(`files/${photoId}?inline=1`)).status,200);
    assert.equal((await call(`items/${draft.item.id}`,'PATCH',{status:'draft'},cookie)).status,200);
    assert.equal((await call(`items/${draft.item.id}`)).status,404);
    assert.equal((await call(`comments/${draft.item.id}`)).status,404);
    const hiddenComments=await (await call('comments','GET',undefined,cookie)).json() as {comments:{id:string;item:{status:string}}[]};assert.equal(hiddenComments.comments[0].id,comment.id);assert.equal(hiddenComments.comments[0].item.status,'draft');
    assert.equal((await call(`comments/${draft.item.id}/${comment.id}`,'DELETE',undefined,cookie)).status,200);
    assert.equal(await db.prepare('SELECT comment_id FROM comment_reads WHERE comment_id=?').bind(comment.id).first(),null);
    assert.equal(await db.prepare('SELECT comment_id FROM comment_replies WHERE comment_id=?').bind(comment.id).first(),null);
    assert.equal((await call(`items/${draft.item.id}`,'DELETE',undefined,cookie)).status,200);
    for(const photoId of photoIds)assert.equal((await call(`files/${photoId}`,'DELETE',undefined,cookie)).status,409);
    for(const itemId of [createId,diary.item.id,draft.item.id])assert.equal((await call(`trash/${itemId}`,'DELETE',undefined,cookie)).status,200);
    for(const photoId of photoIds)assert.equal((await call(`files/${photoId}`,'DELETE',undefined,cookie)).status,200);
    const clipBytes=new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109,109,112,52,50,0,0,0,8,109,100,97,116]);
    const clipForm=new FormData();clipForm.set('file',new File([clipBytes],'clip.mp4'));
    const clipUpload=await call('files?video=1','POST',clipForm,cookie);assert.equal(clipUpload.status,201);
    const clipAsset=(await clipUpload.json() as {file:{id:string}}).file;
    const clipInput={kind:'video',title:'R2 视频作品',body:'分段播放',category:'日常',tags:[],visibility:'public',assetId:null,url:'',video:{assetId:clipAsset.id,duration:5}};
    const clipResponse=await call('items','POST',clipInput,cookie);assert.equal(clipResponse.status,201);
    const clip=(await clipResponse.json() as {item:{id:string}}).item;
    const clipRange=await mf.dispatchFetch(`https://little-world.test/api/files/${clipAsset.id}?inline=1`,{headers:{range:'bytes=4-11'}});
    assert.equal(clipRange.status,206);assert.equal(clipRange.headers.get('content-range'),`bytes 4-11/${clipBytes.length}`);assert.deepEqual(new Uint8Array(await clipRange.arrayBuffer()),clipBytes.slice(4,12));
    assert.equal((await call(`items/${clip.id}`,'PUT',{...clipInput,visibility:'private'},cookie)).status,200);
    assert.equal((await call(`files/${clipAsset.id}?inline=1`)).status,401);
    assert.equal((await call(`items/${clip.id}`,'DELETE',undefined,cookie)).status,200);
    assert.equal((await call(`files/${clipAsset.id}`,'DELETE',undefined,cookie)).status,409);
    assert.equal((await call(`trash/${clip.id}`,'DELETE',undefined,cookie)).status,200);
    assert.equal((await call(`files/${clipAsset.id}`,'DELETE',undefined,cookie)).status,200);
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
