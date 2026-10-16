'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {chatImageUrl} from '@/lib/iris-chat-files';
import {Modal} from './modal';

export function IrisChatImage({name,file,sessionId='',attachmentId=''}:{name:string;file?:File;sessionId?:string;attachmentId?:string}){
  const [localUrl,setLocalUrl]=useState('');const [open,setOpen]=useState(false);const [failed,setFailed]=useState(false);
  useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);setLocalUrl(url);return()=>URL.revokeObjectURL(url);},[file]);
  const src=file?localUrl:chatImageUrl(sessionId,attachmentId)||'';
  useEffect(()=>{setFailed(false);},[src]);
  return <><button type="button" className="iris-chat-image" aria-label={`查看图片：${name}`} disabled={!src||failed} onClick={()=>setOpen(true)}>{src&&!failed?<img src={src} alt={name} loading="lazy" onError={()=>setFailed(true)}/>:<span>{failed?'图片暂时无法预览':'图片预览'}</span>}</button>
    {open&&src&&createPortal(<Modal title="查看聊天图片" onClose={()=>setOpen(false)} wide className="article-image-lightbox"><img className="article-image-full" src={src} alt={name}/><p className="article-image-full-caption">{name}</p></Modal>,document.body)}</>;
}
