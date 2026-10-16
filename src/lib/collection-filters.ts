import type {Item} from './types';
export const COLLECTION_CONTENT_TAGS=['小卡','电影','韩剧','国产电视剧'];
export function filterCollections(items:Item[],filters:{group:string;tag:string;query:string}){
  const query=filters.query.trim().toLowerCase();
  return items.filter(item=>(filters.group==='全部'||item.category===filters.group)
    &&(filters.tag==='全部'||item.tags.includes(filters.tag))
    &&(!query||`${item.title} ${item.body} ${item.category} ${item.tags.join(' ')}`.toLowerCase().includes(query)));
}
