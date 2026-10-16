import type {Item,PublicationStatus} from './types';

export function publicationStatus(item:{status?:PublicationStatus}){return item.status||'published';}
export function isPublished(item:{status?:PublicationStatus}){return publicationStatus(item)==='published';}
export function isPublicItem(item:Pick<Item,'visibility'|'status'>){return item.visibility==='public'&&isPublished(item);}
export function itemForViewer(item:Item,owner:boolean):Item{return !owner&&item.kind==='collection'?{...item,body:''}:item;}
export function activeItemSql(alias='items'){return `NOT EXISTS(SELECT 1 FROM item_trash t WHERE t.item_id=${alias||'items'}.id)`;}
export function publicItemSql(alias=''){const prefix=alias?`${alias}.`:'';return `${activeItemSql(alias)} AND ${prefix}visibility='public' AND COALESCE(json_extract(${prefix}data,'$.status'),'published')='published'`;}
export function managedContentType(item:Pick<Item,'article'|'writingType'|'category'>):'daily'|'article'|'review'{
  if(!item.article)return 'daily';
  return item.writingType||(item.category==='观后感'||item.category==='读后感'?'review':'article');
}
