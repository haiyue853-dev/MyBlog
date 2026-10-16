'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,Clock3,NotebookPen,Pencil,Quote,LockKeyhole} from 'lucide-react';
import {api,dateLabel,errorMessage,fileUrl} from '@/lib/client';
import {articleContext,articleMetrics,itemExcerpt} from '@/lib/articles';
import {articleCoverStyle} from '@/lib/article-cover';
import {itemImages} from '@/lib/item-images';
import type {Item,Profile} from '@/lib/types';
import {ArticleHeader} from './article-header';
import {ArticleShare} from './article-share';
import {ArticleComments} from './article-comments';
import {RecordBody} from './record-body';
import {ArticleToc} from './article-toc';
import {Editor} from './editor';
import {ItemGallery} from './item-gallery';
import {DailyHeart,useDailyLikes} from './daily-likes';

export function ArticleReader({item:initialItem,articles,profile,owner,embedded=false,onChanged}:{item:Item;articles:Item[];profile:Profile;owner:boolean;embedded?:boolean;onChanged?:(item:Item)=>void}){
  const [item,setItem]=useState(initialItem);const [editing,setEditing]=useState(false);const [error,setError]=useState('');
  const bodyRef=useRef<HTMLDivElement>(null);
  const [inlineImages,setInlineImages]=useState<string[]>([]);
  useEffect(()=>{setInlineImages(Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('[data-article-image]')||[],node=>node.dataset.articleImage||''));},[item.body,item.images]);
  const {likes,pending:pendingLikes,onLike:like}=useDailyLikes([item.id],owner,setError);
  const config=item.article;const context=articleContext(articles.map(row=>row.id===item.id?item:row),item.id,owner);
  const metrics=articleMetrics(item.body);const photos=itemImages(item);const extras=photos.filter(image=>image.assetId!==item.assetId&&!inlineImages.includes(image.assetId));
  async function refresh(){try{const result=await api<{item:Item}>(`items/${item.id}`);setItem(result.item);onChanged?.(result.item);}catch(error){setError(errorMessage(error));}}
  const Content=embedded?'div':'main';
  return <div className={`article-site ${embedded?'article-embedded':''}`}  style={{'--space-accent':profile.accent} as CSSProperties}>{!embedded&&<ArticleHeader profile={profile}/>}
    <Content className="article-reader">
      {error&&<p role="alert" className="form-error">{error}</p>}
      {owner&&<div className="article-owner-bar">{(item.visibility==='private'||item.status==='draft')&&<span><LockKeyhole size={14}/>{item.status==='draft'?'草稿 · 仅自己可见':'仅自己可见'}</span>}<button className="button secondary" onClick={()=>setEditing(true)}><Pencil size={14}/>编辑文章</button></div>}
      {!config?<section className="paper article-content"><p>这篇内容已改为日常记录。</p><a className="text-button" href="/?view=life">返回生活碎片 <ArrowRight size={14}/></a></section>:<>
        <header className={`article-hero ${item.assetId?'has-cover':'no-cover'}`}>
          {item.assetId&&<img className="article-hero-image" src={fileUrl(item.assetId,true)} alt={item.title} style={articleCoverStyle(config)}/>}
          <div className="article-hero-content"><div className="article-hero-badges"><a href={`/posts?category=${encodeURIComponent(item.category||'未分类')}`}>{item.category||'随笔'}</a>{config.spoiler&&<span>含剧透</span>}{config.series&&<a href={`/posts?series=${encodeURIComponent(config.series)}`}>{config.series}</a>}</div>{config.kicker&&<p className="article-kicker">{config.kicker}</p>}<h1>{item.title}</h1>{itemExcerpt(item,240)&&<p className="article-hero-summary">{itemExcerpt(item,240)}</p>}<div className="article-reading-meta"><span><CalendarDays size={15}/>{dateLabel(item.createdAt)}</span><span><NotebookPen size={15}/>{metrics.characters} 字</span><span><Clock3 size={15}/>约 {metrics.minutes} 分钟</span></div></div>
        </header>
        {(config.facts.some(fact=>fact.label&&fact.value)||config.quote)&&<section className="paper article-facts" aria-label="作品资料"><div className="article-section-label"><NotebookPen size={18}/><h2>作品资料</h2></div><dl>{config.facts.filter(fact=>fact.label&&fact.value).map((fact,index)=><div key={index}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>{config.quote&&<blockquote><Quote size={20}/><p>{config.quote}</p></blockquote>}</section>}
        <div className="article-reading-layout"><article className="paper article-content" aria-label="文章正文"><div ref={bodyRef}><RecordBody body={item.body} articleHeadings images={photos}/></div>{extras.length>0&&<div className="article-extra-photos"><h2>照片手记</h2><ItemGallery item={{...item,assetId:extras[0].assetId,images:extras}}/></div>}<footer className="article-content-footer"><div className="card-tags">{item.tags.map(tag=><a key={tag} href={`/posts?tag=${encodeURIComponent(tag)}`}>#{tag}</a>)}</div><div className="article-footer-actions"><ArticleShare item={item} profile={profile}/><DailyHeart title={item.title} like={likes[item.id]} pending={pendingLikes.includes(item.id)} onClick={()=>void like(item.id)}/></div></footer></article><ArticleToc bodyRef={bodyRef} body={item.body} articleId={item.id}/></div>
        <ArticleComments item={item} owner={owner}/>
        <nav className="article-pagination" aria-label={config.series?'系列文章翻页':'文章翻页'}>{context?.previous?<a href={`/posts/${context.previous.id}`}><ArrowLeft size={19}/><span><small>上一篇{config.series?` · ${config.series}`:''}</small><strong>{context.previous.title}</strong></span></a>:<div className="article-page-boundary">已经是第一篇了</div>}{context?.next?<a className="article-next" href={`/posts/${context.next.id}`}><span><small>下一篇{config.series?` · ${config.series}`:''}</small><strong>{context.next.title}</strong></span><ArrowRight size={19}/></a>:<div className="article-page-boundary">下一篇故事，慢慢写</div>}</nav>
      </>}
      <a className="article-back-link" href="/posts">回到文章地图 <ArrowRight size={15}/></a>
    </Content>{!embedded&&<footer className="article-site-footer">把日常收好，把喜欢留下。</footer>}
    {editing&&<Editor kind="moment" item={item} onClose={()=>setEditing(false)} onSaved={()=>void refresh()}/>}
  </div>;
}
