import {ApiError,handleErrors} from '@/lib/http';
import {authApi} from '@/lib/api/auth';
import {itemsApi} from '@/lib/api/items';
import {filesApi} from '@/lib/api/files';
import {profileApi} from '@/lib/api/profile';
import {irisApi} from '@/lib/api/iris';

export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handler(request:Request,context:{params:Promise<{path:string[]}>}){return handleErrors(async()=>{const {path}=await context.params;
  if(path[0]==='auth'&&path.length<=2)return authApi(request,path);
  if(path[0]==='items'&&path.length<=2)return itemsApi(request,path);
  if(path[0]==='files'&&path.length<=2)return filesApi(request,path);
  if(path[0]==='profile'&&path.length===1)return profileApi(request);
  if(path[0]==='iris')return irisApi(request,path);
  throw new ApiError(404,'没有找到这项内容。');
});}
export {handler as GET,handler as POST,handler as PUT,handler as DELETE};
