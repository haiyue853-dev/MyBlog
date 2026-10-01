import {getStore} from '../store';
import {verifyPassword} from '../security';
import {ApiError,isOwner,json,newToken,readJson,requireOrigin,sessionCookie,tokenFrom} from '../http';

export async function authApi(request:Request,path:string[]){const store=getStore();
  if(request.method==='GET'&&path.length===1)return json({owner:isOwner(request),configured:!!store.getOwner()});
  if(request.method!=='POST')throw new ApiError(405,'不支持这个操作。');requireOrigin(request);
  if(path[1]==='logout'){store.deleteSession(tokenFrom(request));return json({ok:true},200,{'Set-Cookie':sessionCookie(request,'',0)});}
  if(path[1]!=='login')throw new ApiError(404,'没有找到这项内容。');
  if(store.loginBlocked())throw new ApiError(429,'尝试次数过多，请 15 分钟后再试。');
  const data=await readJson(request);const password=typeof data.password==='string'?data.password:'';
  if(password.length>256)throw new ApiError(400,'密码长度不正确。');const owner=store.getOwner();
  if(!owner)throw new ApiError(503,'站主账号尚未初始化。');
  if(!verifyPassword(password,owner.password)){store.recordLoginFailure();throw new ApiError(401,'密码不正确，请再试一次。');}
  store.clearLoginFailures();const token=newToken();const maxAge=7*24*60*60;store.createSession(token,Date.now()+maxAge*1000);
  return json({owner:true},200,{'Set-Cookie':sessionCookie(request,token,maxAge)});
}
