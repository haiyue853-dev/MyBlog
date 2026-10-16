import {ApiError} from './http';
import type {SiteStore} from './runtime';

// Only compare the photos the owner already selected for this record.
export async function findReusablePhoto(store:Pick<SiteStore,'getAsset'|'readAsset'>,ids:string[],mime:string,content:Buffer){
  for(const id of ids){
    const asset=await store.getAsset(id);if(!asset||!asset.mime.startsWith('image/')||asset.mime!==mime||asset.size!==content.length)continue;
    try{if(content.equals(await store.readAsset(id)))return asset;}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'||error instanceof ApiError&&error.status===404)continue;throw error;}
  }
  return null;
}
