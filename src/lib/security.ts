import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';

export function hashPassword(password:string):string {const salt=randomBytes(16).toString('hex');return `scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function verifyPassword(password:string,encoded:string):boolean {try{const [type,salt,hash]=encoded.split(':');if(type!=='scrypt'||!salt||!hash||hash.length!==128)return false;return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hash,'hex'));}catch{return false;}}
export function isSameOrigin(origin:string|null,expected:string|null):boolean {const from=normalizeOrigin(origin);const to=normalizeOrigin(expected);return !!from&&!!to&&from===to;}
function normalizeOrigin(value:string|null|undefined):string|null{try{return value?new URL(value).origin:null;}catch{return null;}}
function normalizeProtocol(value:string):string{try{return new URL(value).protocol;}catch{return '';}}
function firstHeader(request:Request,name:string):string{return (request.headers.get(name)||'').split(',')[0].trim();}
// 「这个站点自己的来源」，用来跟请求里的 Origin 头比对。
//
// 优先 APP_URL（部署时配的权威地址）；没配就回落到客户端**实际请求的 Host**。
//
// 千万别回落到 `request.url` —— Next 的 standalone server 会把 request.url 的 host
// 固定写成 `localhost`。于是从 http://127.0.0.1:3000 进来时，Origin 是
// http://127.0.0.1:3000，而 request.url 是 http://localhost:3000/…，两个 origin 天然
// 不相等 —— **所有写操作在那个地址下全部 403**，而那正好是 Next 启动横幅里打印出来的
// Local 地址。（实测：请求的 Host 头怎么改都不影响判定，只有把 Origin 换成 localhost
// 才能过。这个坑一直没被发现，是因为测试脚本都显式设了 APP_URL，把这条回退路径绕开了。）
//
// 换成 Host 之后浏览器侧是自洽的：同源请求的 Origin 与 Host 必然指向同一个 host:port；
// 跨站攻击者又无法伪造 Host，所以安全性不比原来弱。
export function requestOrigin(request:Request):string|null{
  const configured=(process.env.APP_URL||'').trim();
  if(configured)return normalizeOrigin(configured);
  const host=firstHeader(request,'x-forwarded-host')||firstHeader(request,'host');
  if(!host)return null;
  return `${requestProtocol(request)}://${host}`;
}
// 走反代时真实的协议在 x-forwarded-proto 里；直连时退回 request.url。
export function requestProtocol(request:Request):string{
  const forwarded=firstHeader(request,'x-forwarded-proto');
  if(forwarded==='http'||forwarded==='https')return forwarded;
  return normalizeProtocol(request.url)==='https:'?'https':'http';
}
// 会话 cookie 要不要带 Secure。APP_URL 配了 https 就算；否则看实际这次请求是不是 https。
export function isSecureRequest(request:Request):boolean{
  const configured=(process.env.APP_URL||'').trim();
  if(configured&&normalizeProtocol(configured)==='https:')return true;
  return requestProtocol(request)==='https';
}
export function safeExternalUrl(value:string):string|null {try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export function canReadAsset(owner:boolean,publiclyReferenced:boolean):boolean{return owner||publiclyReferenced;}
export function imageMime(bytes:Buffer):string|null{
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=6&&['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()))return 'image/gif';
  if(bytes.length>=12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';
  return null;
}
