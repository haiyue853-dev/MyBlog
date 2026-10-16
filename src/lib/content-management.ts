import type {Item,PublicationStatus,Visibility} from './types';
import {visibleArticles} from './articles';
import {managedContentType,publicationStatus,isPublished} from './content-state';
export {managedContentType} from './content-state';

export interface ContentFilters {type?:'daily'|'article'|'review';query?:string;category?:string;visibility?:Visibility|'';status?:PublicationStatus|'';from?:string;to?:string;sort?:'created'|'updated';}
export function contentDay(value:string){return new Date(Date.parse(value)+8*3600000).toISOString().slice(0,10);}
export function filterManagedContent(items:Item[],filters:ContentFilters){
  const query=filters.query?.trim().toLocaleLowerCase()||'';
  return items.filter(item=>{
    if(item.kind!=='moment'||(filters.type&&managedContentType(item)!==filters.type))return false;
    const day=contentDay(item.createdAt);
    return (!query||`${item.title} ${item.category} ${item.tags.join(' ')}`.toLocaleLowerCase().includes(query))&&(!filters.category||item.category===filters.category)&&(!filters.visibility||item.visibility===filters.visibility)&&(!filters.status||publicationStatus(item)===filters.status)&&(!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to);
  }).sort((a,b)=>{const key=filters.sort==='updated'?'updatedAt':'createdAt';return b[key].localeCompare(a[key])||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id);});
}
export function homepageArticles(items:Item[],owner:boolean){return visibleArticles(items,owner).filter(isPublished).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));}
