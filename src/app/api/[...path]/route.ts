import {ApiError,handleErrors,renewSession} from '@/lib/http';
import {authApi} from '@/lib/api/auth';
import {trashApi} from '@/lib/api/trash';
import {itemsApi} from '@/lib/api/items';
import {likesApi} from '@/lib/api/likes';
import {statisticsApi} from '@/lib/api/statistics';
import {visitorApi} from '@/lib/api/visitor';
import {commentsApi} from '@/lib/api/comments';
import {filesApi} from '@/lib/api/files';
import {profileApi} from '@/lib/api/profile';
import {travelApi} from '@/lib/api/travel';
import {irisApi} from '@/lib/api/iris';
import {backupsApi} from '@/lib/api/backups';
import {withBackupAccess} from '@/lib/backup-access';
import {getStore} from '@/lib/store';
import {withRuntime,nodeConfig} from '@/lib/runtime';

export const runtime='nodejs';
export const dynamic='force-dynamic';
async function dispatch(request:Request,path:string[]){
  if(path[0]==='auth'&&path.length<=2)return authApi(request,path);
  if(path[0]==='trash'&&path.length<=2)return trashApi(request,path);
  if(path[0]==='items'&&path.length<=2)return itemsApi(request,path);
  if(path[0]==='likes'&&path.length<=2)return likesApi(request,path);
  if(path[0]==='stats'&&path.length===1)return statisticsApi(request);
  if(path[0]==='visitor'&&path.length===1)return visitorApi(request);
  if(path[0]==='comments'&&path.length>=1&&path.length<=4)return commentsApi(request,path);
  if(path[0]==='files'&&path.length<=2)return filesApi(request,path);
  if(path[0]==='profile'&&path.length===1)return profileApi(request);
  if(path[0]==='travel'&&path.length===1)return travelApi(request);
  if(path[0]==='backups'&&path.length<=2)return backupsApi(request,path,getStore());
  if(path[0]==='iris')return irisApi(request,path);
  throw new ApiError(404,'没有找到这项内容。');
}
// 会话续期统一在出口做：站主只要在用站点，这次登录就一直往后推，不会被中途踢出去。
// 必须排在业务处理之后 —— 登出已经删掉会话，这里查不到就不会把它复活。
async function handler(request:Request,context:{params:Promise<{path:string[]}>}){
  const store=getStore();
  const {path}=await context.params;
  const exclusive=request.method==='POST'&&path[0]==='backups'&&path.length===1;
  return withRuntime(store,nodeConfig(),()=>withBackupAccess(store,exclusive,()=>handleErrors(async()=>renewSession(request,await dispatch(request,path)))));
}
export {handler as GET,handler as HEAD,handler as POST,handler as PUT,handler as PATCH,handler as DELETE};
