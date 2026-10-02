import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import {runtimeConfig} from './runtime';
import {SCRYPT_N,SCRYPT_R,SCRYPT_P,SCRYPT_KEYLEN,SCRYPT_MAXMEM,SCRYPT_LEGACY_N} from './types';

// 仅部署用 Caddy 能写这个头；web 端口必须只在容器内部开放。
export function loginClient(request:Request):string{
  const config=runtimeConfig();if(!config.trustProxy)return 'local';
  const address=request.headers.get(config.clientIpHeader||'x-little-world-client-ip')||'';
  return isIP(address)?address:'local';
}

// 哈希格式：新的是 `scrypt$N$r$p$salt$hash`（带成本参数，向后兼容升级用）；
// 旧的是 `scrypt:salt:hash`（没有成本参数，按 SCRYPT_LEGACY_N 解读）。两者都能验证。
export function hashPassword(password:string):string {
  const salt=randomBytes(16).toString('hex');
  const hash=scryptSync(password,salt,SCRYPT_KEYLEN,{N:SCRYPT_N,r:SCRYPT_R,p:SCRYPT_P,maxmem:SCRYPT_MAXMEM}).toString('hex');
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}
// 解析两种格式，取出成本参数与盐。返回 null 表示格式不认识。
export function parseScryptEncoded(encoded:string):{N:number;r:number;p:number;salt:string;hash:string}|null{
  if(typeof encoded!=='string')return null;
  if(encoded.startsWith('scrypt$')){
    const parts=encoded.split('$');
    // scrypt$N$r$p$salt$hash
    if(parts.length!==6||parts[0]!=='scrypt')return null;
    const N=Number(parts[1]),r=Number(parts[2]),p=Number(parts[3]),salt=parts[4],hash=parts[5];
    if(!Number.isInteger(N)||!Number.isInteger(r)||!Number.isInteger(p)||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hash))return null;
    return {N,r,p,salt,hash};
  }
  if(encoded.startsWith('scrypt:')){
    const parts=encoded.split(':'); // scrypt:salt:hash
    if(parts.length!==3||parts[0]!=='scrypt')return null;
    const [,salt,hash]=parts;
    if(!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hash))return null;
    return {N:SCRYPT_LEGACY_N,r:SCRYPT_R,p:SCRYPT_P,salt,hash};
  }
  return null;
}
// 取出某条已存哈希使用的 N（旧格式回落到 SCRYPT_LEGACY_N）。用于告诉浏览器用多大成本校验。
export function scryptCostOf(encoded:string):number{return parseScryptEncoded(encoded)?.N??SCRYPT_LEGACY_N;}
export function verifyPassword(password:string,encoded:string):boolean {
  let parsed:ReturnType<typeof parseScryptEncoded>;
  try{parsed=parseScryptEncoded(encoded);}catch{return false;}
  if(!parsed)return false;
  try{
    const candidate=scryptSync(password,parsed.salt,SCRYPT_KEYLEN,{N:parsed.N,r:parsed.r,p:parsed.p,maxmem:SCRYPT_MAXMEM});
    return timingSafeEqual(candidate,Buffer.from(parsed.hash,'hex'));
  }catch{return false;}
}
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
  const configured=(runtimeConfig().appUrl||'').trim();
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
  const configured=(runtimeConfig().appUrl||'').trim();
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
