import type {IrisEvent} from './types';

export function irisTextDelta(event:IrisEvent){return String(event.data.content??event.data.text??event.data.delta??'');}

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
