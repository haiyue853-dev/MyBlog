import {api} from './client';
import type {IrisBlogType} from './iris-blog';
import type {Item,ItemImage} from './types';
import {isChatImage,chatImageUrl,type IrisChatAttachment} from './iris-chat-files';
import {uploadPhoto} from './upload-photo';
import {formatArticleImage} from './article-images';

export interface IrisChatBlogSource {content:string;sessionId:string;photos:IrisChatAttachment[]}
export function chatReplyPhotos(messages:{role:string;attachments?:IrisChatAttachment[]}[],index:number){
  for(let i=index-1;i>=0;i--)if(messages[i].role==='user')return (messages[i].attachments||[]).filter(photo=>isChatImage(photo)&&!photo.localFile);
  return [];
}
export function mergeIrisChatPhotos(draft:Item,photos:ItemImage[]):Item{
  if(!photos.length)return draft;
  let body=draft.body;if(draft.article)for(const photo of photos)body=formatArticleImage(body,body.length,photo.assetId,'','normal').text;
  if(body.length>50000)throw new Error('配图后正文过长，请减少文字后重试。');
  return {...draft,body,images:photos,assetId:draft.article?draft.assetId:photos[0].assetId};
}
export async function prepareIrisChatBlogWithPhotos(source:IrisChatBlogSource,type:IrisBlogType,selected:string[],cache:Map<string,ItemImage>,signal?:AbortSignal):Promise<Item>{
  const photos=selected.map(id=>source.photos.find(photo=>photo.id===id&&isChatImage(photo)));
  if(selected.length>10||new Set(selected).size!==selected.length||photos.some(photo=>!photo||!chatImageUrl(source.sessionId,photo.id)))throw new Error('请选择本条回答对应的有效图片。');
  const draft=await prepareIrisChatBlogDraft(source.content,type,signal);signal?.throwIfAborted();const imported:ItemImage[]=[];
  for(const photo of photos as IrisChatAttachment[]){
    const key=`${source.sessionId}:${photo.id}`;let image=cache.get(key);
    if(!image){
      const response=await fetch(chatImageUrl(source.sessionId,photo.id)!,{signal});
      if(!response.ok)throw new Error('聊天图片读取失败，原回答和上一份预览仍保留，请重试。');
      const file=new File([await response.blob()],photo.original_name,{type:response.headers.get('content-type')||''});signal?.throwIfAborted();
      image=await uploadPhoto(file,imported.map(photo=>photo.assetId),false,signal);cache.set(key,image);
    }
    signal?.throwIfAborted();imported.push(image);
  }
  return mergeIrisChatPhotos(draft,[...new Map(imported.map(image=>[image.assetId,image])).values()]);
}

export async function prepareIrisChatBlogDraft(content:string,type:IrisBlogType,signal?:AbortSignal):Promise<Item>{
  if(!content.trim())throw new Error('这条回答没有可预览的文字。');
  if(content.length>50000)throw new Error('这条回答超过 50000 字，请先缩短内容。');
  if(type!=='article'&&type!=='moment')throw new Error('请选择文章或日常记录。');
  const result=await api<{candidate:Item}>('iris/blog/prepare',{method:'POST',body:JSON.stringify({message:'请把这条聊天回答整理成可发布的博客稿，完整拟定标题和内容。',sourceReply:content,type,assetIds:[]}),signal});
  return result.candidate;
}
