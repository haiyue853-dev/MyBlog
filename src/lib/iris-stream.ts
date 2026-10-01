import type {IrisEvent} from './types';

export const IRIS_SOURCE_FALLBACK='iris-source';

export function irisTextDelta(event:IrisEvent){return String(event.data.content??event.data.text??event.data.delta??'');}

export function sourceFileName(disposition:string|null|undefined):string{
  if(!disposition)return IRIS_SOURCE_FALLBACK;
  const extended=/filename\*\s*=\s*([^']*)'([^']*)'([^;]+)/i.exec(disposition);
  let raw='';
  if(extended)raw=extended[3].trim();
  else{const plain=/filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(disposition);raw=(plain?plain[1]??plain[2]??'':'').trim();}
  if(!raw)return IRIS_SOURCE_FALLBACK;
  let value=raw;try{value=decodeURIComponent(raw);}catch{}
  const name=value.replace(/[\u0000-\u001f\u007f]/g,'').split(/[\\/]/).filter(part=>part&&part!=='.'&&part!=='..').pop()?.trim()||'';
  return name&&name.length<=120?name:IRIS_SOURCE_FALLBACK;
}

export function attachmentDisposition(name:string):string{
  const safe=name.replace(/[\u0000-\u001f\u007f]/g,'').trim()||IRIS_SOURCE_FALLBACK;
  if(/^[\x20-\x7e]+$/.test(safe)&&!/["\\]/.test(safe))return `attachment; filename="${safe}"`;
  const ascii=safe.replace(/[^\x20-\x7e]/g,'_').replace(/["\\]/g,'_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export function allowedIrisPath(path:string[]):boolean {
  if(path.some(part=>!(/^[A-Za-z0-9_-]{1,100}$/.test(part))))return false;
  if(path.length===1&&['health','sessions','knowledge'].includes(path[0]))return true;
  if(path.length===2&&path[0]==='chat'&&path[1]==='stream')return true;
  if(path.length===2&&path[0]==='sessions')return true;
  if(path[0]==='knowledge'&&path.length===2)return !['runtime','export','evaluate','reindex','graph','import'].includes(path[1]);
  if(path[0]==='knowledge'&&path.length===3&&path[2]==='source')return true;
  return false;
}
export async function* readIrisEvents(stream:ReadableStream<Uint8Array>):AsyncGenerator<IrisEvent>{
  const reader=stream.getReader();const decoder=new TextDecoder();let pending='';
  const parse=(line:string)=>{const event=JSON.parse(line);if(typeof event.type!=='string'||!event.data||typeof event.data!=='object')throw new Error('Iris 返回了无法识别的数据。');return event as IrisEvent;};
  try{while(true){const {done,value}=await reader.read();pending+=done?decoder.decode():decoder.decode(value,{stream:true});let index;while((index=pending.indexOf('\n'))>=0){const line=pending.slice(0,index).trim();pending=pending.slice(index+1);if(line)yield parse(line);}if(done)break;}if(pending.trim())yield parse(pending.trim());}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
