import {getRuntimeStore} from '../runtime';
import {ApiError,isOwner,json,readJson,requireOrigin,text,validId} from '../http';
import {loginClient} from '../security';
import {visitorHash,visitorToken} from '../visitor';
import {isPublicItem} from '../content-state';
import {COMMENT_PAGE_SIZE} from '../comments-schema';
import type {ArticleComment,StoredComment} from '../types';
export async function commentsApi(request:Request,path:string[]){
  const store=getRuntimeStore();const owner=await isOwner(request);
  if((path.length===1||path.length===4||request.method==='PATCH')&&!owner)throw new ApiError(401,'请先登录私人空间。');
  if(path.length===4&&path[3]!=='reply')throw new ApiError(404,'没有找到这项操作。');
  async function withReplies<T extends {id:string}>(rows:T[]){const replies=await store.listCommentReplies(rows.map(row=>row.id));const byId=new Map(replies.map(reply=>[reply.commentId,reply]));return rows.map(row=>({...row,reply:byId.get(row.id)||null}));}
  const params=new URL(request.url).searchParams;
  function requestedPage(){const page=Number(params.get('page')||1);if(!Number.isInteger(page)||page<1||page>10000)throw new ApiError(400,'留言页码不正确。');return page;}
  if(path.length===1){
    if(request.method!=='GET')throw new ApiError(405,'不支持这个操作。');
    const status=params.get('status')||'all';if(!['all','unread'].includes(status))throw new ApiError(400,'留言筛选不正确。');
    const rows=await store.listManagedComments(status==='unread',requestedPage());const counts=await store.managedCommentCounts();
    return json({comments:await withReplies(rows.slice(0,COMMENT_PAGE_SIZE)),hasMore:rows.length>COMMENT_PAGE_SIZE,...counts});
  }
  const itemId=validId(path[1]||'');
  const item=await store.getItem(itemId,owner);
  if(!item||item.kind!=='moment'||!item.article)throw new ApiError(404,'没有找到这篇文章。');
  const token=visitorToken(request);const visitor=token?visitorHash(token):'';
  function publicComment(row:StoredComment):ArticleComment{const {visitor:author,...comment}=row;return {...comment,canDelete:owner||!!visitor&&author===visitor,reply:null};}
  if(request.method==='GET'&&path.length===2){
    let page=requestedPage();const focus=params.get('focus');
    if(focus){const located=await store.commentPage(itemId,validId(focus));if(!located)throw new ApiError(404,'这条留言已经不在了。');page=located;}
    const rows=await store.listComments(itemId,page);
    return json({comments:await withReplies(rows.slice(0,COMMENT_PAGE_SIZE).map(publicComment)),hasMore:rows.length>COMMENT_PAGE_SIZE,page});
  }
  requireOrigin(request);
  if(path.length===4){
    const id=validId(path[2]);if(!await store.getComment(itemId,id))throw new ApiError(404,'这条留言已经不在了。');
    if(request.method==='PUT'){
      const data=await readJson(request,12000);if(Object.keys(data).some(key=>key!=='body'))throw new ApiError(400,'回复格式不正确。');
      const body=text(data.body,'回复',2000,true);const profile=await store.getProfile();
      const reply=await store.saveCommentReply(itemId,id,profile.aboutName||profile.name,body);
      if(!reply)throw new ApiError(404,'这条留言已经不在了。');
      await store.markCommentRead(itemId,id,true);return json({reply});
    }
    if(request.method==='DELETE'){await store.deleteCommentReply(itemId,id);return json({ok:true});}
    throw new ApiError(405,'不支持这个操作。');
  }
  if(request.method==='PATCH'&&path.length===3){
    const id=validId(path[2]);if(!await store.getComment(itemId,id))throw new ApiError(404,'这条留言已经不在了。');
    const data=await readJson(request,1000);if(typeof data.read!=='boolean'||Object.keys(data).some(key=>key!=='read'))throw new ApiError(400,'留言标记不正确。');
    await store.markCommentRead(itemId,id,data.read);return json({ok:true});
  }
  if(request.method==='POST'&&path.length===2){
    if(!isPublicItem(item))throw new ApiError(400,'文章公开发布后才可以留言。');
    const guest=visitor?await store.getVisitor(visitor):null;
    if(!owner&&!guest)throw new ApiError(401,'先留一个昵称，再写下你的留言吧。');
    const data=await readJson(request,12000);
    if(Object.keys(data).some(key=>key!=='body'))throw new ApiError(400,'留言格式不正确。');
    const body=text(data.body,'留言',2000,true);
    if(!owner&&!await store.takeCommentAttempt(loginClient(request),'comment'))throw new ApiError(429,'留言太快了，稍等一分钟再试吧。');
    const profile=owner?await store.getProfile():null;
    const name=profile?profile.aboutName||profile.name:guest!.name;
    const row=await store.addComment({itemId,visitor:owner?'owner':visitor,name,body,owner});
    if(!row)throw new ApiError(404,'这篇文章暂时无法留言。');
    return json({comment:publicComment(row)},201);
  }
  if(request.method==='DELETE'&&path.length===3){
    const id=validId(path[2]);const row=await store.getComment(itemId,id);
    if(!row)throw new ApiError(404,'这条留言已经不在了。');
    if(!owner&&(!visitor||row.visitor!==visitor))throw new ApiError(403,'只能删除自己的留言。');
    await store.deleteComment(itemId,id);return json({ok:true});
  }
  throw new ApiError(405,'不支持这个操作。');
}
