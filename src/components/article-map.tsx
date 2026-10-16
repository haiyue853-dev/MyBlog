'use client';
import {BookOpen,Briefcase,Plane,Map,ArrowRight,Layers,Tags} from 'lucide-react';
import {useState,type CSSProperties,type MouseEvent} from 'react';
import type {Item,Profile} from '@/lib/types';
import {ARTICLE_CATEGORIES,articleMetrics,itemExcerpt} from '@/lib/articles';
import {dateLabel} from '@/lib/client';
import {ArticleHeader} from './article-header';
import {SpoilerBadge} from './article-preview';

export function ArticleMap({articles,profile,category='',tag='',series='',embedded=false,onLife}:{articles:Item[];profile:Profile;category?:string;tag?:string;series?:string;embedded?:boolean;onLife?:()=>void}){
  const [filters,setFilters]=useState({category,tag,series});
  if(embedded)({category,tag,series}=filters);
  const Content=embedded?'div':'main';
  function filterClick(key:'category'|'tag'|'series',value:string){return embedded?(event:MouseEvent<HTMLAnchorElement>)=>{event.preventDefault();setFilters(current=>({...current,[key]:value}));}:undefined;}
  const categories=[...new Set([...ARTICLE_CATEGORIES,...articles.map(item=>item.category||'未分类')])];
  const seriesNames=[...new Set(articles.map(item=>item.article?.series).filter((value):value is string=>!!value))];
  const tags=[...new Set(articles.flatMap(item=>item.tags))];
  const selected=articles.filter(item=>(!category||(item.category||'未分类')===category)&&(!tag||item.tags.includes(tag))&&(!series||item.article?.series===series));
  function link(key:string,value:string){return '/posts?'+new URLSearchParams({...category&&{category},...tag&&{tag},...series&&{series},[key]:value}).toString();}
  return <div className={`article-site ${embedded?'article-embedded':''}`} style={{'--space-accent':profile.accent} as CSSProperties}>{!embedded&&<ArticleHeader profile={profile}/>}<Content className="article-map">
    <header className="article-map-intro"><span className="eyebrow">a map of my stories</span><h1><Map size={27}/>文章地图<span className="heading-dot">.</span></h1><p>日常、工作、旅行，沿着喜欢的线索慢慢读。</p><div className="article-map-counts"><span>{articles.length} 篇文章</span><span>{new Set(articles.map(item=>item.category||'未分类')).size} 个分类</span><span>{seriesNames.length} 个系列</span></div></header>
    <section className="article-map-section" aria-label="文章分类"><div className="article-section-label"><BookOpen size={19}/><h2>分类目录</h2></div><div className="article-category-grid">{categories.map(name=>{const Icon=name==='工作'?Briefcase:name==='旅游'?Plane:BookOpen;return <a href={link('category',name)} onClick={filterClick('category',name)} key={name} className={category===name?'selected':''} aria-current={category===name?'page':undefined}><Icon size={21}/><strong>{name}</strong><span>{articles.filter(item=>(item.category||'未分类')===name).length} 篇</span><ArrowRight size={16}/></a>;})}</div></section>
    <section className="article-map-section" aria-label="专题系列"><div className="article-section-label"><Layers size={19}/><h2>专题系列</h2></div>{seriesNames.length?<div className="article-series-grid">{seriesNames.map(name=><a className={series===name?'selected':''} key={name} href={link('series',name)} onClick={filterClick('series',name)}><span>{name}</span><small>{articles.filter(item=>item.article?.series===name).length} 篇</small><ArrowRight size={15}/></a>)}</div>:<p className="muted">编辑文章时填写专题系列，就能把连续的故事放在一起。</p>}</section>
    <section className="article-map-section" aria-label="文章标签"><div className="article-section-label"><Tags size={19}/><h2>标签线索</h2></div><div className="article-tag-links">{tags.map(name=><a key={name} className={tag===name?'selected':''} href={link('tag',name)} onClick={filterClick('tag',name)}>#{name}<small>{articles.filter(item=>item.tags.includes(name)).length}</small></a>)}{tags.length===0&&<p className="muted">为文章添加标签，留下更多可以找到它的线索。</p>}</div></section>
    <section className="article-map-section" aria-label="文章列表"><div className="article-map-list-heading"><h2>{[category,series,tag&&`#${tag}`].filter(Boolean).join(' · ')||'全部文章'} <small>{selected.length} 篇</small></h2>{(category||tag||series)&&<a className="text-button" href="/posts" onClick={embedded?event=>{event.preventDefault();setFilters({category:'',tag:'',series:''});}:undefined}>查看全部</a>}</div>{selected.length?<div className="article-map-list">{selected.map(item=>{const metrics=articleMetrics(item.body);return <article className="paper" key={item.id}><div className="card-meta"><span>{dateLabel(item.createdAt)}</span><span>{item.category}</span><SpoilerBadge item={item}/>{item.visibility==='private'&&<span>仅自己</span>}</div><h3><a href={`/posts/${item.id}`}>{item.title}<ArrowRight aria-hidden="true"/></a></h3><p>{itemExcerpt(item)}</p><div className="article-reading-meta"><span>{metrics.characters} 字 · 约 {metrics.minutes} 分钟</span><a href={`/posts/${item.id}`}>读这篇 <ArrowRight size={14}/></a></div></article>;})}</div>:<div className="paper article-map-empty"><BookOpen size={30}/><p>{articles.length?'这里还没有符合筛选的文章。':'第一篇文章，等待你的故事。'}</p><a className="text-button" href="/?view=life" onClick={onLife?event=>{event.preventDefault();onLife();}:undefined}>去生活碎片写一篇 <ArrowRight size={15}/></a></div>}</section>
  </Content>{!embedded&&<footer className="article-site-footer">把日常收好，把喜欢留下。</footer>}</div>;
}
