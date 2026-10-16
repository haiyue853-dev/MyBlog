import type {Item,WatchConfig,WatchState,WatchType} from './types';
import {isPublicItem,itemForViewer,managedContentType} from './content-state';

export const WATCH_TYPES:WatchType[]=['韩剧','电影','国产电视剧','动漫','其他'];
export const WATCH_TAGS=['爱情','悬疑','喜剧','治愈','青春','校园','惊悚','奇幻','古装','仙侠','权谋','动作','犯罪','家庭','职场','科幻','冒险','动画'];
export function toggleWatchTag(value:string,tag:string){
  const tags=[...new Set(value.split(/[,，]/).map(value=>value.trim()).filter(Boolean))];
  return (tags.includes(tag)?tags.filter(value=>value!==tag):tags.length<10?[...tags,tag]:tags).join('，');
}
export const WATCH_STATES:{value:WatchState;label:string}[]=[{value:'planned',label:'想看'},{value:'watching',label:'在看'},{value:'completed',label:'已看'},{value:'paused',label:'搁置'},{value:'dropped',label:'弃剧'}];
export function newWatch():WatchConfig{return {type:'韩剧',state:'planned',rating:null,episodes:null,watched:0,year:'',reviewId:null};}
export function parseWatchConfig(value:unknown):WatchConfig|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const v=value as WatchConfig;
  if(!WATCH_TYPES.includes(v.type)||!WATCH_STATES.some(state=>state.value===v.state))return null;
  if(v.rating!==null&&(typeof v.rating!=='number'||!Number.isFinite(v.rating)||v.rating<0||v.rating>10))return null;
  if(v.episodes!==null&&(!Number.isInteger(v.episodes)||v.episodes<1||v.episodes>10000))return null;
  if(!Number.isInteger(v.watched)||v.watched<0||v.watched>10000||v.episodes!==null&&v.watched>v.episodes)return null;
  if(typeof v.year!=='string'||v.year!==''&&!/^\d{4}$/.test(v.year))return null;
  if(v.reviewId!==null&&(typeof v.reviewId!=='string'||!/^[a-f0-9-]{36}$/.test(v.reviewId)))return null;
  if(v.synopsis!==undefined&&(typeof v.synopsis!=='string'||v.synopsis.length>3000))return null;
  if(v.synopsisSource!==undefined){
    if(typeof v.synopsisSource!=='string'||v.synopsisSource.length>2000)return null;
    if(v.synopsisSource){try{const url=new URL(v.synopsisSource);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;}catch{return null;}}
  }
  return {type:v.type,state:v.state,rating:v.rating,episodes:v.episodes,watched:v.watched,year:v.year,reviewId:v.reviewId,...(v.synopsis!==undefined?{synopsis:v.synopsis}:{}),...(v.synopsisSource!==undefined?{synopsisSource:v.synopsisSource}:{})};
}
export function screenCollections(items:Item[],owner:boolean){return items.filter(item=>item.kind==='collection'&&item.watch&&(owner||isPublicItem(item))).map(item=>itemForViewer(item,owner));}
export function filterScreenCollections(items:Item[],filters:{type:string;state:string;query:string;tag?:string}){
  const query=filters.query.trim().toLowerCase();
  return items.filter(item=>item.watch&&(filters.type==='全部'||item.watch.type===filters.type)&&(filters.state==='全部'||item.watch.state===filters.state)&&(!filters.tag||filters.tag==='全部'||item.tags.includes(filters.tag))&&(!query||`${item.title} ${item.watch.synopsis||''} ${item.body} ${item.tags.join(' ')} ${item.watch.year}`.toLowerCase().includes(query)));
}
export function watchStatistics(items:Item[]){
  const scores=items.flatMap(item=>item.watch?.rating!=null?[item.watch.rating]:[]);
  return {total:items.length,completed:items.filter(item=>item.watch?.state==='completed').length,watching:items.filter(item=>item.watch?.state==='watching').length,planned:items.filter(item=>item.watch?.state==='planned').length,rated:scores.length,average:scores.length?Math.round(scores.reduce((sum,value)=>sum+value,0)/scores.length*10)/10:null};
}
export function watchReview(items:Item[],item:Item,owner:boolean){return items.find(review=>review.id===item.watch?.reviewId&&review.kind==='moment'&&review.article&&managedContentType(review)==='review'&&(owner||isPublicItem(review)))||null;}
export function visibleWatchLinks(items:Item[],owner:boolean){
  if(owner)return items;
  const reviews=new Set(items.filter(item=>item.article&&managedContentType(item)==='review'&&isPublicItem(item)).map(item=>item.id));
  return items.map(item=>item.watch?.reviewId&&!reviews.has(item.watch.reviewId)?{...item,watch:{...item.watch,reviewId:null}}:item);
}
export function watchStateLabel(value:WatchState){return WATCH_STATES.find(state=>state.value===value)?.label||'想看';}
