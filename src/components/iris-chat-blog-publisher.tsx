'use client';
import {useEffect,useRef,useState} from 'react';
import {FilePenLine,LoaderCircle,Square} from 'lucide-react';
import {prepareIrisChatBlogWithPhotos,type IrisChatBlogSource} from '@/lib/iris-chat-blog';
import type {IrisBlogType} from '@/lib/iris-blog';
import {browserDraftStorage} from '@/lib/editor-draft';
import {readIrisBlogWorkspace,writeIrisBlogWorkspace} from '@/lib/iris-blog-workspace';
import {errorMessage} from '@/lib/client';
import type {Item,ItemImage} from '@/lib/types';
import {Modal} from './modal';
import {Editor} from './editor';
import {IrisChatPhotoPicker} from './iris-chat-photo-picker';

const storageKey='little-world-iris-chat-blog:v1';
export function IrisChatBlogPublisher({source,onDismiss,onSaved}:{source:string|IrisChatBlogSource|null;onDismiss:()=>void;onSaved?:()=>void}){
  const [candidate,setCandidate]=useState<Item|null>(null);const [editing,setEditing]=useState(false);
  const [loaded,setLoaded]=useState(false);const [retained,setRetained]=useState(true);const [error,setError]=useState('');const [saved,setSaved]=useState<Item|null>(null);
  const [generating,setGenerating]=useState(false);const controller=useRef<AbortController|null>(null);
  const [selected,setSelected]=useState<string[]>([]);const photoCache=useRef(new Map<string,ItemImage>());
  const chatSource=typeof source==='string'?{content:source,sessionId:'',photos:[]}:source;
  useEffect(()=>{setSelected([]);},[source]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{setCandidate(readIrisBlogWorkspace(browserDraftStorage(),storageKey)?.candidate||null);setLoaded(true);},[]);
  useEffect(()=>{if(loaded)setRetained(writeIrisBlogWorkspace(browserDraftStorage(),{message:'',type:candidate?.article?'article':'moment',materials:[],candidate},storageKey));},[loaded,candidate]);
  async function prepare(type:IrisBlogType){
    if(source===null||!loaded||controller.current)return;
    const aborter=new AbortController();controller.current=aborter;setGenerating(true);setError('');
    try{const draft=await prepareIrisChatBlogWithPhotos(chatSource!,type,selected,photoCache.current,aborter.signal);if(!aborter.signal.aborted){setCandidate(draft);setEditing(true);setSaved(null);onDismiss();}}
    catch(error){setError(aborter.signal.aborted?'整理已停止，原回答和上一份预览仍保留。':errorMessage(error));}
    finally{controller.current=null;setGenerating(false);}
  }
  function stored(item:Item){setCandidate(null);setSaved(item);setError('');onSaved?.();}
  return <>
    {source!==null&&<Modal title="把这条回答整理成博客" onClose={()=>{controller.current?.abort();setError('');onDismiss();}} closeOnBackdrop={false}>
      <div className="form-stack"><p>选择记录方式，Iris 会拟定标题、正文、摘要、分类和标签，然后给你预览。</p><p className="hint">你仍可修改文字和配图，点击确认后才会保存到博客。</p>
        {chatSource&&<IrisChatPhotoPicker sessionId={chatSource.sessionId} photos={chatSource.photos} selected={selected} onChange={setSelected} disabled={generating}/>}
        {candidate&&<p className="hint">这会替换上一份聊天预览；素材写作面板的内容会继续保留。</p>}
        {error&&<p className="form-error" role="alert">{error}</p>}
        {generating&&<p className="muted" role="status"><LoaderCircle size={14} className="spin"/>Iris 正在拟定标题和正文…</p>}
        <div className="form-actions">{generating?<button type="button" className="button secondary" onClick={()=>controller.current?.abort()}><Square size={14}/>停止整理</button>:<><button type="button" className="button secondary" disabled={!loaded} onClick={()=>void prepare('moment')}>日常记录</button><button type="button" className="button primary" disabled={!loaded} onClick={()=>void prepare('article')}>文章</button></>}</div>
      </div>
    </Modal>}
    {candidate&&<div className="iris-chat-blog-status"><button type="button" className="button secondary" onClick={()=>setEditing(true)}><FilePenLine size={15}/>继续预览聊天内容</button>{!retained&&<p className="hint">当前标签页无法暂存，请在离开前保存为博客草稿。</p>}</div>}
    {saved&&<p className="success" role="status">{saved.status==='draft'?'已保存草稿，可以从内容管理继续编辑。':saved.visibility==='private'?'已保存为仅自己可见。':'已发布到博客。'} {saved.status!=='draft'&&<a className="text-button" href={saved.article?`/posts/${saved.id}`:'/?view=life'}>查看{saved.article?'文章':'日常'} →</a>}</p>}
    {editing&&candidate&&<Editor key={candidate.id} kind="moment" assistantDraft={candidate} onAssistantDraftChange={setCandidate} onClose={()=>setEditing(false)} onSaved={stored}/>}
  </>;
}
