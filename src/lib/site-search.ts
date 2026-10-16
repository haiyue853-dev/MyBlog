import {plainArticleText} from './articles';
import {isPublicItem,itemForViewer,managedContentType} from './content-state';
import type {Item} from './types';

export const SEARCH_TYPES=['all','article','review','daily','collection','video'] as const;
export type SearchType=typeof SEARCH_TYPES[number];
export type SearchFilters={query:string;type:SearchType};
export const EMPTY_SEARCH:SearchFilters={query:'',type:'all'};
export const SEARCH_LABELS:Record<SearchType,string>={all:'全部',article:'文章',review:'观后感',daily:'日常',collection:'收藏',video:'视频'};
const normalize=(text:string)=>text.normalize('NFKC').toLowerCase();
const words=(query:string)=>[...new Set(normalize(query).trim().split(/\s+/).filter(Boolean))];

export function searchItemType(item:Item):Exclude<SearchType,'all'>{return item.kind==='video'?'video':item.kind==='collection'?'collection':managedContentType(item);}
function excerptAt(text:string,tokens:string[],limit=110){
  const clean=plainArticleText(text).normalize('NFKC');
  const found=tokens.map(token=>normalize(clean).indexOf(token)).filter(index=>index>=0);
  const first=found.length?Math.min(...found):0;
  const offset=Array.from(clean.slice(0,first)).length;
  const chars=Array.from(clean);const start=Math.max(0,offset-28);const end=Math.min(chars.length,start+limit);
  return (start?'…':'')+chars.slice(start,end).join('')+(end<chars.length?'…':'');
}

export function searchSite(items:Item[],owner:boolean,filters:SearchFilters){
  const tokens=words(filters.query);
  const counts:Record<SearchType,number>={all:0,article:0,review:0,daily:0,collection:0,video:0};
  const matched=tokens.length?items.filter(item=>item.kind!=='video'&&(owner||isPublicItem(item))).map(item=>itemForViewer(item,owner)).flatMap(item=>{
    const title=normalize(item.title);const metadata=normalize([item.category,...item.tags].join(' '));
    const body=plainArticleText(item.body);const summary=plainArticleText(item.watch?.synopsis||item.article?.summary||'');
    const prose=normalize(summary+' '+body);
    if(!tokens.every(token=>title.includes(token)||metadata.includes(token)||prose.includes(token)))return [];
    const type=searchItemType(item);counts.all++;counts[type]++;
    const score=tokens.reduce((sum,token)=>sum+(title.includes(token)?30:metadata.includes(token)?10:1),0);
    const bodyMatched=tokens.some(token=>normalize(body).includes(token));
    return [{item,type,score,excerpt:excerptAt(bodyMatched?body:summary||body,tokens)}];
  }).sort((a,b)=>b.score-a.score||b.item.createdAt.localeCompare(a.item.createdAt)||a.item.id.localeCompare(b.item.id)):[];
  const results=matched.filter(row=>filters.type==='all'||row.type===filters.type);
  return {results,counts,total:results.length};
}

export function highlightSearchText(text:string,query:string):{text:string;match:boolean}[]{
  const tokens=words(query).sort((a,b)=>b.length-a.length);
  if(!tokens.length)return [{text,match:false}];
  const escaped=tokens.map(token=>token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const regex=new RegExp(escaped.join('|'),'giu');const parts:{text:string;match:boolean}[]=[];let last=0;
  for(const match of text.matchAll(regex)){
    const index=match.index;if(index>last)parts.push({text:text.slice(last,index),match:false});
    parts.push({text:match[0],match:true});last=index+match[0].length;
  }
  if(last<text.length)parts.push({text:text.slice(last),match:false});
  return parts.length?parts:[{text,match:false}];
}
