import {getStore} from '../store';
import {hashPassword,verifyPassword} from '../security';
import {ApiError,isOwner,json,newToken,readJson,requireOrigin,sessionCookie,tokenFrom} from '../http';

export async function authApi(request:Request,path:string[]){const store=getStore();
  if(request.method==='GET'&&path.length===1)return json({owner:isOwner(request),configured:!!store.getOwner()});
  if(request.method!=='POST')throw new ApiError(405,'不支持这个操作。');requireOrigin(request);
  if(path[1]==='logout'){store.deleteSession(tokenFrom(request));return json({ok:true},200,{'Set-Cookie':sessionCookie(request,'',0)});}
  // 首次建站：只在还没有站主的时候放行，建完直接发会话，省得再输一遍密码。
  // 这是一次性的引导入口 —— 站主一旦存在就永久 409，所以长期没有「谁先访问谁当站主」的风险。
  // 但**这个窗口期是真的**：对外发布之前一定要先在本机把站主建好，否则第一个访问到的人会成为站主。
  if(path[1]==='setup'){
    if(store.getOwner())throw new ApiError(409,'站主账号已经存在，无法重复初始化。');
    const data=await readJson(request);
    const password=typeof data.password==='string'?data.password:'';
    if(password.length<12)throw new ApiError(400,'密码至少需要 12 位。');
    if(password.length>256)throw new ApiError(400,'密码长度不正确。');
    const name=(typeof data.name==='string'?data.name.trim():'').slice(0,50)||'小屋站主';
    store.setOwner(name,hashPassword(password));
    console.log(`[setup] 站主账号已创建（${name}）。要改昵称或重设密码，在终端跑 npm run setup-owner。`);
    const token=newToken();const maxAge=7*24*60*60;store.createSession(token,Date.now()+maxAge*1000);
    return json({owner:true},201,{'Set-Cookie':sessionCookie(request,token,maxAge)});
  }
  if(path[1]!=='login')throw new ApiError(404,'没有找到这项内容。');
  if(store.loginBlocked())throw new ApiError(429,'尝试次数过多，请 15 分钟后再试。');
  const data=await readJson(request);const password=typeof data.password==='string'?data.password:'';
  if(password.length>256)throw new ApiError(400,'密码长度不正确。');const owner=store.getOwner();
  if(!owner)throw new ApiError(503,'站主账号尚未初始化。');
  if(!verifyPassword(password,owner.password)){store.recordLoginFailure();throw new ApiError(401,'密码不正确，请再试一次。');}
  store.clearLoginFailures();const token=newToken();const maxAge=7*24*60*60;store.createSession(token,Date.now()+maxAge*1000);
  return json({owner:true},200,{'Set-Cookie':sessionCookie(request,token,maxAge)});
}
