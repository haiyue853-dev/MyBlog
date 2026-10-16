'use client';
import {ArrowRight,Plus,NotebookPen} from 'lucide-react';
import {dateLabel} from '@/lib/client';
import type {Item} from '@/lib/types';

export function RecentMoments({items,onOpen,onCreate}:{items:Item[];onOpen:(item:Item)=>void;onCreate?:()=>void}){
  return <section className="recent-moments" aria-label="最近的小事"><div className="recent-moments-heading"><div><h2>最近的小事<span className="heading-dot">.</span></h2><p>几句心情，几个想留住的瞬间。</p></div>{onCreate&&<button className="text-button" onClick={onCreate}><Plus size={14}/>记小事</button>}</div><div className="paper recent-moments-list">{items.length?items.map(item=><button key={item.id} onClick={()=>onOpen(item)}><NotebookPen size={16}/><span className="recent-moment-title">{item.title}</span><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time><ArrowRight size={14}/></button>):<p>日常里的小小心情，会慢慢收在这里。</p>}</div><a className="text-button recent-moments-more" href="/?view=life">翻看生活碎片 <ArrowRight size={14}/></a></section>;
}
