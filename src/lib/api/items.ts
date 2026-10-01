import {getStore} from '../store';
import {safeExternalUrl} from '../security';
import {ApiError,isOwner,json,readJson,requireOrigin,requireOwner,text,validId} from '../http';
import type {ItemInput} from '../types';

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
  const input:ItemInput={id:request.method==='PUT'?id:undefined,kind:data.kind as ItemInput['kind'],visibility:data.visibility as ItemInput['visibility'],title:text(data.title,'标题',160,true),body:text(data.body,'内容',50000),tags:[...new Set(data.tags.map(v=>v.trim()).filter(Boolean))],category:text(data.category,'分类',40),url:safeUrl||'',assetId};
  return json({item:store.saveItem(input)},request.method==='POST'?201:200);
}
