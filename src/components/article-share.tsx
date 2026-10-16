'use client';
import {useEffect,useLayoutEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {Share2,Copy,ImagePlus,Download,X,LoaderCircle} from 'lucide-react';
import {api,ClientError,errorMessage} from '@/lib/client';
import {articleShareData,sharePopoverPosition} from '@/lib/article-share-data';
import {isPublicItem} from '@/lib/content-state';
import type {Item,Profile} from '@/lib/types';

interface Poster {src:string;filename:string;revision:string;}
export function ArticleShare({item,profile}:{item:Item;profile:Profile}){
  const id=useId();const root=useRef<HTMLDivElement>(null);const panel=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);const linkField=useRef<HTMLInputElement>(null);const request=useRef<AbortController|null>(null);
  const [open,setOpen]=useState(false);const [busy,setBusy]=useState('');const [poster,setPoster]=useState<Poster|null>(null);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [link,setLink]=useState('');const [fallback,setFallback]=useState(false);const [local,setLocal]=useState(false);
  function close(){request.current?.abort();request.current=null;setOpen(false);setBusy('');setPoster(null);setError('');setNotice('');setFallback(false);}
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>()=>{if(poster)URL.revokeObjectURL(poster.src);},[poster]);
  useEffect(()=>{close();},[item.id,item.updatedAt,profile.name,profile.aboutName,profile.accent]);
  useEffect(()=>{if(fallback)linkField.current?.focus();},[fallback]);
  useLayoutEffect(()=>{
    if(!open||!panel.current)return;const popup=panel.current;let frame=0;
    function place(){
      frame=0;const anchor=trigger.current?.getBoundingClientRect();if(!anchor)return;
      const viewport={width:document.documentElement.clientWidth,height:innerHeight};const headerBottom=Math.max(0,document.querySelector('.site-header')?.getBoundingClientRect().bottom||0);
      const size=sharePopoverPosition(anchor,viewport,headerBottom,0);popup.style.width=`${size.width}px`;popup.style.maxHeight=`${size.maxHeight}px`;
      const position=sharePopoverPosition(anchor,viewport,headerBottom,popup.getBoundingClientRect().height);popup.style.left=`${position.left}px`;popup.style.top=`${position.top}px`;popup.style.visibility='visible';
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(place);}
    place();const observer=new ResizeObserver(schedule);observer.observe(popup);const header=document.querySelector('.site-header');if(header)observer.observe(header);
    window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
  },[open]);
  useEffect(()=>{
    if(!open)return;
    panel.current?.querySelector<HTMLButtonElement>('.article-share-close')?.focus({preventScroll:true});
    function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node)&&!panel.current?.contains(event.target as Node))close();}
    function escape(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();trigger.current?.focus({preventScroll:true});}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  function show(){
    if(open){close();return;}const data=articleShareData(item,profile,location.origin);if(!data)return;
    setLink(data.url);setLocal(data.local);setOpen(true);
  }
  async function act(action:'copy'|'generate'|'download'){
    if(busy)return;const controller=new AbortController();request.current=controller;setBusy(action);setError('');setNotice('');setFallback(false);
    try{
      const fresh=(await api<{item:Item}>(`items/${item.id}`,{signal:controller.signal})).item;
      const data=articleShareData(fresh,profile,location.origin);if(!data){setPoster(null);throw new Error('这篇文章当前未公开，暂时无法分享。');}
      controller.signal.throwIfAborted();setLink(data.url);setLocal(data.local);
      if(action==='copy'){
        try{await navigator.clipboard.writeText(data.url);if(!controller.signal.aborted)setNotice('文章链接已复制。');}
        catch{if(!controller.signal.aborted){setFallback(true);setNotice('可选中下方链接手动复制。');}}
      }else if(action==='generate'){
        setPoster(null);const {createSharePoster}=await import('@/lib/share-poster');
        const blob=await createSharePoster(data,controller.signal);controller.signal.throwIfAborted();
        setPoster({src:URL.createObjectURL(blob),filename:data.filename,revision:fresh.updatedAt});setNotice('分享图已生成，可以下载了。');
      }else if(poster){
        if(poster.revision!==fresh.updatedAt){setPoster(null);throw new Error('文章已更新，请重新生成分享图。');}
        const anchor=document.createElement('a');anchor.href=poster.src;anchor.download=poster.filename;document.body.append(anchor);anchor.click();anchor.remove();setNotice('已开始下载分享图。');
      }
    }catch(error){if(!controller.signal.aborted){if(error instanceof ClientError&&[401,404].includes(error.status))setPoster(null);setError(errorMessage(error));}}
    finally{if(request.current===controller){request.current=null;setBusy('');}}
  }
  if(!item.article||!isPublicItem(item))return null;
  return <div className="article-share" ref={root}>
    <button ref={trigger} type="button" className="article-share-trigger" aria-label="分享这篇文章" aria-expanded={open} aria-controls={id} onClick={show}><Share2 size={16}/><span>分享</span></button>
    {open&&createPortal(<div ref={panel} id={id} className="article-share-popover paper" role="dialog" aria-label="文章分享" style={{'--space-accent':profile.accent} as CSSProperties}>
      <div className="article-share-heading"><div><Share2 size={17}/><h2>把这篇故事分享出去</h2></div><button type="button" className="icon-button article-share-close" aria-label="关闭文章分享" onClick={()=>{close();trigger.current?.focus({preventScroll:true});}}><X size={17}/></button></div>
      <p className="article-share-caption">复制文章链接，或把它收成一张分享卡片。</p>
      {local&&<p className="article-share-local">当前是本地／内网预览链接，网站上线后请重新生成分享图。</p>}
      <div className="article-share-actions"><button type="button" className="button secondary" disabled={!!busy} onClick={()=>void act('copy')}>{busy==='copy'?<LoaderCircle size={15} className="spin"/>:<Copy size={15}/>}复制链接</button><button type="button" className="button primary" disabled={!!busy} onClick={()=>void act('generate')}>{busy==='generate'?<LoaderCircle size={15} className="spin"/>:<ImagePlus size={15}/>} {busy==='generate'?'正在生成…':poster?'重新生成':'生成分享图'}</button></div>
      {fallback&&<label className="article-share-fallback">文章链接<input ref={linkField} readOnly value={link} onFocus={event=>event.currentTarget.select()}/></label>}
      {poster&&<div className="article-share-preview"><img src={poster.src} alt={`「${item.title}」的分享卡片预览`}/><button type="button" className="button secondary" disabled={!!busy} onClick={()=>void act('download')}>{busy==='download'?<LoaderCircle size={15} className="spin"/>:<Download size={15}/>}下载图片</button></div>}
      {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="article-share-notice" role="status">{notice}</p>}
    </div>,document.body)}
  </div>;
}
