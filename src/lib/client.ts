export class ClientError extends Error {constructor(public status:number,message:string){super(message);}}
export async function api<T=Record<string,unknown>>(path:string,options:RequestInit={}):Promise<T>{const response=await fetch(`/api/${path}`,{...options,cache:'no-store',headers:{...(options.body&&!(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers}});const data=await response.json();if(!response.ok)throw new ClientError(response.status,data.error||'操作失败，请稍后再试。');return data as T;}
export function fileUrl(id:string,inline=false){return `/api/files/${encodeURIComponent(id)}${inline?'?inline=1':''}`;}
export function dateLabel(iso:string){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
export function fileSize(bytes:number){return bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`;}
export function errorMessage(error:unknown){return error instanceof Error?error.message:'操作失败，请稍后再试。';}
