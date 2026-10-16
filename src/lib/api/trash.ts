import {getRuntimeStore} from '../runtime';
import {ApiError,json,requireOwner,requireOrigin,validId} from '../http';
import {TRASH_PAGE_SIZE} from '../trash-schema';

export async function trashApi(request:Request,path:string[]){
  await requireOwner(request);const store=getRuntimeStore();const id=path[1];
  if(request.method==='GET'&&!id){
    const raw=new URL(request.url).searchParams.get('page')||'1';
    if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>100000)throw new ApiError(400,'页码不正确。');
    const page=Number(raw);const [rows,total]=await Promise.all([store.listTrashedItems(page),store.trashCount()]);
    return json({entries:rows.slice(0,TRASH_PAGE_SIZE),hasMore:rows.length>TRASH_PAGE_SIZE,total,page});
  }
  requireOrigin(request);
  if(id&&request.method==='POST'){
    if(!await store.restoreItem(validId(id)))throw new ApiError(404,'这项内容已不在回收站。');
    return json({ok:true});
  }
  if(id&&request.method==='DELETE'){
    if(!await store.purgeTrashedItem(validId(id)))throw new ApiError(404,'这项内容已不在回收站。');
    return json({ok:true});
  }
  throw new ApiError(405,'不支持这个操作。');
}
