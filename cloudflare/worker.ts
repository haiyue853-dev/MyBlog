import {createHash,timingSafeEqual} from 'node:crypto';
import type {D1Database,R2Bucket,Fetcher} from '@cloudflare/workers-types';
import {CloudStore} from './store';
import {withRuntime} from '../src/lib/runtime';
import {ApiError,handleErrors,isOwner,json,renewSession} from '../src/lib/http';
import {authApi} from '../src/lib/api/auth';
import {itemsApi} from '../src/lib/api/items';
import {likesApi} from '../src/lib/api/likes';
import {statisticsApi} from '../src/lib/api/statistics';
import {profileApi} from '../src/lib/api/profile';
import {filesApi} from '../src/lib/api/files';
import {irisApi} from '../src/lib/api/iris';
import {CLOUD_PASSWORD_SCHEME} from '../src/lib/cloud-password';
import {SCRYPT_LEGACY_N} from '../src/lib/types';

export interface CloudEnv {DB:D1Database;FILES:R2Bucket;ASSETS:Fetcher;IRIS_BASE_URL?:string;IRIS_API_TOKEN?:string;}
export async function verifyCloudPassword(password:string,encoded:string):Promise<boolean>{
  const parts=encoded.split(':');
  if(parts[0]!==CLOUD_PASSWORD_SCHEME)return false;
  // 兼容旧格式（SCHEME:salt:hash）与新格式（SCHEME:N:salt:hash）：salt/hash 都取末尾两段。
  const salt=parts[parts.length-2];const hash=parts[parts.length-1];
  if(!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(hash)||!/^[a-f0-9]{128}$/.test(password))return false;
  // Store H(scrypt(password,salt)), never the reusable login key itself.
  const digest=createHash('sha256').update(Buffer.from(password,'hex')).digest();
  return timingSafeEqual(digest,Buffer.from(hash,'hex'));
}
async function dispatch(request:Request,path:string[],store:CloudStore,env:CloudEnv){
  if(path[0]==='auth'&&path.length===1&&request.method==='GET'){
    const account=await store.getOwner();const parts=account?.password.split(':');
    if(account&&parts?.[0]!==CLOUD_PASSWORD_SCHEME)throw new ApiError(503,'站主账号尚未完成 Cloudflare 迁移。');
    // 告诉浏览器用多大成本做 scrypt：旧账号回落到历史档（2^14），新账号用当前档。
    const cost=parts&&parts.length>=4?Number(parts[1]):SCRYPT_LEGACY_N;
    const salt=parts?parts[parts.length-2]:'';
    return json({owner:await isOwner(request),configured:!!account,
      ...(account?{challenge:{scheme:CLOUD_PASSWORD_SCHEME,salt,cost}}:{})});
  }
  if(path[0]==='bootstrap'&&path.length===1&&request.method==='GET'){
    const owner=await isOwner(request);
    return json({owner,configured:!!await store.getOwner(),profile:await store.getProfile(),items:await store.listItems(owner)});
  }
  if(path[0]==='auth'&&path.length<=2)return authApi(request,path);
  if(path[0]==='items'&&path.length<=2)return itemsApi(request,path);
  if(path[0]==='likes'&&path.length<=2)return likesApi(request,path);
  if(path[0]==='stats'&&path.length===1)return statisticsApi(request);
  if(path[0]==='profile'&&path.length===1)return profileApi(request);
  if(path[0]==='files'&&path.length<=2)return filesApi(request,path);
  if(path[0]==='iris'){
    if(!env.IRIS_BASE_URL)throw new ApiError(503,'Iris 尚未接入，资料柜仍可正常使用。');
    return irisApi(request,path);
  }
  throw new ApiError(404,'没有找到这项内容。');
}
export default {
  async fetch(request:Request,env:CloudEnv):Promise<Response>{
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request as never) as unknown as Promise<Response>;
    const store=new CloudStore(env.DB,env.FILES);
    // Trust only Cloudflare's own client IP, and derive origin from the actual Worker URL.
    const result=await withRuntime(store,{appUrl:url.origin,disableWebSetup:true,trustProxy:true,
      clientIpHeader:'cf-connecting-ip',irisBaseUrl:env.IRIS_BASE_URL,irisApiToken:env.IRIS_API_TOKEN,
      verifyPassword:verifyCloudPassword},()=>handleErrors(async()=>{
      const path=url.pathname.slice(5).split('/').map(part=>decodeURIComponent(part));
      return renewSession(request,await dispatch(request,path,store,env));
    }));
    const headers=new Headers(result.headers);headers.set('X-Content-Type-Options','nosniff');
    headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');
    return new Response(result.body,{status:result.status,headers});
  }
};
