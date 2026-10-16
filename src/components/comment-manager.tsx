'use client';
import {useEffect,useState,type MouseEvent} from 'react';
import {MessageCircle,Mail,MailOpen,RefreshCw,Trash2,ArrowRight,LoaderCircle,ChevronLeft,ChevronRight} from 'lucide-react';
import {api,errorMessage} from '@/lib/client';
import type {ManagedComment} from '@/lib/types';
import {Modal} from './modal';
import {CommentReplyBlock} from './comment-reply';

interface CommentPage {comments:ManagedComment[];hasMore:boolean;total:number;unread:number;}
const date=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
export function CommentManager({onBusyChange,onOpenComment}:{onBusyChange:(busy:boolean)=>void;onOpenComment?:(itemId:string,commentId:string)=>void}){
  const [status,setStatus]=useState<'all'|'unread'>('all');const [page,setPage]=useState(1);
  const [data,setData]=useState<CommentPage|null>(null);const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [removing,setRemoving]=useState<ManagedComment|null>(null);
  async function load(signal?:AbortSignal){
    setLoading(true);
    try{const result=await api<CommentPage>(`comments?status=${status}&page=${page}`,{signal});if(signal?.aborted)return;
      if(!result.comments.length&&page>1){setPage(page-1);return;}setData(result);
    }catch(error){if(!signal?.aborted)setError(errorMessage(error));}finally{if(!signal?.aborted)setLoading(false);}
  }
  useEffect(()=>{const controller=new AbortController();setError('');setData(null);void load(controller.signal);return()=>controller.abort();},[status,page]);
  async function changeRead(row:ManagedComment,read:boolean){await api(`comments/${row.itemId}/${row.id}`,{method:'PATCH',body:JSON.stringify({read})});}
  async function mark(row:ManagedComment){
    if(busy)return;setBusy(true);onBusyChange(true);setError('');setNotice('');
    try{await changeRead(row,row.unread);setNotice(row.unread?'已标记为已读。':'已标记为未读。');await load();}
    catch(error){setError(errorMessage(error));}finally{setBusy(false);onBusyChange(false);}
  }
  async function open(event:MouseEvent<HTMLAnchorElement>,row:ManagedComment){
    if(!onOpenComment||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();if(busy)return;setBusy(true);onBusyChange(true);setError('');
    try{if(row.unread)await changeRead(row,true);onOpenComment(row.itemId,row.id);}
    catch(error){setError(errorMessage(error));}finally{setBusy(false);onBusyChange(false);}
  }
  async function remove(){
    if(!removing||busy)return;setBusy(true);onBusyChange(true);setError('');setNotice('');
    try{await api(`comments/${removing.itemId}/${removing.id}`,{method:'DELETE'});setRemoving(null);setNotice('留言已删除。');await load();}
    catch(error){setError(errorMessage(error));setRemoving(null);}finally{setBusy(false);onBusyChange(false);}
  }
  const locked=loading||busy;
  return <section className="comment-manager" aria-label="留言管理">
    <div className="comment-manager-toolbar"><div className="comment-status-tabs" aria-label="留言筛选">{([{value:'all',label:'全部',count:data?.total},{value:'unread',label:'未读',count:data?.unread}] as const).map(filter=><button type="button" key={filter.value} aria-pressed={status===filter.value} className={status===filter.value?'selected':''} disabled={locked} onClick={()=>{setStatus(filter.value);setPage(1);setNotice('');}}>{filter.value==='all'?<MessageCircle size={15}/>:<Mail size={15}/>} {filter.label}{filter.count!==undefined&&<small>{filter.count}</small>}</button>)}</div><button type="button" className="text-button comment-manager-refresh" disabled={locked} onClick={()=>{setError('');void load();}}><RefreshCw size={14} className={loading?'spin':''}/>{loading?'刷新中…':'刷新'}</button></div>
    <p className="comment-manager-hint">新留言会留在未读里，查看原留言后会自动标记为已读。</p>
    {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}
    {!data&&loading&&<div className="paper manager-empty"><LoaderCircle size={25} className="spin"/><p>正在整理留言…</p></div>}
    {data&&!data.comments.length&&<div className="paper manager-empty"><MessageCircle size={30}/><h3>{status==='unread'?'没有未读留言了':'这里还很安静'}</h3><p>{status==='unread'?'新的问候，会在这里等你。':'文章和观后感收到的留言，会汇集在这里。'}</p></div>}
    {data&&data.comments.length>0&&<ul className="managed-comments">{data.comments.map(row=><li key={row.id} className={`paper managed-comment ${row.unread?'is-unread':''}`} aria-label={`${row.name}在${row.item.title}的留言`}>
      <div className="managed-comment-heading"><span className={`comment-avatar ${row.owner?'is-owner':''}`} aria-hidden="true">{Array.from(row.name)[0]}</span><strong>{row.name}</strong>{row.owner&&<span className="comment-owner-badge">站主</span>}{row.unread&&<span className="comment-unread-badge">未读</span>}<time dateTime={row.createdAt}>{date.format(new Date(row.createdAt))}</time></div>
      <p className="managed-comment-body">{row.body}</p>
      <div className="managed-comment-source"><span>{row.item.type==='review'?'观后感':'文章'}</span><span>{row.item.title}</span>{row.item.status==='draft'?<small>草稿</small>:row.item.visibility==='private'&&<small>仅自己</small>}</div>
      <CommentReplyBlock itemId={row.itemId} commentId={row.id} author={row.name} reply={row.reply} owner disabled={locked} onBusyChange={value=>{setBusy(value);onBusyChange(value);}} onSaved={async()=>{setError('');await load();}}/>
      <div className="managed-comment-actions"><a href={`/posts/${row.itemId}#comment-${row.id}`} onClick={event=>void open(event,row)} aria-disabled={busy}>查看原留言<ArrowRight size={14}/></a><div>{!row.owner&&<button type="button" disabled={locked} onClick={()=>void mark(row)}>{row.unread?<MailOpen size={14}/>:<Mail size={14}/>} {row.unread?'标记已读':'标记未读'}</button>}<button type="button" disabled={locked} onClick={()=>{setRemoving(row);setError('');}}><Trash2 size={14}/> 删除</button></div></div>
    </li>)}</ul>}
    {data&&(page>1||data.hasMore)&&<nav className="wall-pager" aria-label="留言管理翻页"><button type="button" disabled={locked||page===1} onClick={()=>setPage(page-1)}><ChevronLeft size={15}/>上一页</button><span>第 {page} 页</span><button type="button" disabled={locked||!data.hasMore} onClick={()=>setPage(page+1)}>下一页<ChevronRight size={15}/></button></nav>}
    {removing&&<Modal title="删除这条留言？" onClose={()=>{if(!busy)setRemoving(null);}} closeOnBackdrop={false} className="comment-delete-dialog"><p className="comment-delete-copy">删除后无法恢复，确定要移除 {removing.name} 的这条留言吗？{removing.reply&&'关联的站主回复也会一起删除。'}</p><blockquote>{removing.body}</blockquote><div className="comment-delete-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setRemoving(null)}>先留着</button><button type="button" className="button primary" disabled={busy} onClick={()=>void remove()}>{busy?<LoaderCircle size={15} className="spin"/>:<Trash2 size={15}/>} {busy?'删除中…':'确认删除'}</button></div></Modal>}
  </section>;
}
