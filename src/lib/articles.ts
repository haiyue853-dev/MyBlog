import {isPublicItem} from './content-state';
import type {ArticleConfig,Item} from './types';
import {validCoverCrop} from './article-cover';

export const ARTICLE_CATEGORIES=['日常','工作','旅游','观后感'];
export function newArticle():ArticleConfig{return {summary:'',kicker:'',series:'',spoiler:false,coverPosition:'center',facts:[],quote:''};}
export function parseArticleConfig(value:unknown):ArticleConfig|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const data=value as Record<string,unknown>;
  const limits={summary:240,kicker:100,series:80,quote:300};
  if(Object.entries(limits).some(([key,max])=>typeof data[key]!=='string'||(data[key] as string).length>max))return null;
  if(typeof data.spoiler!=='boolean'||!['top','center','bottom'].includes(String(data.coverPosition)))return null;
  if(data.coverCrop!==undefined&&!validCoverCrop(data.coverCrop))return null;
  if(!Array.isArray(data.facts)||data.facts.length>6||data.facts.some(fact=>!fact||typeof fact!=='object'||typeof fact.label!=='string'||typeof fact.value!=='string'||fact.label.length>30||fact.value.length>100))return null;
  return {summary:(data.summary as string).trim(),kicker:(data.kicker as string).trim(),series:(data.series as string).trim(),quote:(data.quote as string).trim(),spoiler:data.spoiler,coverPosition:data.coverPosition as ArticleConfig['coverPosition'],...(data.coverCrop!==undefined?{coverCrop:{x:data.coverCrop.x,y:data.coverCrop.y,zoom:data.coverCrop.zoom}}:{}),facts:data.facts.map(fact=>({label:fact.label.trim(),value:fact.value.trim()}))};
}
export function plainArticleText(body:string){return body.replace(/!\[(?:\\.|[^\]\\])*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/<[^>]*>/g,'').replace(/^(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/gm,'').replace(/[*_~`]/g,'').replace(/\s+/g,' ').trim();}
export function itemExcerpt(item:{body:string;article?:ArticleConfig|null},limit=88){const value=item.article?.summary||plainArticleText(item.body);const chars=Array.from(value);return chars.length>limit?chars.slice(0,limit).join('')+'…':value;}
export function articleMetrics(body:string){const characters=Array.from(plainArticleText(body).replace(/\s/g,'')).length;return {characters,minutes:Math.max(1,Math.ceil(characters/220))};}
export function visibleArticles(items:Item[],owner:boolean){return items.filter(item=>item.kind==='moment'&&item.article&&(owner||isPublicItem(item))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));}
export function articleContext(items:Item[],id:string,owner:boolean){
  const articles=visibleArticles(items,owner);const item=articles.find(article=>article.id===id);if(!item)return null;
  const series=item.article?.series;const sequence=series?articles.filter(article=>article.article?.series===series):articles;
  const index=sequence.findIndex(article=>article.id===id);
  return {item,previous:sequence[index+1]||null,next:sequence[index-1]||null};
}

export function timelineGroups(items:Item[],owner:boolean){
  const rows=items.filter(item=>item.kind==='moment'&&(owner||isPublicItem(item))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
  const groups:{year:string;months:{month:string;items:Item[]}[]}[]=[];
  const formatter=new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'});
  for(const item of rows){
    const parts=formatter.formatToParts(new Date(item.createdAt));const year=parts.find(part=>part.type==='year')!.value;const month=parts.find(part=>part.type==='month')!.value;
    let group=groups.find(group=>group.year===year);if(!group){group={year,months:[]};groups.push(group);}
    let bucket=group.months.find(bucket=>bucket.month===month);if(!bucket){bucket={month,items:[]};group.months.push(bucket);}bucket.items.push(item);
  }
  return groups;
}
