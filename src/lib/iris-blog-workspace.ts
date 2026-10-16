import {parseArticleConfig} from './articles';
import type {Asset,Item} from './types';
import {MAX_IRIS_MATERIALS,type IrisBlogType} from './iris-blog';
type StorageAccess=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type IrisMaterial=Pick<Asset,'id'|'name'|'mime'>;
export interface IrisBlogWorkspace {message:string;type:IrisBlogType;materials:IrisMaterial[];candidate:Item|null;}
const key='little-world-iris-blog:v1';
export function readIrisBlogWorkspace(storage:StorageAccess|null,storageKey=key):IrisBlogWorkspace|null{
  try{
    const raw=storage?.getItem(storageKey);if(!raw)return null;const value=JSON.parse(raw);
    if(value.version!==1||typeof value.message!=='string'||value.message.length>10000||!['article','moment'].includes(value.type)||!Array.isArray(value.materials)||value.materials.length>MAX_IRIS_MATERIALS)return null;
    if(value.materials.some((asset:IrisMaterial)=>!asset||typeof asset.id!=='string'||!(/^[a-f0-9-]{36}$/.test(asset.id))||typeof asset.name!=='string'||typeof asset.mime!=='string'))return null;
    const candidate=value.candidate;
    if(candidate!==null){
      if(!candidate||typeof candidate.id!=='string'||!(/^[a-f0-9-]{36}$/.test(candidate.id))||candidate.kind!=='moment'||candidate.status!=='draft'||!['public','private'].includes(candidate.visibility)||typeof candidate.title!=='string'||typeof candidate.body!=='string'||candidate.body.length>50000||typeof candidate.category!=='string'||!Array.isArray(candidate.tags)||candidate.tags.some((tag:unknown)=>typeof tag!=='string')||!Array.isArray(candidate.images)||candidate.images.some((image:{assetId:string})=>!image||typeof image.assetId!=='string'||!(/^[a-f0-9-]{36}$/.test(image.assetId)))||candidate.article!==null&&!parseArticleConfig(candidate.article))return null;
    }
    return {message:value.message,type:value.type,materials:value.materials,candidate};
  }catch{return null;}
}
export function writeIrisBlogWorkspace(storage:StorageAccess|null,value:IrisBlogWorkspace,storageKey=key){
  if(!storage)return false;
  try{if(!value.message&&!value.materials.length&&!value.candidate)storage.removeItem(storageKey);else storage.setItem(storageKey,JSON.stringify({version:1,...value}));return true;}catch{return false;}
}
