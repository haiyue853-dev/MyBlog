'use client';
import {useEffect,useState} from 'react';
import {Recycle,RotateCcw,Trash2,RefreshCw,LoaderCircle,BookOpen,Film,NotebookPen,Heart,ChevronLeft,ChevronRight,LockKeyhole,Globe2} from 'lucide-react';
import {api,dateLabel,errorMessage,fileUrl} from '@/lib/client';
import {managedContentType,publicationStatus} from '@/lib/content-state';
import type {TrashEntry} from '@/lib/types';
import {Modal} from './modal';

interface TrashPage {entries:TrashEntry[];total:number;hasMore:boolean;}
export function TrashCenter({onRestored,onBusyChange}:{onRestored:()=>Promise<void>;onBusyChange:(busy:boolean)=>void}){
  const [page,setPage]=useState(1);const [data,setData]=useState<TrashPage|null>(null);const [loading,setLoading]=useState(false);const [busyId,setBusyId]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('');const [removing,setRemoving]=useState<TrashEntry|null>(null);
  async function load(signal?:AbortSignal){
    setLoading(true);
    try{const result=await api<TrashPage>(`trash?page=${page}`,{signal});if(signal?.aborted)return;if(!result.entries.length&&page>1){setPage(page-1);return;}setData(result);}
    catch(error){if(!signal?.aborted)setError(errorMessage(error));}finally{if(!signal?.aborted)setLoading(false);}
  }
  useEffect(()=>{const controller=new AbortController();setError('');void load(controller.signal);return()=>controller.abort();},[page]);
  async function change(entry:TrashEntry,purge=false){
    if(busyId||loading)return;setBusyId(entry.item.id);onBusyChange(true);setError('');setNotice('');
    try{await api(`trash/${entry.item.id}`,{method:purge?'DELETE':'POST'});setRemoving(null);setNotice(purge?'内容已彻底删除，附件原件仍保留在资料柜。':`「${entry.item.title}」已恢复。`);await load();if(!purge)await onRestored();}
    catch(error){setError(errorMessage(error));}finally{setBusyId('');onBusyChange(false);}
  }
  const locked=loading||!!busyId;
  return <section className="trash-center page-reveal" aria-label="回收站">
    <div className="trash-heading"><div><p className="section-eyebrow">A LITTLE ROOM FOR SECOND CHANCES</p><h1><Recycle size={30}/>回收站<span className="heading-dot">.</span></h1><p className="trash-intro">不小心移走的故事，都在这里等你找回。</p></div><button type="button" className="button secondary" disabled={locked} onClick={()=>{setError('');void load();}}><RefreshCw size={15} className={loading?'spin':''}/>{loading?'刷新中…':'刷新'}</button></div>
    <div className="trash-summary"><span>{data?.total??'—'} 份内容</span><span><LockKeyhole size={13}/>仅站主可见</span></div>
    <p className="trash-note">恢复会保留照片、标签、留言和原来的公开范围。这里的照片也会受到保护，不会被清理掉。</p>
    {error&&!removing&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}
    {!data&&loading&&<div className="paper manager-empty"><LoaderCircle size={28} className="spin"/><p>正在整理回收站…</p></div>}
    {data&&!data.entries.length&&<div className="paper manager-empty"><Recycle size={34}/><h3>这里暂时没有内容</h3><p>移走的文章、日常和收藏，会先留在这里。</p></div>}
    {data&&data.entries.length>0&&<ul className="trash-list">{data.entries.map(entry=>{
      const item=entry.item;const type=item.kind==='video'?'video':item.kind==='collection'?'collection':managedContentType(item);const labels={collection:'收藏',daily:'日常',article:'文章',review:'观后感',video:'视频作品'};const Icon={collection:Heart,daily:NotebookPen,article:BookOpen,review:Film,video:Film}[type];const draft=publicationStatus(item)==='draft';
      return <li key={item.id} className="paper trash-entry" aria-label={`已移除：${item.title}`}>
        <div className="trash-thumbnail">{item.assetId?<img src={fileUrl(item.assetId,true)} alt="" loading="lazy"/>:<Icon size={26}/>}</div>
        <div className="trash-entry-content"><div className="trash-entry-kind"><Icon size={14}/>{labels[type]}{item.category&&<span>{item.category}</span>}<small>{draft?'草稿':item.visibility==='private'?<><LockKeyhole size={11}/>仅自己</>:<><Globe2 size={11}/>公开</>}</small></div><h2>{item.title}</h2><div className="trash-entry-meta"><span>写于 {dateLabel(item.createdAt)}</span><span>移入于 <time dateTime={entry.deletedAt}>{dateLabel(entry.deletedAt)}</time></span></div>{item.tags.length>0&&<p className="trash-entry-tags">{item.tags.map(tag=>`#${tag}`).join('　')}</p>}</div>
        <div className="trash-entry-actions"><button type="button" className="button secondary" disabled={locked} onClick={()=>void change(entry)} aria-label={`恢复「${item.title}」`}>{busyId===item.id?<LoaderCircle size={15} className="spin"/>:<RotateCcw size={15}/>}恢复</button><button type="button" className="text-button" disabled={locked} onClick={()=>{setRemoving(entry);setError('');}} aria-label={`彻底删除「${item.title}」`}><Trash2 size={14}/>彻底删除</button></div>
      </li>;
    })}</ul>}
    {data&&(page>1||data.hasMore)&&<nav className="wall-pager" aria-label="回收站翻页"><button type="button" disabled={locked||page===1} onClick={()=>setPage(page-1)}><ChevronLeft size={15}/>上一页</button><span>第 {page} 页</span><button type="button" disabled={locked||!data.hasMore} onClick={()=>setPage(page+1)}>下一页<ChevronRight size={15}/></button></nav>}
    {removing&&<Modal title="彻底删除这份内容？" className="trash-delete-dialog" closeOnBackdrop={false} onClose={()=>{if(!busyId)setRemoving(null);}}><p>确定彻底删除「{removing.item.title}」？</p><p className="trash-delete-warning">内容及关联留言、回复和点赞将无法恢复。</p><p className="muted">附件原件仍保留在资料柜。需要时，可在“布置小屋”清理未使用图片。</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={!!busyId} onClick={()=>setRemoving(null)}>先留着</button><button type="button" className="button primary" disabled={locked} onClick={()=>void change(removing,true)}>{busyId?<LoaderCircle size={15} className="spin"/>:<Trash2 size={15}/>} {busyId?'删除中…':'确认彻底删除'}</button></div></Modal>}
  </section>;
}
