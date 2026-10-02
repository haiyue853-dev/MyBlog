import {createHash} from 'node:crypto';
import {newToken} from './http';
import {isSecureRequest} from './security';

const COOKIE='world-visitor';
export function visitorToken(request:Request){
  const value=request.headers.get('cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
  return /^[a-f0-9]{64}$/.test(value)?value:'';
}
export function visitorHash(token:string){return createHash('sha256').update(token).digest('hex');}
export function visitorIdentity(request:Request){
  const existing=visitorToken(request);const token=existing||newToken();
  const headers:Record<string,string>=existing?{}:{'Set-Cookie':`${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${390*86400}${isSecureRequest(request)?'; Secure':''}`};
  return {hash:visitorHash(token),headers};
}
