import {api} from './client';

export const MAX_CHAT_FILES=10;
export const MAX_CHAT_FILE_SIZE=20*1024*1024;
export const CHAT_FILE_ACCEPT='.png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.docx,.xlsx,.xls';
export interface IrisChatAttachment {id:string;original_name:string;size_bytes?:number;media_type?:string;extraction_status?:string;extraction_message?:string;localFile?:File}
export function isChatImage(attachment:Pick<IrisChatAttachment,'original_name'|'media_type'>){return /^image\/(png|jpeg|webp)$/.test(attachment.media_type||'')||/\.(png|jpe?g|webp)$/i.test(attachment.original_name);}
export function chatImageUrl(sessionId:string,id:string){return /^[A-Za-z0-9_-]{1,100}$/.test(sessionId)&&/^[A-Za-z0-9_-]{1,100}$/.test(id)?`/api/iris/sessions/${encodeURIComponent(sessionId)}/attachments/${encodeURIComponent(id)}/download`:null;}
export interface PendingChatFile {key:string;file:File;uploaded?:{sessionId:string;attachment:IrisChatAttachment}}
export function validateChatFile(file:Pick<File,'name'|'size'>){
  if(!/\.(png|jpe?g|webp|pdf|txt|md|docx|xlsx|xls)$/i.test(file.name))throw new Error('附件支持图片、PDF、TXT、Markdown、Word 和 Excel。');
  if(!file.size)throw new Error(`「${file.name}」是空文件，请重新选择。`);
  if(file.size>MAX_CHAT_FILE_SIZE)throw new Error(`「${file.name}」超过 20 MB，请缩小后再发送。`);
}
export function appendChatFiles(current:PendingChatFile[],files:File[]):PendingChatFile[]{
  if(current.length+files.length>MAX_CHAT_FILES)throw new Error('每次最多发送 10 份附件，请分批发送。');
  files.forEach(validateChatFile);
  return [...current,...files.map(file=>({key:crypto.randomUUID(),file}))];
}
export function chatFileSize(bytes:number){return bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.ceil(bytes/1024))} KB`;}
export function droppedChatFiles(data:Pick<DataTransfer,'types'|'files'>):File[]{return Array.from(data.types).includes('Files')?Array.from(data.files):[];}
export async function uploadChatFiles(sessionId:string,files:PendingChatFile[],signal?:AbortSignal,onUploaded?:(key:string,uploaded:NonNullable<PendingChatFile['uploaded']>)=>void):Promise<string[]>{
  const ids:string[]=[];
  for(const entry of files){
    signal?.throwIfAborted();
    if(entry.uploaded?.sessionId===sessionId){ids.push(entry.uploaded.attachment.id);continue;}
    const form=new FormData();form.append('file',entry.file);
    const result=await api<{attachment:IrisChatAttachment}>(`iris/sessions/${encodeURIComponent(sessionId)}/attachments`,{method:'POST',body:form,signal});
    const attachment=result.attachment;
    if(!attachment||!/^[A-Za-z0-9_-]{1,100}$/.test(attachment.id))throw new Error('Iris 未返回有效的附件编号，请重试。');
    if(attachment.extraction_status==='failed'&&!/\.(png|jpe?g|webp)$/i.test(entry.file.name))throw new Error(`Iris 无法读取「${entry.file.name}」，请换成可读取的文件。`);
    const uploaded={sessionId,attachment};onUploaded?.(entry.key,uploaded);ids.push(attachment.id);
  }
  return ids;
}
