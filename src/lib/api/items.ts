import {getStore} from '../store';
import {safeExternalUrl} from '../security';
import {ApiError,isOwner,json,readJson,requireOrigin,requireOwner,text,validId} from '../http';
import type {CardRatio,ItemInput} from '../types';
import {CARD_RATIOS} from '../types';

export async function itemsApi(request:Request,path:string[]){const store=getStore();const id=path[1];
  if(request.method==='GET'){if(id){const item=store.getItem(validId(id),isOwner(request));if(!item)throw new ApiError(404,'没有找到这项内容。');return json({item});}return json({items:store.listItems(isOwner(request))});}
  requireOwner(request);requireOrigin(request);
  if(request.method==='DELETE'&&id){if(!store.deleteItem(validId(id)))throw new ApiError(404,'没有找到这项内容。');return json({ok:true});}
  if(!['POST','PUT'].includes(request.method))throw new ApiError(405,'不支持这个操作。');
  if(request.method==='PUT'&&(!id||!store.getItem(validId(id))))throw new ApiError(404,'没有找到这项内容。');
  const data=await readJson(request);
  if(!['moment','collection'].includes(String(data.kind))||!['public','private'].includes(String(data.visibility)))throw new ApiError(400,'请选择内容类型和可见范围。');
  const url=data.url?text(data.url,'链接',2000):'';const safeUrl=url?safeExternalUrl(url):'';if(url&&!safeUrl)throw new ApiError(400,'链接需要以 https:// 或 http:// 开头。');
  const assetId=data.assetId?validId(String(data.assetId)):null;if(assetId&&!store.getAsset(assetId)?.mime.startsWith('image/'))throw new ApiError(400,'请选择已上传的图片。');
  if(!Array.isArray(data.tags)||data.tags.length>10||data.tags.some(v=>typeof v!=='string'||v.length>30))throw new ApiError(400,'标签最多 10 个，每个最多 30 字。');
  // 卡片形状与原始尺寸，都是收藏馆瀑布流用的。形状不认就退回 'auto'（按原图），不报错——
  // 这是展示偏好，不该因为一个拼错的字符串就把整条保存挡下来。
  // 尺寸只参与算比例，所以只做量级约束，不做精确校验。
  const requestedRatio=String(data.cardRatio??'auto');const cardRatio=(CARD_RATIOS as readonly string[]).includes(requestedRatio)?requestedRatio as CardRatio:'auto';
  const dimension=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>0&&n<=100000?Math.round(n):undefined;};
  const imageWidth=dimension(data.imageWidth);const imageHeight=dimension(data.imageHeight);
  const input:ItemInput={id:request.method==='PUT'?id:undefined,kind:data.kind as ItemInput['kind'],visibility:data.visibility as ItemInput['visibility'],title:text(data.title,'标题',160,true),body:text(data.body,'内容',50000),tags:[...new Set(data.tags.map(v=>v.trim()).filter(Boolean))],category:text(data.category,'分类',40),url:safeUrl||'',assetId,cardRatio,imageWidth,imageHeight};
  return json({item:store.saveItem(input)},request.method==='POST'?201:200);
}
