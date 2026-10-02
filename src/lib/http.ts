import {randomBytes} from 'node:crypto';
import {getRuntimeStore as getStore} from './runtime';
import {isSameOrigin,isSecureRequest,requestOrigin} from './security';

export class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
export function json(data:unknown,status=200,extra:Record<string,string>={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store',...extra}});}
export function tokenFrom(request:Request){return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('world-session='))?.slice('world-session='.length)||'';}
export async function isOwner(request:Request){const token=tokenFrom(request);return token.length===64&&await getStore().hasSession(token);}
export async function requireOwner(request:Request){if(!await isOwner(request))throw new ApiError(401,'请先登录私人空间。');}
export function requireOrigin(request:Request){if(!isSameOrigin(request.headers.get('origin'),requestOrigin(request)))throw new ApiError(403,'请求来源不匹配，请从本站重新操作。');}
export function sessionCookie(request:Request,token:string,maxAge:number){const secure=isSecureRequest(request);return `world-session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;}
// 站主登录一次要保持很久 —— 这是自己的私人小屋，不是网银，不该每进一次就重新输密码。
export const SESSION_MAX_AGE=180*24*60*60;
// 续期时机：只在剩余寿命掉到一半以下才动手，避免每个请求都写一次库、都重发一次 Set-Cookie。
const SESSION_RENEW_BELOW=SESSION_MAX_AGE/2;
// 站主在用站点时顺手把这次登录往后推。放在路由出口统一做，各接口不用各自操心。
// 两个坑：
//   1. `Response.json()` 出来的 headers 守卫是 "response"，而 `Set-Cookie` 属于
//      forbidden response-header name —— 直接 `response.headers.append('Set-Cookie',…)`
//      会被**静默丢掉**。必须换一个守卫为 "none" 的 Headers 重新构造 Response。
//   2. 必须排在业务处理**之后**：登出已经把会话删了，这里自然就查不到、不会把它复活。
export async function renewSession(request:Request,response:Response):Promise<Response>{
  const token=tokenFrom(request);
  if(token.length!==64)return response;
  const store=getStore();const expires=await store.sessionExpires(token);
  if(expires===null||expires-Date.now()>SESSION_RENEW_BELOW*1000)return response;
  await store.extendSession(token,Date.now()+SESSION_MAX_AGE*1000);
  const headers=new Headers(response.headers);
  headers.append('Set-Cookie',sessionCookie(request,token,SESSION_MAX_AGE));
  const body=response.body?await response.arrayBuffer():null;
  return new Response(body,{status:response.status,statusText:response.statusText,headers});
}
export function newToken(){return randomBytes(32).toString('hex');}
export async function readBody(request:Request,maxBytes=1024*1024){const length=Number(request.headers.get('content-length'));if(length>maxBytes)throw new ApiError(413,'内容太大，请缩小后再上传。');if(!request.body)return new Uint8Array();const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ApiError(413,'内容太大，请缩小后再上传。');}chunks.push(value);}}finally{reader.releaseLock();}return Buffer.concat(chunks,size);}
export async function readJson(request:Request,maxBytes=1024*1024):Promise<Record<string,unknown>>{try{const value=JSON.parse(new TextDecoder().decode(await readBody(request,maxBytes)));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(400,'内容格式不正确。');}}
export function text(value:unknown,label:string,max:number,required=false):string{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new ApiError(400,`${label}不能为空或超过 ${max} 字。`);return value.trim();}
export function validId(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new ApiError(404,'没有找到这项内容。');return id;}
export async function handleErrors(action:()=>Promise<Response>){try{return await action();}catch(error){if(error instanceof ApiError)return json({error:error.message},error.status);console.error('[api]',error);return json({error:'操作暂时失败，请稍后重试。'},500);}}
