import {createHash} from 'node:crypto';
import {getRuntimeStore as getStore,runtimeConfig} from '../runtime';
import {hashPassword,verifyPassword,loginClient,scryptCostOf} from '../security';
import {MIN_PASSWORD_LENGTH,SCRYPT_N} from '../types';
import {CLOUD_PASSWORD_SCHEME} from '../cloud-password';
import {ApiError,isOwner,json,newToken,readJson,requireOrigin,requireOwner,sessionCookie,SESSION_MAX_AGE,tokenFrom} from '../http';

export async function authApi(request:Request,path:string[]){const store=getStore();
  if(request.method==='GET'&&path.length===1)return json({owner:await isOwner(request),configured:!!(await store.getOwner())});
  if(request.method!=='POST')throw new ApiError(405,'不支持这个操作。');requireOrigin(request);
  if(path[1]==='logout'){(await store.deleteSession(tokenFrom(request)));return json({ok:true},200,{'Set-Cookie':sessionCookie(request,'',0)});}
  // 首次建站：只在还没有站主的时候放行，建完直接发会话，省得再输一遍密码。
  // 这是一次性的引导入口 —— 站主一旦存在就永久 409，所以长期没有「谁先访问谁当站主」的风险。
  // 但**这个窗口期是真的**：对外发布之前一定要先在本机把站主建好，否则第一个访问到的人会成为站主。
  if(path[1]==='setup'){
    if((await store.getOwner()))throw new ApiError(409,'站主账号已经存在，无法重复初始化。');
    if(runtimeConfig().disableWebSetup)throw new ApiError(403,'公开部署不允许网页初始化，请先在本地设置站主账号。');
    const data=await readJson(request,8192);
    const password=typeof data.password==='string'?data.password:'';
    if(password.length<MIN_PASSWORD_LENGTH)throw new ApiError(400,`密码至少需要 ${MIN_PASSWORD_LENGTH} 位。`);
    if(password.length>256)throw new ApiError(400,'密码长度不正确。');
    const name=(typeof data.name==='string'?data.name.trim():'').slice(0,50)||'小屋站主';
    (await store.setOwner(name,hashPassword(password)));
    console.log(`[setup] 站主账号已创建（${name}）。要改昵称或重设密码，在终端跑 npm run setup-owner。`);
    const token=newToken();await store.createSession(token,Date.now()+SESSION_MAX_AGE*1000);
    return json({owner:true},201,{'Set-Cookie':sessionCookie(request,token,SESSION_MAX_AGE)});
  }
  if(path[1]==='rehash'){
    // 仅云端需要：云端 worker 拿不到明文，由浏览器登录后用新成本重算并回传，这里只更新存储。
    // 本地模式不需要（本地登录时已就地升级），直接成功，避免把本地密码格式改坏。
    if(!runtimeConfig().verifyPassword)return json({ok:true},200);
    await requireOwner(request);requireOrigin(request);
    const data=await readJson(request,8192);const password=typeof data.password==='string'?data.password:'';
    if(!/^[a-f0-9]{128}$/.test(password))throw new ApiError(400,'升级参数无效。');
    const owner=await store.getOwner();if(!owner)throw new ApiError(503,'站主账号尚未初始化。');
    const m=/^scrypt-client-sha256-v1:\d+:([a-f0-9]{32}):[a-f0-9]{64}$/.exec(owner.password);
    if(!m)throw new ApiError(400,'账号状态异常。');
    const upgraded=`${CLOUD_PASSWORD_SCHEME}:${SCRYPT_N}:${m[1]}:${createHash('sha256').update(Buffer.from(password,'hex')).digest('hex')}`;
    await store.updateOwnerPassword(upgraded);
    return json({ok:true},200);
  }
  if(path[1]!=='login')throw new ApiError(404,'没有找到这项内容。');
  const client=loginClient(request);
  if((await store.loginBlocked(client)))throw new ApiError(429,'尝试次数过多，请 15 分钟后再试。');
  if(!(await store.takeLoginAttempt(client)))throw new ApiError(429,'请求太频繁，请一分钟后再试。');
  const data=await readJson(request,8192);const password=typeof data.password==='string'?data.password:'';
  // 读取正文期间其他并发请求可能已经用尽失败次数；校验密码前重新检查。
  if((await store.loginBlocked(client)))throw new ApiError(429,'尝试次数过多，请 15 分钟后再试。');
  if(password.length>256)throw new ApiError(400,'密码长度不正确。');const owner=(await store.getOwner());
  if(!owner)throw new ApiError(503,'站主账号尚未初始化。');
  if(!await store.reserveLoginVerification(client))throw new ApiError(429,'尝试次数过多，请 15 分钟后再试。');
  const verify=runtimeConfig().verifyPassword??verifyPassword;
  if(!await verify(password,owner.password))throw new ApiError(401,'密码不正确，请再试一次。');
  // 本地模式（无云端校验函数）下，明文在此可用：若已存哈希成本低于当前档，就地升级，旧账号下次登录后静默变强。
  if(!runtimeConfig().verifyPassword&&scryptCostOf(owner.password)<SCRYPT_N)store.updateOwnerPassword(hashPassword(password));
  await store.clearLoginFailures(client);const token=newToken();await store.createSession(token,Date.now()+SESSION_MAX_AGE*1000);
  return json({owner:true},200,{'Set-Cookie':sessionCookie(request,token,SESSION_MAX_AGE)});
}
