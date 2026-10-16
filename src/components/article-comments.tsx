'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {MessageCircle,Send,UserRound,LoaderCircle,Trash2} from 'lucide-react';
import {api,errorMessage} from '@/lib/client';
import {isPublicItem} from '@/lib/content-state';
import type {Item,ArticleComment} from '@/lib/types';
import {Modal} from './modal';
import {CommentReplyBlock} from './comment-reply';
import {rememberVisitor,useVisitorProfile,VisitorNameForm} from './visitor-signature';

const commentDate=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
export function ArticleComments({item,owner}:{item:Item;owner:boolean}){
  const {visitor,setVisitor}=useVisitorProfile(!owner);const [rows,setRows]=useState<ArticleComment[]>([]);const [page,setPage]=useState(1);const [more,setMore]=useState(false);const [loaded,setLoaded]=useState(false);const [loading,setLoading]=useState(false);
  const [body,setBody]=useState('');const [name,setName]=useState('');const [signing,setSigning]=useState(false);const [busy,setBusy]=useState(false);const [removing,setRemoving]=useState<string|null>(null);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const canPost=isPublicItem(item);const [focusId,setFocusId]=useState('');const [earlier,setEarlier]=useState(false);
  async function load(next=1,signal?:AbortSignal,focus=''){
    setLoading(true);
    try{const result=await api<{comments:ArticleComment[];hasMore:boolean;page:number}>(`comments/${item.id}?page=${next}${focus?`&focus=${encodeURIComponent(focus)}`:''}`,{signal});if(signal?.aborted)return;setRows(current=>next===1?result.comments:[...current,...result.comments.filter(row=>!current.some(existing=>existing.id===row.id))]);setPage(result.page);setMore(result.hasMore);setLoaded(true);if(next===1)setEarlier(result.page>1);if(focus)setFocusId(focus);}
    catch(error){if(!signal?.aborted)setError(errorMessage(error));}finally{if(!signal?.aborted)setLoading(false);}
  }
  useEffect(()=>{
    setRows([]);setLoaded(false);setError('');setNotice('');setFocusId('');setEarlier(false);let controller=new AbortController();
    function fromHash(initial=false){const focus=location.hash.startsWith('#comment-')?location.hash.slice(9):'';if(!initial&&!focus)return;controller.abort();controller=new AbortController();void load(1,controller.signal,focus);}
    const hash=()=>fromHash();fromHash(true);window.addEventListener('hashchange',hash);window.addEventListener('popstate',hash);
    return()=>{controller.abort();window.removeEventListener('hashchange',hash);window.removeEventListener('popstate',hash);};
  },[item.id,item.visibility,item.status]);
  useEffect(()=>{
    if(!focusId)return;const target=document.getElementById(`comment-${focusId}`);if(!target)return;
    const offset=(document.querySelector('.site-header')?.getBoundingClientRect().height||96)+24;
    target.style.setProperty('--comment-anchor-offset',`${offset}px`);
    const frame=requestAnimationFrame(()=>{target.scrollIntoView({block:'start',behavior:'instant'});target.focus({preventScroll:true});setFocusId('');});
    return()=>cancelAnimationFrame(frame);
  },[focusId,rows]);
  async function submit(event:FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
    try{if(!owner&&!visitor)setVisitor(await rememberVisitor(name));const result=await api<{comment:ArticleComment}>(`comments/${item.id}`,{method:'POST',body:JSON.stringify({body})});setRows(current=>[result.comment,...current.filter(row=>row.id!==result.comment.id)]);setBody('');setLoaded(true);setNotice('留言已送达。');}
    catch(error){setError(errorMessage(error));}finally{setBusy(false);}
  }
  async function remove(id:string){if(busy)return;setBusy(true);setError('');setNotice('');try{await api(`comments/${item.id}/${id}`,{method:'DELETE'});setRows(current=>current.filter(row=>row.id!==id));setRemoving(null);setNotice('留言已删除。');await load();}catch(error){setError(errorMessage(error));}finally{setBusy(false);}}
  return <section className="paper article-comments" aria-label="文章评论区"><header className="comments-heading"><div><MessageCircle size={20}/><h2>聊聊这篇文章</h2></div><span>{rows.length}{more?'+':''} 条留言</span></header>
    {canPost?<form className="comment-composer" onSubmit={submit} aria-label="发表留言">{owner?<p className="comment-signature"><UserRound size={15}/>以站主身份留言</p>:visitor?<div className="comment-signature"><UserRound size={15}/><span>{visitor.name}</span><button type="button" className="text-button" disabled={busy} onClick={()=>setSigning(true)}>改个昵称</button></div>:<label className="comment-name">你的昵称<input value={name} onChange={event=>setName(event.target.value)} maxLength={24} required autoComplete="nickname" placeholder="给自己起一个名字" disabled={busy}/></label>}<label>你的留言<textarea value={body} onChange={event=>setBody(event.target.value)} maxLength={2000} required rows={4} placeholder="留一句喜欢，或聊聊读完后的感受…" disabled={busy}/></label><div className="comment-submit"><span>{body.length} / 2000</span><button className="button primary" disabled={busy}>{busy?<LoaderCircle size={15} className="spin"/>:<Send size={15}/>} {busy?'发送中…':'发表留言'}</button></div></form>:<p className="comments-private">公开发布后，访客就可以来这里留言。</p>}
    {error&&<div className="comments-error" role="alert"><p className="form-error">{error}</p>{!loaded&&<button type="button" className="text-button" disabled={loading} onClick={()=>{setError('');void load();}}>重新加载留言</button>}</div>}{notice&&<p className="success" role="status">{notice}</p>}
    {!loaded&&loading&&<p className="comments-loading"><LoaderCircle size={15} className="spin"/>正在翻开留言…</p>}{loaded&&!rows.length&&<p className="comments-empty">这里还很安静，留下一句想说的话吧。</p>}
    {earlier&&<button type="button" className="text-button comments-latest" disabled={loading||busy} onClick={()=>{history.replaceState(null,'',location.pathname+location.search);setError('');void load();}}>查看最新留言</button>}
    {rows.length>0&&<ul className="comments-list">{rows.map(row=><li key={row.id} id={`comment-${row.id}`} tabIndex={-1} aria-label={`${row.name}的留言`}><span className={`comment-avatar ${row.owner?'is-owner':''}`} aria-hidden="true">{Array.from(row.name)[0]}</span><div className="comment-copy"><div className="comment-meta"><strong>{row.name}</strong>{row.owner&&<span className="comment-owner-badge">站主</span>}<time dateTime={row.createdAt}>{commentDate.format(new Date(row.createdAt))}</time></div><p className="comment-body">{row.body}</p><CommentReplyBlock itemId={item.id} commentId={row.id} author={row.name} reply={row.reply} owner={owner} disabled={busy||loading} onBusyChange={setBusy} onSaved={reply=>setRows(current=>current.map(comment=>comment.id===row.id?{...comment,reply}:comment))}/>{row.canDelete&&<div className="comment-actions">{removing===row.id?<><span>删除这条留言{row.reply?'及站主回复':''}？</span><button type="button" className="text-button" disabled={busy} onClick={()=>void remove(row.id)}>确认删除</button><button type="button" className="text-button" disabled={busy} onClick={()=>setRemoving(null)}>取消</button></>:<button type="button" className="text-button" disabled={busy} onClick={()=>setRemoving(row.id)} aria-label={`删除${row.name}的留言`}><Trash2 size={12}/>删除</button>}</div>}</div></li>)}</ul>}
    {more&&<button type="button" className="button secondary comments-more" disabled={loading||busy} onClick={()=>void load(page+1)}>{loading?'正在翻开…':'看看更早的留言'}</button>}
    {signing&&<Modal title="修改昵称" onClose={()=>setSigning(false)} closeOnBackdrop={false}><VisitorNameForm initialName={visitor?.name} onSaved={value=>{setVisitor(value);setSigning(false);}}/></Modal>}
  </section>;
}
