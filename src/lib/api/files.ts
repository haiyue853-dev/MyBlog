import {getRuntimeStore as getStore} from '../runtime';
import {canReadAsset,imageMime} from '../security';
import {ApiError,isOwner,json,readBody,readJson,requireOrigin,requireOwner,validId} from '../http';
import {videoMime} from '../videos';
import {videoByteRange} from '../video-range';
import {findReusablePhoto} from '../photo-reuse';
import {MAX_DIARY_IMAGES} from '../item-images';

export const MAX_FILE_SIZE=20*1024*1024;

// 换过配图之后，旧图会留在磁盘上没人引用。站主可以扫出这批孤儿一次性清掉。
// 只删「此刻仍然没人引用」的 id —— 中途被重新引用的会自动跳过，不会误删。
async function cleanupUnused(request:Request){
  const store=getStore();const data=await readJson(request);
  const ids=Array.isArray(data.ids)?[...new Set(data.ids.map(value=>String(value)))]:[];
  const allowed=new Set((await store.listUnusedAssets()).map(asset=>asset.id));
  let removed=0;let skipped=0;
  for(const id of ids){
    if(!allowed.has(id)){skipped++;continue;}
    await store.removeAsset(id);await store.deleteAsset(id);removed++;
  }
  return json({ok:true,removed,skipped});
}

export async function filesApi(request:Request,path:string[]){const store=getStore();const id=path[1];const flags=new URL(request.url).searchParams;
  // Check write permissions before looking up a file, including missing IDs.
  if(request.method!=='GET'&&request.method!=='HEAD'){await requireOwner(request);requireOrigin(request);}
  if(request.method==='GET'&&!id){await requireOwner(request);return json({files:flags.get('unused')==='1'?await store.listUnusedAssets():await store.listAssets()});}
  if(id){const asset=(await store.getAsset(validId(id)));if(!asset)throw new ApiError(404,'文件不存在。');
    if(request.method==='DELETE'){if((await store.assetInUse(id)))throw new ApiError(409,'这个文件正在用于内容或头像，请先解除关联。');await store.removeAsset(id);await store.deleteAsset(id);return json({ok:true});}
    if(request.method==='GET'||request.method==='HEAD'){if(!canReadAsset(await isOwner(request),(await store.isPublicAsset(id))))throw new ApiError(401,'请先登录私人空间。');
      const inline=flags.get('inline')==='1'&&(asset.mime.startsWith('image/')||asset.mime.startsWith('video/'));
      if(asset.mime.startsWith('video/')){
        const headers=new Headers({'Content-Type':inline?asset.mime:'application/octet-stream','Content-Disposition':`${inline?'inline':'attachment'}; filename="download"; filename*=UTF-8''${encodeURIComponent(asset.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-cache','Accept-Ranges':'bytes','Content-Length':String(asset.size)});
        const range=request.method==='HEAD'?null:videoByteRange(request.headers.get('range'),asset.size);
        if(range===false){headers.set('Content-Range',`bytes */${asset.size}`);headers.delete('Content-Length');return new Response(null,{status:416,headers});}
        if(range){headers.set('Content-Range',`bytes ${range.start}-${range.end}/${asset.size}`);headers.set('Content-Length',String(range.end-range.start+1));}
        return new Response(request.method==='HEAD'?null:await store.streamAsset(id,range?.start,range?.end),{status:range?206:200,headers});
      }
      const body=request.method==='HEAD'?null:await store.readAsset(id);
      return new Response(body,{headers:{'Content-Type':inline?asset.mime:'application/octet-stream','Content-Disposition':`${inline?'inline':'attachment'}; filename="download"; filename*=UTF-8''${encodeURIComponent(asset.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=31536000, immutable','Content-Security-Policy':"default-src 'none'; sandbox"}});
    }
    throw new ApiError(405,'不支持这个操作。');
  }
  await requireOwner(request);requireOrigin(request);if(request.method!=='POST')throw new ApiError(405,'不支持这个操作。');
  if(flags.get('cleanup')==='1')return cleanupUnused(request);
  const isVideo=flags.get('video')==='1';const maximum=MAX_FILE_SIZE;
  const bytes=await readBody(request,maximum+1024*1024);
  let form:FormData;try{form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')||''},body:bytes}).formData();}catch{throw new ApiError(400,'请选择一个文件。');}
  const file=form.get('file');if(!(file instanceof File)||!file.size)throw new ApiError(400,'请选择非空文件。');if(file.size>maximum)throw new ApiError(413,'每个文件最多 20 MB。');
  const content=Buffer.from(await file.arrayBuffer());const detectedVideo=videoMime(content);
  if(isVideo&&!detectedVideo)throw new ApiError(400,'请选择有效的 MP4 或 WebM 视频文件。');
  const mime=imageMime(content)||detectedVideo||'application/octet-stream';
  let reuseImageIds:string[]=[];
  const candidates=form.get('reuseImageIds');
  if(candidates!==null){
    let value:unknown;try{value=JSON.parse(String(candidates));}catch{throw new ApiError(400,'已有图片编号不正确。');}
    if(!Array.isArray(value)||value.length>MAX_DIARY_IMAGES||value.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id)))throw new ApiError(400,'已有图片编号不正确。');
    reuseImageIds=[...new Set<string>(value)];
  }
  const reuseOnly=form.get('reuseOnly')==='1';
  if(reuseImageIds.length||reuseOnly){
    if(!mime.startsWith('image/'))throw new ApiError(400,'请选择有效的图片。');
    const reused=await findReusablePhoto(store,reuseImageIds,mime,content);if(reused)return json({file:reused,reused:true});
    if(reuseOnly)throw new ApiError(400,`每条记录最多 ${MAX_DIARY_IMAGES} 张照片，请先整理已选图片。`);
  }
  const name=file.name.replace(/[\x00-\x1f/\\]/g,'_').slice(0,255)||'文件';const category=String(form.get('category')||'未分类').trim().slice(0,40);
  const asset=(await store.addAsset({name,mime,size:file.size,category}));
  // 写盘失败时数据库行和磁盘文件都要收掉，否则会留下一条打不开的记录和一个没人认领的文件。
  try{await store.writeAsset(asset.id,content);}catch(error){await store.removeAsset(asset.id).catch(()=>{});await store.deleteAsset(asset.id);throw error;}
  return json({file:asset},201);
}
