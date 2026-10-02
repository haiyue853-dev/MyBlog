import {getRuntimeStore as getStore} from '../runtime';
import {canReadAsset,imageMime} from '../security';
import {ApiError,isOwner,json,readBody,readJson,requireOrigin,requireOwner,validId} from '../http';

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
  if(request.method==='GET'&&!id){await requireOwner(request);return json({files:flags.get('unused')==='1'?await store.listUnusedAssets():await store.listAssets()});}
  if(id){const asset=(await store.getAsset(validId(id)));if(!asset)throw new ApiError(404,'文件不存在。');
    if(request.method==='DELETE'){await requireOwner(request);requireOrigin(request);if((await store.assetInUse(id)))throw new ApiError(409,'这张图片正在用于记录或头像，请先解除关联。');await store.removeAsset(id);await store.deleteAsset(id);return json({ok:true});}
    if(request.method==='GET'){if(!canReadAsset(await isOwner(request),(await store.isPublicAsset(id))))throw new ApiError(401,'请先登录私人空间。');
      const body=await store.readAsset(id);const inline=new URL(request.url).searchParams.get('inline')==='1'&&asset.mime.startsWith('image/');
      return new Response(body,{headers:{'Content-Type':inline?asset.mime:'application/octet-stream','Content-Disposition':`${inline?'inline':'attachment'}; filename="download"; filename*=UTF-8''${encodeURIComponent(asset.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=31536000, immutable','Content-Security-Policy':"default-src 'none'; sandbox"}});
    }
    throw new ApiError(405,'不支持这个操作。');
  }
  await requireOwner(request);requireOrigin(request);if(request.method!=='POST')throw new ApiError(405,'不支持这个操作。');
  if(flags.get('cleanup')==='1')return cleanupUnused(request);
  const bytes=await readBody(request,MAX_FILE_SIZE+1024*1024);
  let form:FormData;try{form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')||''},body:bytes}).formData();}catch{throw new ApiError(400,'请选择一个文件。');}
  const file=form.get('file');if(!(file instanceof File)||!file.size)throw new ApiError(400,'请选择非空文件。');if(file.size>MAX_FILE_SIZE)throw new ApiError(413,'每个文件最多 20 MB。');
  const content=Buffer.from(await file.arrayBuffer());const mime=imageMime(content)||'application/octet-stream';
  const name=file.name.replace(/[\x00-\x1f/\\]/g,'_').slice(0,255)||'文件';const category=String(form.get('category')||'未分类').trim().slice(0,40);
  const asset=(await store.addAsset({name,mime,size:file.size,category}));
  // 写盘失败时数据库行和磁盘文件都要收掉，否则会留下一条打不开的记录和一个没人认领的文件。
  try{await store.writeAsset(asset.id,content);}catch(error){await store.removeAsset(asset.id).catch(()=>{});await store.deleteAsset(asset.id);throw error;}
  return json({file:asset},201);
}
