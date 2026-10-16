import {managedContentType} from './content-state';
import {CARD_RATIOS,type ArticleConfig,type CardRatio,type Item,type ItemImage,type ItemKind,type Visibility,type PublicationStatus,type WritingType,type WatchConfig} from './types';
import {parseWatchConfig} from './watch-collection';
import {itemImages,MAX_DIARY_IMAGES} from './item-images';
import {parseArticleConfig} from './articles';
import {validCoverCrop} from './article-cover';

export interface EditorDraft {
  title:string;body:string;category:string;tags:string;url:string;
  assetId:string|null;photos:ItemImage[];visibility:Visibility;cardRatio:CardRatio;
  imageSize:{width:number;height:number}|null;
  article:ArticleConfig|null;
  articleMode:boolean;
  coverCrop?:Item['coverCrop'];
  status:PublicationStatus;pinned:boolean;writingType?:WritingType;
  watch?:WatchConfig;
}
type DraftStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function editorDraftChanged(original:EditorDraft,next:EditorDraft){
  return (Object.keys({...original,...next}) as (keyof EditorDraft)[]).some(key=>JSON.stringify(original[key])!==JSON.stringify(next[key]));
}
export function browserDraftStorage():DraftStorage|null{try{return typeof window==='undefined'?null:window.sessionStorage;}catch{return null;}}
export function editorDraftKey(kind:ItemKind,id?:string){return `little-world-editor-draft:v1:${kind}:${id||'new'}`;}
export function initialEditorDraft(kind:ItemKind,item?:Item,category=''):EditorDraft{
  return {title:item?.title||'',body:item?.body||'',category:item?.category||(kind==='moment'?'生活':category),tags:item?.tags.join('，')||'',url:item?.url||'',assetId:item?.assetId||null,photos:kind==='moment'&&item?itemImages(item):[],visibility:item?.visibility||(kind==='moment'?'public':'private'),cardRatio:item?.cardRatio||'auto',imageSize:item?.imageWidth&&item?.imageHeight?{width:item.imageWidth,height:item.imageHeight}:null,article:kind==='moment'?item?.article||null:null,articleMode:kind==='moment'&&!!item?.article,status:item?.status||'published',pinned:item?.pinned||false,writingType:item?.article?managedContentType(item) as WritingType:undefined,...(kind==='moment'&&item?.coverCrop?{coverCrop:item.coverCrop}:{}),...(item?.watch?{watch:item.watch}:{})};
}
function dimension(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>0;}
export function readEditorDraft(storage:DraftStorage|null,kind:ItemKind,id?:string):EditorDraft|null{
  try{
    const raw=storage?.getItem(editorDraftKey(kind,id));if(!raw)return null;
    const value=JSON.parse(raw);if(value?.version!==1||!value.draft)return null;
    const draft=value.draft;
    if(!['title','body','category','tags','url'].every(key=>typeof draft[key]==='string')||!(draft.assetId===null||typeof draft.assetId==='string')||!['public','private'].includes(draft.visibility)||!CARD_RATIOS.includes(draft.cardRatio))return null;
    if(!Array.isArray(draft.photos)||draft.photos.length>MAX_DIARY_IMAGES||!draft.photos.every((photo:ItemImage)=>photo&&typeof photo.assetId==='string'&&(photo.width===undefined||dimension(photo.width))&&(photo.height===undefined||dimension(photo.height))))return null;
    if(draft.imageSize!==null&&!(draft.imageSize&&dimension(draft.imageSize.width)&&dimension(draft.imageSize.height)))return null;
    const article=draft.article==null?null:parseArticleConfig(draft.article);if(draft.article!=null&&(!article||kind!=='moment'))return null;
    const articleMode=typeof draft.articleMode==='boolean'?draft.articleMode:!!article;
    if(articleMode&&!article)return null;
    if(draft.coverCrop!==undefined&&(kind!=='moment'||!validCoverCrop(draft.coverCrop)))return null;
    if(draft.status!==undefined&&!['draft','published'].includes(draft.status)||draft.pinned!==undefined&&typeof draft.pinned!=='boolean'||draft.writingType!==undefined&&!['article','review'].includes(draft.writingType))return null;
    const watch=draft.watch===undefined?undefined:parseWatchConfig(draft.watch);if(draft.watch!==undefined&&(!watch||kind!=='collection'))return null;
    return {status:draft.status||'published',pinned:draft.pinned||false,writingType:draft.writingType,title:draft.title,body:draft.body,category:draft.category,tags:draft.tags,url:draft.url,assetId:draft.assetId,photos:draft.photos,visibility:draft.visibility,cardRatio:draft.cardRatio,imageSize:draft.imageSize,article,articleMode,...(draft.coverCrop?{coverCrop:draft.coverCrop}:{}),...(watch?{watch}:{})};
  }catch{return null;}
}
export function writeEditorDraft(storage:DraftStorage|null,kind:ItemKind,id:string|undefined,draft:EditorDraft){
  if(!storage)return false;
  try{storage.setItem(editorDraftKey(kind,id),JSON.stringify({version:1,draft}));return true;}catch{return false;}
}
export function clearEditorDraft(storage:DraftStorage|null,kind:ItemKind,id?:string){
  if(!storage)return false;
  try{storage.removeItem(editorDraftKey(kind,id));return true;}catch{return false;}
}
