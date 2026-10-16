'use client';
import {useState,type FormEvent} from 'react';
import {Reply,Pencil,Trash2,Send,LoaderCircle} from 'lucide-react';
import {api,errorMessage} from '@/lib/client';
import type {CommentReply} from '@/lib/types';
import {Modal} from './modal';

const date=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
export function CommentReplyBlock({itemId,commentId,author,reply,owner,disabled=false,onSaved,onBusyChange}:{itemId:string;commentId:string;author:string;reply:CommentReply|null;owner:boolean;disabled?:boolean;onSaved?:(reply:CommentReply|null)=>void|Promise<void>;onBusyChange?:(busy:boolean)=>void}){
  const [editing,setEditing]=useState(false);const [body,setBody]=useState('');const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [removing,setRemoving]=useState(false);const [discarding,setDiscarding]=useState(false);
  const locked=disabled||busy;
  function begin(){setBody(reply?.body||'');setEditing(true);setError('');setNotice('');}
  function cancel(){if(body!==(reply?.body||'')){setDiscarding(true);return;}setEditing(false);setError('');}
  async function save(event:FormEvent){
    event.preventDefault();if(locked)return;setBusy(true);onBusyChange?.(true);setError('');setNotice('');
    try{const result=await api<{reply:CommentReply}>(`comments/${itemId}/${commentId}/reply`,{method:'PUT',body:JSON.stringify({body})});setEditing(false);await onSaved?.(result.reply);setNotice('回复已保存。');}
    catch(error){setError(errorMessage(error));}finally{setBusy(false);onBusyChange?.(false);}
  }
  async function remove(){
    if(locked)return;setBusy(true);onBusyChange?.(true);setError('');setNotice('');
    try{await api(`comments/${itemId}/${commentId}/reply`,{method:'DELETE'});setRemoving(false);await onSaved?.(null);setNotice('回复已删除，原留言还在。');}
    catch(error){setError(errorMessage(error));setRemoving(false);}finally{setBusy(false);onBusyChange?.(false);}
  }
  if(!reply&&!owner)return null;
  return <section className="comment-reply-area" aria-label={`${author}留言的站主回复`}>
    {reply&&<div className="comment-reply-card"><div className="comment-reply-meta"><Reply size={14}/><strong>{reply.name}</strong><span className="comment-owner-badge">站主回复</span><time dateTime={reply.createdAt}>{date.format(new Date(reply.createdAt))}</time>{reply.updatedAt!==reply.createdAt&&<small title={`修改于 ${date.format(new Date(reply.updatedAt))}`}>已编辑</small>}</div><p>{reply.body}</p></div>}
    {owner&&(!editing?<div className="comment-reply-actions">{reply?<><button type="button" disabled={locked} onClick={begin}><Pencil size={13}/>编辑回复</button><button type="button" disabled={locked} onClick={()=>{setRemoving(true);setError('');}}><Trash2 size={13}/>删除回复</button></>:<button type="button" disabled={locked} onClick={begin}><Reply size={14}/>回复留言</button>}</div>:<form className="comment-reply-form" onSubmit={save} aria-label={`${reply?'编辑':'撰写'}给${author}的回复`}><label>回复{author}的留言<textarea value={body} onChange={event=>setBody(event.target.value)} rows={3} maxLength={2000} required disabled={locked} placeholder="以站主身份，写下你的回应…" autoFocus/></label><div className="comment-reply-submit"><small>{body.length} / 2000</small><div><button type="button" className="button secondary" disabled={locked} onClick={cancel}>取消</button><button type="submit" className="button primary" disabled={locked||!body.trim()}>{busy?<LoaderCircle size={14} className="spin"/>:<Send size={14}/>} {busy?'保存中…':reply?'保存修改':'发布回复'}</button></div></div></form>)}
    {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}
    {removing&&<Modal title="删除这段回复？" onClose={()=>{if(!busy)setRemoving(false);}} closeOnBackdrop={false} className="comment-delete-dialog"><p className="comment-delete-copy">确定删除给 {author} 的回复吗？原留言会保留。</p><blockquote>{reply?.body}</blockquote><div className="comment-delete-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setRemoving(false)}>先留着</button><button type="button" className="button primary" disabled={busy} onClick={()=>void remove()}>{busy?<LoaderCircle size={14} className="spin"/>:<Trash2 size={14}/>} {busy?'删除中…':'确认删除回复'}</button></div></Modal>}
    {discarding&&<Modal title="回复还没有保存" onClose={()=>setDiscarding(false)} closeOnBackdrop={false} className="comment-delete-dialog"><p className="comment-delete-copy">刚写下的内容还没有保存，可以继续编辑，或放弃这次修改。</p><div className="comment-delete-actions"><button type="button" className="button secondary" onClick={()=>{setDiscarding(false);setEditing(false);setError('');}}>放弃修改</button><button type="button" className="button primary" onClick={()=>setDiscarding(false)}>继续编辑</button></div></Modal>}
  </section>;
}
