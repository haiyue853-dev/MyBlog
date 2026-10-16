import {managedContentType} from '../content-state';
import {getRuntimeStore as getStore} from '../runtime';
import {safeExternalUrl} from '../security';
import {ApiError,isOwner,json,readJson,requireOrigin,requireOwner,text,validId} from '../http';
import type {CardRatio,ItemImage,ItemInput,VideoConfig} from '../types';
import {CARD_RATIOS} from '../types';
import {MAX_DIARY_IMAGES} from '../item-images';
import {parseArticleConfig} from '../articles';
import {parseWatchConfig} from '../watch-collection';
import {validCoverCrop} from '../article-cover';

export async function itemsApi(request:Request,path:string[]){const store=getStore();const id=path[1];
  if(request.method==='GET'){
    const owner=await isOwner(request);
    async function visibleLink(item:import('../types').Item){
      if(!owner&&item.watch?.reviewId&&!await store.getItem(item.watch.reviewId,false))return {...item,watch:{...item.watch,reviewId:null}};
      return item;
    }
    if(id){const item=await store.getItem(validId(id),owner);if(!item)throw new ApiError(404,'没有找到这项内容。');return json({item:await visibleLink(item)});}
    return json({items:await Promise.all((await store.listItems(owner)).map(visibleLink))});
  }
  await requireOwner(request);requireOrigin(request);
  if(request.method==='DELETE'&&id){if(!(await store.trashItem(validId(id))))throw new ApiError(404,'没有找到这项内容。');return json({ok:true});}
  if(!['POST','PUT','PATCH'].includes(request.method))throw new ApiError(405,'不支持这个操作。');
  const existing=['PUT','PATCH'].includes(request.method)&&id?await store.getItem(validId(id)):null;
  if(['PUT','PATCH'].includes(request.method)&&!existing)throw new ApiError(404,'没有找到这项内容。');
  let data=await readJson(request);
  if(request.method==='PATCH'){
    if(!existing||existing.kind!=='moment')throw new ApiError(400,'这里只能管理日常、文章和观后感。');
    const keys=Object.keys(data);if(!keys.length||keys.some(key=>!['category','visibility','status','pinned'].includes(key)))throw new ApiError(400,'管理操作的字段不正确。');
    data={...existing,...data};
  }
  let createId:string|undefined;
  if(request.method==='POST'&&data.clientRequestId!==undefined){
    if(typeof data.clientRequestId!=='string'||!/^[a-f0-9-]{36}$/.test(data.clientRequestId))throw new ApiError(400,'创建请求编号不正确。');
    createId=data.clientRequestId;
  }
  if(!['moment','collection','video'].includes(data.kind as string)||!['public','private'].includes(data.visibility as string))throw new ApiError(400,'请选择内容类型和可见范围。');
  let video:VideoConfig|null=existing?.video??null;
  if(data.video!==undefined){
    if(data.video===null)video=null;
    else{
      const value=data.video as VideoConfig;
      if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.assetId!=='string'||!/^[a-f0-9-]{36}$/.test(value.assetId))throw new ApiError(400,'请选择已上传的视频。');
      const asset=await store.getAsset(value.assetId);if(!asset||!['video/mp4','video/webm'].includes(asset.mime))throw new ApiError(400,'请选择已上传的 MP4 或 WebM 视频。');
      for(const [key,max] of [['duration',86400],['width',100000],['height',100000]] as const)if(value[key]!==undefined&&(typeof value[key]!=='number'||!Number.isFinite(value[key])||value[key]!<=0||value[key]!>max))throw new ApiError(400,'视频时长或尺寸不正确。');
      video={assetId:value.assetId,duration:value.duration,width:value.width,height:value.height};
    }
  }
  if((data.kind==='video'&&!video)||(data.kind!=='video'&&video))throw new ApiError(400,'视频作品需要关联视频文件。');
  if(data.kind==='video'&&(data.pinned===true||data.writingType!==undefined))throw new ApiError(400,'视频作品不使用文章设置。');
  const article=data.article===undefined?existing?.article??null:data.article===null?null:parseArticleConfig(data.article);
  const watch=data.watch===undefined?existing?.watch:data.watch===null?undefined:parseWatchConfig(data.watch);
  if(data.watch!==undefined&&data.watch!==null&&!watch||watch&&data.kind!=='collection')throw new ApiError(400,'影视记录不正确，请检查类型、观看状态、评分和集数。');
  // Older clients and cached drafts have no synopsis fields. Omission preserves
  // the saved introduction; an explicit empty string still clears it.
  if(watch&&existing?.watch){
    if(watch.synopsis===undefined&&existing.watch.synopsis!==undefined)watch.synopsis=existing.watch.synopsis;
    if(watch.synopsisSource===undefined&&existing.watch.synopsisSource!==undefined)watch.synopsisSource=existing.watch.synopsisSource;
  }
  if(watch?.reviewId){
    const review=await store.getItem(watch.reviewId);
    if(!review&&existing?.watch?.reviewId===watch.reviewId)watch.reviewId=null;
    else if(!review||!review.article||managedContentType(review)!=='review')throw new ApiError(400,'请关联一篇已有的观后感。');
  }
  if((data.article!==undefined&&data.article!==null&&!article)||(article&&data.kind!=='moment'))throw new ApiError(400,'文章配置不正确，请检查摘要、封面和作品资料。');
  const status=data.status===undefined?existing?.status||'published':data.status;
  if(status!=='draft'&&status!=='published')throw new ApiError(400,'请选择草稿或已发布。');
  if(data.pinned!==undefined&&typeof data.pinned!=='boolean')throw new ApiError(400,'置顶设置不正确。');
  if(data.writingType!==undefined&&data.writingType!=='article'&&data.writingType!=='review')throw new ApiError(400,'请选择文章或观后感。');
  if(data.kind==='collection'&&(status==='draft'||data.pinned===true||data.writingType!==undefined))throw new ApiError(400,'收藏馆不使用文章管理设置。');
  if(data.pinned===true&&!article)throw new ApiError(400,'只有文章和观后感可以首页置顶。');
  const pinned=!!article&&status==='published'&&(data.pinned===undefined?existing?.pinned||false:data.pinned);
  const writingType=article?(data.writingType|| (existing?.article?managedContentType(existing):data.category==='观后感'||data.category==='读后感'?'review':'article')):undefined;
  const url=data.url?text(data.url,'链接',2000):'';const safeUrl=url?safeExternalUrl(url):'';if(url&&!safeUrl)throw new ApiError(400,'链接需要以 https:// 或 http:// 开头。');
  const dimension=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>0&&n<=100000?Math.round(n):undefined;};
  let assetId=data.assetId?validId(String(data.assetId)):null;
  let images:ItemImage[]|undefined;
  if(data.images!==undefined){
    if(!Array.isArray(data.images)||data.images.length>MAX_DIARY_IMAGES)throw new ApiError(400,`每条记录最多 ${MAX_DIARY_IMAGES} 张照片。`);
    const seen=new Set<string>();images=[];
    for(const entry of data.images){
      if(!entry||typeof entry!=='object'||Array.isArray(entry)||typeof entry.assetId!=='string'||!/^[a-f0-9-]{36}$/.test(entry.assetId))throw new ApiError(400,'请选择已上传的图片。');
      if(seen.has(entry.assetId))throw new ApiError(400,'同一张照片只能添加一次。');
      if(!(await store.getAsset(entry.assetId))?.mime.startsWith('image/'))throw new ApiError(400,'请选择已上传的图片。');
      seen.add(entry.assetId);images.push({assetId:entry.assetId,width:dimension(entry.width),height:dimension(entry.height)});
    }
    if(assetId&&!seen.has(assetId))throw new ApiError(400,'封面需要从这条记录的照片中选择。');
    if(!(article&&data.assetId===null))assetId=assetId||images[0]?.assetId||null;
  }else if(assetId&&!(await store.getAsset(assetId))?.mime.startsWith('image/'))throw new ApiError(400,'请选择已上传的图片。');
  if(data.coverCrop!==undefined&&data.coverCrop!==null&&(!validCoverCrop(data.coverCrop)||data.kind!=='moment'))throw new ApiError(400,'封面取景不正确，请检查位置和缩放。');
  const coverCrop=assetId&&data.kind==='moment'?(data.coverCrop===undefined?(existing?.assetId===assetId?existing.coverCrop:undefined):data.coverCrop??undefined):undefined;
  if(!Array.isArray(data.tags)||data.tags.length>10||data.tags.some(v=>typeof v!=='string'||v.length>30))throw new ApiError(400,'标签最多 10 个，每个最多 30 字。');
  // 卡片形状与原始尺寸，都是收藏馆瀑布流用的。形状不认就退回 'auto'（按原图），不报错——
  // 这是展示偏好，不该因为一个拼错的字符串就把整条保存挡下来。
  // 尺寸只参与算比例，所以只做量级约束，不做精确校验。
  const requestedRatio=String(data.cardRatio??'auto');const cardRatio=(CARD_RATIOS as readonly string[]).includes(requestedRatio)?requestedRatio as CardRatio:'auto';
  const cover=images?.find(image=>image.assetId===assetId);
  const imageWidth=images!==undefined?cover?.width:dimension(data.imageWidth);const imageHeight=images!==undefined?cover?.height:dimension(data.imageHeight);
  // Body whitespace is formatting, including the first paragraph's indentation.
  const body=data.body;if(typeof body!=='string'||body.length>50000)throw new ApiError(400,'内容格式不正确或超过 50000 字。');
  const input:ItemInput={id:['PUT','PATCH'].includes(request.method)?id:createId,kind:data.kind as ItemInput['kind'],visibility:data.visibility as ItemInput['visibility'],title:text(data.title,'标题',160,true),body,tags:[...new Set(data.tags.map(v=>v.trim()).filter(Boolean))],category:watch?.type||text(data.category,'分类',40),url:safeUrl||'',assetId,images,coverCrop,cardRatio,imageWidth,imageHeight,article,video:video||undefined,watch:watch||undefined,status:status as ItemInput['status'],pinned,writingType:writingType as ItemInput['writingType']};
  if(createId){
    if(await store.getTrashedItem(createId))throw new ApiError(409,'这项内容已在回收站，请先恢复。');
    const previous=await store.getItem(createId);
    if(previous){
      if(previous.kind!==input.kind||previous.assetId!==input.assetId||previous.video?.assetId!==input.video?.assetId)throw new ApiError(409,'创建请求编号已用于其他记录。');
      return json({item:previous},201);
    }
  }
  return json({item:(await store.saveItem(input))},request.method==='POST'?201:200);
}
