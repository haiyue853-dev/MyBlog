import {writeFile,readFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {getStore} from '../store';
import {canReadAsset,imageMime} from '../security';
import {ApiError,isOwner,json,readBody,requireOrigin,requireOwner,validId} from '../http';

export const MAX_FILE_SIZE=20*1024*1024;
export async function filesApi(request:Request,path:string[]){const store=getStore();const id=path[1];
  if(request.method==='GET'&&!id){requireOwner(request);return json({files:store.listAssets()});}
  if(id){const asset=store.getAsset(validId(id));if(!asset)throw new ApiError(404,'文件不存在。');
    if(request.method==='DELETE'){requireOwner(request);requireOrigin(request);if(store.assetInUse(id))throw new ApiError(409,'这张图片正在用于记录或头像，请先解除关联。');await unlink(join(store.directory,'files',id)).catch(error=>{if(error.code!=='ENOENT')throw error;});store.deleteAsset(id);return json({ok:true});}
    if(request.method==='GET'){if(!canReadAsset(isOwner(request),store.isPublicAsset(id)))throw new ApiError(401,'请先登录私人空间。');
      const body=await readFile(join(store.directory,'files',id));const inline=new URL(request.url).searchParams.get('inline')==='1'&&asset.mime.startsWith('image/');
      return new Response(body,{headers:{'Content-Type':inline?asset.mime:'application/octet-stream','Content-Disposition':`${inline?'inline':'attachment'}; filename="download"; filename*=UTF-8''${encodeURIComponent(asset.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox"}});
    }
    throw new ApiError(405,'不支持这个操作。');
  }
  requireOwner(request);requireOrigin(request);if(request.method!=='POST')throw new ApiError(405,'不支持这个操作。');
  const bytes=await readBody(request,MAX_FILE_SIZE+1024*1024);
  let form:FormData;try{form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')||''},body:bytes}).formData();}catch{throw new ApiError(400,'请选择一个文件。');}
  const file=form.get('file');if(!(file instanceof File)||!file.size)throw new ApiError(400,'请选择非空文件。');if(file.size>MAX_FILE_SIZE)throw new ApiError(413,'每个文件最多 20 MB。');
  const content=Buffer.from(await file.arrayBuffer());const mime=imageMime(content)||'application/octet-stream';
  const name=file.name.replace(/[\x00-\x1f/\\]/g,'_').slice(0,255)||'文件';const category=String(form.get('category')||'未分类').trim().slice(0,40);
  const asset=store.addAsset({name,mime,size:file.size,category});
  try{await writeFile(join(store.directory,'files',asset.id),content,{flag:'wx'});}catch(error){store.deleteAsset(asset.id);throw error;}
  return json({file:asset},201);
}
