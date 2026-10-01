import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';

export function hashPassword(password:string):string {const salt=randomBytes(16).toString('hex');return `scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function verifyPassword(password:string,encoded:string):boolean {try{const [type,salt,hash]=encoded.split(':');if(type!=='scrypt'||!salt||!hash||hash.length!==128)return false;return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hash,'hex'));}catch{return false;}}
export function isSameOrigin(origin:string|null,requestUrl:string,configuredOrigin?:string):boolean {try{return !!origin&&new URL(origin).origin===new URL(configuredOrigin||requestUrl).origin;}catch{return false;}}
export function safeExternalUrl(value:string):string|null {try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export function canReadAsset(owner:boolean,publiclyReferenced:boolean):boolean{return owner||publiclyReferenced;}
export function imageMime(bytes:Buffer):string|null{
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=6&&['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()))return 'image/gif';
  if(bytes.length>=12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';
  return null;
}
