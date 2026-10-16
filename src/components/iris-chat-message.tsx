import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {FilePenLine,Paperclip} from 'lucide-react';
import {isChatImage,type IrisChatAttachment} from '@/lib/iris-chat-files';
import {IrisChatImage} from './iris-chat-image';

export function IrisChatMessage({role,content,error,attachments=[],sessionId='',waiting=false,onPrepareBlog}:{role:string;content:string;error?:string;attachments?:IrisChatAttachment[];sessionId?:string;waiting?:boolean;onPrepareBlog?:()=>void}){
  return <div className={`chat-message ${role==='user'?'user':'assistant'}`}>
    <span className="message-author">{role==='user'?'我':'Iris'}</span>
    {attachments.length>0&&<ul className="iris-message-files" aria-label="本条消息的附件">{attachments.map(attachment=><li key={attachment.id}>{isChatImage(attachment)?<IrisChatImage name={attachment.original_name} file={attachment.localFile} sessionId={sessionId} attachmentId={attachment.id}/>:<Paperclip size={13}/>}<span>{attachment.original_name}</span></li>)}</ul>}
    {(content||!error)&&<div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:props=><a {...props} target="_blank" rel="noopener noreferrer"/>,img:()=>null}}>{content||(waiting?'正在想…':'这条回答没有文字。')}</ReactMarkdown></div>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {role==='assistant'&&content.trim()&&!error&&!waiting&&onPrepareBlog&&<button type="button" className="text-button iris-chat-blog-action" onClick={onPrepareBlog}><FilePenLine size={14}/>整理成博客</button>}
  </div>;
}
