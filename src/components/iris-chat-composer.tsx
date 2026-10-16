'use client';
import {useRef,useState,type DragEvent,type FormEvent} from 'react';
import {ArrowUp,Square,Paperclip,X} from 'lucide-react';
import {CHAT_FILE_ACCEPT,chatFileSize,droppedChatFiles,isChatImage,type PendingChatFile} from '@/lib/iris-chat-files';
import {IrisChatImage} from './iris-chat-image';

export function IrisChatComposer({files,question,online,sending,onFiles,onRemove,onQuestion,onSubmit,onStop}:{files:PendingChatFile[];question:string;online:boolean;sending:boolean;onFiles:(files:File[])=>void;onRemove:(key:string)=>void;onQuestion:(question:string)=>void;onSubmit:(event:FormEvent)=>void;onStop:()=>void}){
  const [dragging,setDragging]=useState(false);const depth=useRef(0);
  function drop(event:DragEvent<HTMLDivElement>){event.preventDefault();depth.current=0;setDragging(false);if(!sending)onFiles(droppedChatFiles(event.dataTransfer));}
  return <div className={`iris-chat-composer ${dragging?'is-dragging':''}`} aria-label="Iris 文件拖放区" onDragEnter={event=>{if(Array.from(event.dataTransfer.types).includes('Files')){event.preventDefault();depth.current++;if(!sending)setDragging(true);}}} onDragOver={event=>{if(Array.from(event.dataTransfer.types).includes('Files')){event.preventDefault();event.dataTransfer.dropEffect=sending?'none':'copy';}}} onDragLeave={event=>{if(Array.from(event.dataTransfer.types).includes('Files')){depth.current=Math.max(0,depth.current-1);if(!depth.current)setDragging(false);}}} onDrop={drop}>
    {files.length>0&&<ul className="iris-chat-files" aria-label="待发送附件">{files.map(entry=><li key={entry.key}>{isChatImage({original_name:entry.file.name,media_type:entry.file.type})?<IrisChatImage name={entry.file.name} file={entry.file}/>:<Paperclip size={14}/>}<span><strong>{entry.file.name}</strong><small>{chatFileSize(entry.file.size)} · {entry.uploaded?'已上传，待发送':'待发送'}</small></span><button type="button" className="icon-button" aria-label={`移除附件 ${entry.file.name}`} disabled={sending} onClick={()=>onRemove(entry.key)}><X size={14}/></button></li>)}</ul>}
    <form className="chat-input" onSubmit={onSubmit}>
      <label className={`icon-button iris-chat-file-picker ${sending?'is-disabled':''}`} title="添加附件"><Paperclip size={17}/><input type="file" aria-label="给 Iris 添加附件" accept={CHAT_FILE_ACCEPT} multiple disabled={sending} onChange={event=>{const selected=Array.from(event.target.files||[]);event.target.value='';onFiles(selected);}}/></label>
      <textarea aria-label="给 Iris 的问题" placeholder={online?'问问 Iris，也可以拖入文件…':'Iris 连接后就可以对话了'} value={question} onChange={event=>onQuestion(event.target.value)} maxLength={10000} rows={2} disabled={!online} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}/>
      {sending?<button type="button" className="send-button" onClick={onStop} aria-label="停止回答"><Square size={16}/></button>:<button className="send-button" disabled={!online||!question.trim()&&!files.length} aria-label="发送问题"><ArrowUp size={19}/></button>}
    </form><p className="iris-chat-file-hint" role={dragging?'status':undefined}>{dragging?'松开即可添加附件':'拖入文件或点击回形针添加 · 最多 10 份，每份 20 MB'}</p>
  </div>;
}
