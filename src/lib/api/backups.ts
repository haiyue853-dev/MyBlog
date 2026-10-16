import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {ApiError,json,requireOrigin,requireOwner,validId} from '../http';
import {backupArchivePath,backupFilename,createBackup,listBackups} from '../backups';
import type {Store} from '../store';

export async function backupsApi(request:Request,path:string[],store:Store){
  await requireOwner(request);
  if(path.length>2)throw new ApiError(404,'没有找到这份备份。');
  const id=path[1];
  if(id){
    if(request.method!=='GET')throw new ApiError(405,'不支持这个操作。');
    validId(id);
    const info=(await listBackups(store)).find(backup=>backup.id===id);
    if(!info)throw new ApiError(404,'没有找到这份备份。');
    const stream=Readable.toWeb(createReadStream(backupArchivePath(store,id))) as ReadableStream<Uint8Array>;
    return new Response(stream,{headers:{
      'Content-Type':'application/gzip',
      'Content-Disposition':`attachment; filename="${backupFilename(info)}"`,
      'Content-Length':String(info.size),
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; sandbox",
    }});
  }
  if(request.method==='GET')return json({backups:await listBackups(store)});
  if(request.method==='POST'){
    requireOrigin(request);
    return json({backup:await createBackup(store)},201);
  }
  throw new ApiError(405,'不支持这个操作。');
}
