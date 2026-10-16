'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,Film,NotebookPen,Disc3,Search,X,LockKeyhole,FilePenLine,Clapperboard} from 'lucide-react';
import {searchSite,highlightSearchText,SEARCH_TYPES,SEARCH_LABELS,type SearchFilters} from '@/lib/site-search';
import {isPublished} from '@/lib/content-state';
import {cardAspect,type Item} from '@/lib/types';
import {dateLabel,fileUrl} from '@/lib/client';
import {SpoilerBadge} from './article-preview';

function Match({text,query}:{text:string;query:string}){return <>{highlightSearchText(text,query).map((part,index)=>part.match?<mark key={index}>{part.text}</mark>:part.text)}</>;}
const icons={article:BookOpen,review:Film,daily:NotebookPen,collection:Disc3,video:Clapperboard};

export function SiteSearch({items,owner,filters,onFiltersChange,onOpen,onClose,articlePages=true}:{items:Item[];owner:boolean;filters:SearchFilters;onFiltersChange:(filters:SearchFilters)=>void;onOpen:(item:Item)=>void;onClose:()=>void;articlePages?:boolean}){
  const input=useRef<HTMLInputElement>(null);const panel=useRef<HTMLDivElement>(null);const [limit,setLimit]=useState(20);
  useEffect(()=>{setLimit(20);},[filters.query,filters.type]);
  useEffect(()=>{
    const header=panel.current?.closest('.site-header');if(!header)return;
    function measure(){const viewport=window.visualViewport;const available=(viewport?.height||window.innerHeight)+(viewport?.offsetTop||0)-header!.getBoundingClientRect().bottom-20;panel.current?.style.setProperty('--search-max-height',`${Math.max(80,available)}px`);}
    measure();const observer=new ResizeObserver(measure);observer.observe(header);
    window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);};
  },[]);
  useEffect(()=>{
    function outside(event:PointerEvent){const target=event.target as Element;if(!panel.current?.contains(target)&&!target.closest?.('.site-search-toggle'))onClose();}
    function escape(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();document.querySelector<HTMLButtonElement>('.site-search-toggle')?.focus();}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);};
  },[onClose]);
  const result=searchSite(items,owner,filters);const hasQuery=!!filters.query.trim();
  function open(item:Item){onClose();onOpen(item);}
  return <div ref={panel} id="site-search-popover" role="dialog" aria-label="全站搜索" className="site-search">
    <form role="search" onSubmit={event=>event.preventDefault()}><label className="site-search-input"><Search size={19}/><input ref={input} type="search" aria-label="搜索全站内容" placeholder="搜索文章、日常或收藏…" value={filters.query} maxLength={120} autoFocus onChange={event=>onFiltersChange({...filters,query:event.target.value})}/>{filters.query?<button type="button" className="icon-button" aria-label="清空搜索" onClick={()=>{onFiltersChange({...filters,query:''});input.current?.focus();}}><X size={16}/></button>:<button type="button" className="icon-button site-search-close" aria-label="关闭搜索" onClick={onClose}><X size={17}/></button>}</label></form>
    {hasQuery&&<><div className="site-search-types" aria-label="搜索内容类型">{SEARCH_TYPES.filter(type=>type!=='video').map(type=><button key={type} aria-pressed={filters.type===type} aria-label={`搜索类型：${SEARCH_LABELS[type]}`} onClick={()=>onFiltersChange({...filters,type})}>{SEARCH_LABELS[type]}<small>{result.counts[type]}</small></button>)}</div><div className="site-search-status" role="status" aria-live="polite" aria-atomic="true">找到 <strong>{result.total}</strong> 条{filters.type==='all'?'内容':SEARCH_LABELS[filters.type]}</div>
    {result.total===0?<div className="site-search-empty"><p>这次还没找到，换个关键词试试。</p>{filters.type!=='all'&&<button className="text-button" onClick={()=>onFiltersChange({...filters,type:'all'})}>搜索全部内容 <ArrowRight size={14}/></button>}</div>:<div className="site-search-results">{result.results.slice(0,limit).map(({item,type,excerpt})=>{
      const Icon=icons[type];const article=type==='article'||type==='review';
      const content=<><div className="site-search-result-meta"><span><Icon size={12}/>{SEARCH_LABELS[type]}</span><span>{dateLabel(item.createdAt)}</span><SpoilerBadge item={item}/>{item.category&&<span><Match text={item.category} query={filters.query}/></span>}{owner&&item.visibility==='private'&&<span><LockKeyhole size={12}/>仅自己</span>}{owner&&!isPublished(item)&&<span><FilePenLine size={12}/>草稿</span>}</div><h3><Match text={item.title} query={filters.query}/></h3>{excerpt&&<p className="site-search-excerpt"><Match text={excerpt} query={filters.query}/></p>}<span className="site-search-open"><ArrowRight size={15}/></span></>;
      const image=(type==='collection'||type==='video')&&item.assetId?<div className="site-search-photo" style={{aspectRatio:type==='video'?'16/9':cardAspect(item)}}><img src={fileUrl(item.assetId,true)} alt={item.title} loading="lazy"/></div>:null;
      return <article key={item.id} className={`site-search-result ${type==='collection'||type==='video'?'has-collection':''}`}>{article&&articlePages?<a className="site-search-result-link" href={`/posts/${item.id}`} onClick={event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)onClose();}} aria-label={`阅读全文：${item.title}`}>{content}</a>:<button className="site-search-result-link" onClick={()=>open(item)} aria-label={`查看${SEARCH_LABELS[type]}：${item.title}`}>{image}<div className="site-search-result-copy">{content}</div></button>}</article>;
    })}</div>}
    {result.total>limit&&<button className="site-search-more" onClick={()=>setLimit(current=>current+20)}>再看看更多 <span>{result.total-limit} 条</span><ArrowRight size={14}/></button>}</>}
  </div>;
}
