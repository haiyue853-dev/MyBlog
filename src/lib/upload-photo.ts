import {api} from './client';
import {measureImage,optimizeImage} from './image-optimize';
import type {Asset,ItemImage} from './types';

export async function uploadPhoto(file:File,reuseImageIds:string[]=[],reuseOnly=false,signal?:AbortSignal):Promise<ItemImage>{
  signal?.throwIfAborted();
  const plan=await optimizeImage(file);
  const size=plan?{width:plan.width,height:plan.height}:await measureImage(file);
  const form=new FormData();form.append('file',plan?.file??file);form.append('category','记录图片');
  form.append('reuseImageIds',JSON.stringify(reuseImageIds));if(reuseOnly)form.append('reuseOnly','1');
  signal?.throwIfAborted();
  const data=await api<{file:Asset}>('files',{method:'POST',body:form,signal});
  if(!data.file.mime.startsWith('image/'))throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片。');
  return {assetId:data.file.id,width:size?.width,height:size?.height};
}
