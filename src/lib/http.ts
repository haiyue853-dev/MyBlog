import {randomBytes} from 'node:crypto';
import {getStore} from './store';
import {isSameOrigin} from './security';

export class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
export function json(data:unknown,status=200,extra:Record<string,string>={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store',...extra}});}
export function tokenFrom(request:Request){return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('world-session='))?.slice('world-session='.length)||'';}
export function isOwner(request:Request){const token=tokenFrom(request);return token.length===64&&getStore().hasSession(token);}
export function requireOwner(request:Request){if(!isOwner(request))throw new ApiError(401,'请先登录私人空间。');}
export function requireOrigin(request:Request){if(!isSameOrigin(request.headers.get('origin'),request.url,process.env.APP_URL))throw new ApiError(403,'请求来源不匹配，请从本站重新操作。');}
export function sessionCookie(request:Request,token:string,maxAge:number){const secure=new URL(process.env.APP_URL||request.url).protocol==='https:';return `world-session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;}
export function newToken(){return randomBytes(32).toString('hex');}
export async function readBody(request:Request,maxBytes=1024*1024){const length=Number(request.headers.get('content-length'));if(length>maxBytes)throw new ApiError(413,'内容太大，请缩小后再上传。');if(!request.body)return new Uint8Array();const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ApiError(413,'内容太大，请缩小后再上传。');}chunks.push(value);}}finally{reader.releaseLock();}return Buffer.concat(chunks,size);}
export async function readJson(request:Request):Promise<Record<string,unknown>>{try{const value=JSON.parse(new TextDecoder().decode(await readBody(request)));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(400,'内容格式不正确。');}}
export function text(value:unknown,label:string,max:number,required=false):string{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new ApiError(400,`${label}不能为空或超过 ${max} 字。`);return value.trim();}
export function validId(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new ApiError(404,'没有找到这项内容。');return id;}
export async function handleErrors(action:()=>Promise<Response>){try{return await action();}catch(error){if(error instanceof ApiError)return json({error:error.message},error.status);console.error('[api]',error);return json({error:'操作暂时失败，请稍后重试。'},500);}}
