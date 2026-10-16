'use client';
import {managedContentType} from '@/lib/content-state';
import {useState,type CSSProperties} from 'react';
import {History,ArrowRight,LockKeyhole} from 'lucide-react';
import {timelineGroups} from '@/lib/articles';
import {dateLabel} from '@/lib/client';
import type {Item,Profile} from '@/lib/types';
import {ArticleHeader} from './article-header';
import {SpoilerBadge} from './article-preview';
import {Modal} from './modal';
import {ItemGallery} from './item-gallery';
import {RecordBody} from './record-body';

export function Timeline({items,profile,owner,embedded=false,onLife}:{items:Item[];profile:Profile;owner:boolean;embedded?:boolean;onLife?:()=>void}){
  const Content=embedded?'div':'main';
  const groups=timelineGroups(items,owner);const [detail,setDetail]=useState<Item|null>(null);
  const count=groups.reduce((total,year)=>total+year.months.reduce((total,month)=>total+month.items.length,0),0);
  function row(item:Item){return <><time dateTime={item.createdAt}>{dateLabel(item.createdAt).split('/').slice(1).join('-')}</time><span className="timeline-row-title">{item.title}<SpoilerBadge item={item}/></span><span className="timeline-type">{item.article?(managedContentType(item)==='review'?'观后感':'文章'):'小事'}</span>{item.visibility==='private'&&<LockKeyhole size={12}/>}<ArrowRight size={14}/></>;}
  return <div className={`article-site ${embedded?'article-embedded':''}`} style={{'--space-accent':profile.accent} as CSSProperties}>{!embedded&&<ArticleHeader profile={profile}/>}<Content className="article-map timeline-page"><header className="article-map-intro"><span className="eyebrow">the days we keep</span><h1><History size={27}/>时光轴<span className="heading-dot">.</span></h1><p>写过的文章，记下的小事，都留在时间里。</p><div className="article-map-counts"><span>{count} 条记录</span><span>{groups.length} 个年份</span></div></header>{groups.length?<div className="timeline-layout"><nav className="timeline-years" aria-label="选择年份">{groups.map(group=><a key={group.year} href={`#year-${group.year}`}>{group.year}</a>)}</nav><div className="timeline-years-content">{groups.map(group=><section className="timeline-year" key={group.year} id={`year-${group.year}`} aria-label={`${group.year} 年的记录`}><header><h2>{group.year}</h2><span>{group.months.reduce((total,month)=>total+month.items.length,0)} 条记录</span></header>{group.months.map(month=><div className="timeline-month" key={month.month}><h3>{Number(month.month)} 月</h3><div className="paper timeline-rows">{month.items.map(item=>item.article?<a href={`/posts/${item.id}`} key={item.id}>{row(item)}</a>:<button key={item.id} onClick={()=>setDetail(item)}>{row(item)}</button>)}</div></div>)}</section>)}</div></div>:<div className="paper article-map-empty"><History size={30}/><p>这里会慢慢装满属于你的时间。</p><a className="text-button" href="/?view=life" onClick={onLife?event=>{event.preventDefault();onLife();}:undefined}>留下第一条记录 <ArrowRight size={14}/></a></div>}</Content>{!embedded&&<footer className="article-site-footer">把日常收好，把喜欢留下。</footer>}{detail&&<Modal title={detail.title} onClose={()=>setDetail(null)} wide><ItemGallery item={detail}/><div className="card-meta"><span>{dateLabel(detail.createdAt)}</span><span>{detail.category}</span></div><RecordBody body={detail.body} images={detail.images}/></Modal>}</div>;
}
