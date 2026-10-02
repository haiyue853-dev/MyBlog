import {ApiError,isOwner,json,requireOrigin,validId} from '../http';
import {getRuntimeStore} from '../runtime';
import {loginClient} from '../security';
import {visitorHash,visitorIdentity,visitorToken} from '../visitor';
export function beijingDay(now=Date.now()){return new Date(now+8*3600000).toISOString().slice(0,10);}
export async function likesApi(request:Request,path:string[]){
  const store=getRuntimeStore();const day=beijingDay();
  const nextDayAt=new Date(day+'T00:00:00+08:00').getTime()+86400000;
  const owner=await isOwner(request);const token=visitorToken(request);
  if(request.method==='GET'&&path.length===1){
    const raw=new URL(request.url).searchParams.get('ids')||'';
    const ids=[...new Set(raw.split(',').filter(Boolean))];
    if(ids.length>80)throw new ApiError(400,'每次最多查询 80 张卡片。');
    ids.forEach(validId);
    const identity=visitorIdentity(request);
    return json({likes:await store.getLikes(ids,identity.hash,day,owner),day,nextDayAt},200,identity.headers);
  }
  if(request.method!=='POST'||path.length!==2)throw new ApiError(405,'不支持这个操作。');
  requireOrigin(request);const id=validId(path[1]);
  if(!token)throw new ApiError(400,'请允许本站 Cookie，并刷新页面后再点赞。');
  if(!await store.getItem(id,owner))throw new ApiError(404,'没有找到这项内容。');
  if(!await store.takeLikeAttempt(loginClient(request)))throw new ApiError(429,'点得太快了，请稍后再试。');
  const visitor=visitorHash(token);
  const added=await store.addDailyLike(id,visitor,day,owner);
  const like=(await store.getLikes([id],visitor,day,owner))[id];
  if(!like)throw new ApiError(404,'没有找到这项内容。');
  return json({like,added,day,nextDayAt});
}
