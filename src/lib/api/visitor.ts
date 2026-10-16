import {getRuntimeStore} from '../runtime';
import {ApiError,json,readJson,requireOrigin,text} from '../http';
import {loginClient} from '../security';
import {visitorHash,visitorIdentity,visitorToken} from '../visitor';
export async function visitorApi(request:Request){
  const store=getRuntimeStore();const token=visitorToken(request);
  if(request.method==='GET')return json({visitor:token?await store.getVisitor(visitorHash(token)):null});
  if(request.method!=='POST')throw new ApiError(405,'不支持这个操作。');
  requireOrigin(request);const data=await readJson(request,4096);
  if(Object.keys(data).some(key=>key!=='name'))throw new ApiError(400,'只需填写一个昵称。');
  const name=text(data.name,'昵称',24,true);
  if(/[\p{Cc}\p{Cf}]/u.test(name))throw new ApiError(400,'昵称请使用可见的文字。');
  if(!await store.takeCommentAttempt(loginClient(request),'name'))throw new ApiError(429,'修改昵称太频繁了，请稍后再试。');
  const identity=visitorIdentity(request);const visitor=await store.saveVisitor(identity.hash,name);
  return json({visitor},200,identity.headers);
}
