import {articleMetrics,plainArticleText} from './articles';
import {isPublicItem} from './content-state';
import type {ArticleCoverCrop,Item,Profile} from './types';

export interface ArticleShareData {url:string;local:boolean;title:string;summary:string;category:string;siteName:string;author:string;date:string;characters:number;minutes:number;coverId:string|null;coverPosition:'top'|'center'|'bottom';coverCrop?:ArticleCoverCrop;accent:string;filename:string;}
const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();
const shorten=(value:string,length:number)=>Array.from(normalize(value)).slice(0,length).join('');
export function articleShareData(item:Item,profile:Profile,origin:string):ArticleShareData|null{
  if(item.kind!=='moment'||!item.article||!isPublicItem(item))return null;
  const base=new URL(origin);if(!['http:','https:'].includes(base.protocol))throw new Error('分享地址不正确。');
  const url=new URL(`/posts/${encodeURIComponent(item.id)}`,base.origin).href;
  const host=base.hostname.toLowerCase();const local=host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host==='[::1]'||host==='0.0.0.0'||/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  const title=normalize(item.title);const safeName=shorten(title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,' '),60)||'小屋文章';
  return {url,local,title,summary:shorten(plainArticleText(item.article.summary||item.body),240),category:shorten(item.category||'随笔',40),siteName:shorten(profile.name,80),author:shorten(profile.aboutName||profile.name,80),date:new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(item.createdAt)),...articleMetrics(item.body),coverId:item.assetId,coverPosition:item.article.coverPosition,...(item.article.coverCrop?{coverCrop:{...item.article.coverCrop}}:{}),accent:/^#[a-f\d]{6}$/i.test(profile.accent)?profile.accent:'#d27b98',filename:`文章分享-${safeName}.png`};
}
export function wrapPosterText(value:string,measure:(text:string)=>number,width:number,maxLines:number):string[]{
  const chars=Array.from(new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(normalize(value)),part=>part.segment);
  const lines:string[]=[];let current='';let index=0;
  for(;index<chars.length;index++){
    const next=current+chars[index];
    if(current&&measure(next)>width){lines.push(current.trimEnd());current='';if(lines.length===maxLines)break;}
    current+=chars[index];
  }
  if(current&&lines.length<maxLines)lines.push(current.trimEnd());
  if(index<chars.length&&lines.length){let last=Array.from(new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(lines[lines.length-1]),part=>part.segment);while(last.length&&measure(last.join('')+'…')>width)last.pop();lines[lines.length-1]=last.join('')+'…';}
  return lines;
}
export function sharePopoverPosition(anchor:{right:number;top:number},viewport:{width:number;height:number},headerBottom:number,panelHeight:number){
  const width=Math.min(380,viewport.width-32);const maxHeight=Math.min(650,Math.max(0,viewport.height-headerBottom-24));
  const height=Math.min(panelHeight,maxHeight);
  const left=Math.min(viewport.width-width-16,Math.max(16,anchor.right-width));
  const top=Math.max(headerBottom+12,Math.min(anchor.top-height-12,viewport.height-height-12));
  return {width,maxHeight,left,top};
}
