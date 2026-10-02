// Preserve the existing scrypt parameters. Only its costly computation moves to the browser.
export const CLOUD_PASSWORD_SCHEME='scrypt-client-sha256-v1';
import {SCRYPT_COST,SCRYPT_R,SCRYPT_P,SCRYPT_KEYLEN} from './types';
export {SCRYPT_COST,SCRYPT_R,SCRYPT_P,SCRYPT_KEYLEN};
export interface PasswordChallenge {scheme:typeof CLOUD_PASSWORD_SCHEME;salt:string;cost?:number;}
export async function deriveCloudLoginKey(password:string,challenge:PasswordChallenge):Promise<string>{
  if(password.length>256||challenge.scheme!==CLOUD_PASSWORD_SCHEME||!/^[a-f0-9]{32}$/.test(challenge.salt))throw new Error('登录参数无效，请刷新后再试。');
  // 浏览器端按 challenge.cost 做 scrypt。旧账号的 challenge 不带 cost（回落 2^14），
  // 新账号带当前成本（2^15）。worker 端只比对 sha256，不关心具体成本。
  const N=challenge.cost&&challenge.cost>=1024?challenge.cost:16384;
  const {scryptAsync}=await import('@noble/hashes/scrypt.js');
  // Node's original scrypt salt is the ASCII hex string, not decoded bytes.
  const key=await scryptAsync(new TextEncoder().encode(password),new TextEncoder().encode(challenge.salt),{N,r:SCRYPT_R,p:SCRYPT_P,dkLen:SCRYPT_KEYLEN,asyncTick:8});
  try{return Array.from(key,byte=>byte.toString(16).padStart(2,'0')).join('');}finally{key.fill(0);}
}
