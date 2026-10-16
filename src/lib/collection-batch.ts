import {errorMessage} from './client';
import type {ItemImage,ItemInput} from './types';

export const MAX_COLLECTION_BATCH=12;
export interface CollectionBatchEntry {
  key:string;title:string;file:File;previewUrl:string;uploaded?:ItemImage;
  state:'ready'|'uploading'|'saved'|'failed';error?:string;
}

export async function saveCollectionBatch(entries:CollectionBatchEntry[],defaults:Pick<ItemInput,'category'|'tags'|'visibility'>,operations:{
  upload:(file:File)=>Promise<ItemImage>;save:(input:ItemInput&{clientRequestId:string})=>Promise<unknown>;onUpdate:(entry:CollectionBatchEntry)=>void;
}){
  const results:CollectionBatchEntry[]=[];let created=0;
  for(const source of entries){
    if(source.state==='saved'){results.push(source);continue;}
    let entry:CollectionBatchEntry={...source,state:'uploading',error:undefined};operations.onUpdate(entry);
    try{
      if(!entry.uploaded){entry={...entry,uploaded:await operations.upload(entry.file)};operations.onUpdate(entry);}
      const photo=entry.uploaded!;
      await operations.save({...defaults,clientRequestId:entry.key,kind:'collection',title:entry.title.trim()||'收藏照片',body:'',url:'',assetId:photo.assetId,cardRatio:'auto',imageWidth:photo.width,imageHeight:photo.height});
      entry={...entry,state:'saved'};created++;
    }catch(error){entry={...entry,state:'failed',error:errorMessage(error)};}
    results.push(entry);operations.onUpdate(entry);
  }
  return {entries:results,created,saved:results.filter(entry=>entry.state==='saved').length,failed:results.filter(entry=>entry.state==='failed').length};
}
