'use client';
import {useEffect,useRef,useState} from 'react';
import {FilePenLine,LoaderCircle,RotateCcw,Square} from 'lucide-react';
import {api,errorMessage} from '@/lib/client';
import {browserDraftStorage,readEditorDraft,writeEditorDraft,clearEditorDraft,type EditorDraft} from '@/lib/editor-draft';
import {applyIrisBlogRevision,revisionSource,type IrisBlogRevision as Revision} from '@/lib/iris-blog-revision';

export function IrisBlogRevision({draft,draftId,disabled,onApply,onBusyChange}:{draft:EditorDraft;draftId:string;disabled:boolean;onApply:(draft:EditorDraft)=>void;onBusyChange:(busy:boolean)=>void}){
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [previous,setPrevious]=useState(()=>readEditorDraft(browserDraftStorage(),'moment',`${draftId}:iris-before`));
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function revise(){
    if(disabled||!message.trim()||controller.current)return;
    const snapshot=structuredClone(draft);const source=revisionSource(snapshot);const aborter=new AbortController();controller.current=aborter;setBusy(true);onBusyChange(true);setError('');setNotice('');
    try{
      const result=await api<{revision:Revision}>('iris/blog/prepare',{method:'POST',body:JSON.stringify({message:message.trim(),type:source.type,assetIds:[],sourceDraft:source}),signal:aborter.signal});
      if(!aborter.signal.aborted){
        const next=applyIrisBlogRevision(snapshot,result.revision);
        const retained=writeEditorDraft(browserDraftStorage(),'moment',`${draftId}:iris-before`,snapshot);
        setPrevious(snapshot);onApply(next);setNotice(retained?'已更新预览，改稿前版本仍保留。请检查后再确认发布。':'已更新预览；改稿前版本可在本次窗口内恢复，请在关闭前保存。');
      }
    }catch(error){setError(aborter.signal.aborted?'改稿已停止，当前稿件仍保留。':errorMessage(error));}
    finally{controller.current=null;setBusy(false);onBusyChange(false);}
  }
  function restore(){
    if(disabled||busy||!previous)return;
    onApply(previous);setPrevious(null);clearEditorDraft(browserDraftStorage(),'moment',`${draftId}:iris-before`);setError('');setNotice('已恢复改稿前版本。');
  }
  return <section className="iris-blog-revision form-stack" aria-label="Iris 改稿">
    <h3>让 Iris 继续改稿</h3>
    <label>告诉 Iris 怎么改<textarea aria-label="告诉 Iris 怎么改" value={message} onChange={event=>setMessage(event.target.value)} disabled={disabled||busy} rows={2} maxLength={2000} placeholder="例如：标题自然一点，正文写得像我的碎碎念。"/></label>
    <p className="hint">根据当前稿件修改文字，保留配图和展示设置；更新预览后仍由你确认发布。</p>
    <div className="form-actions">{busy?<button type="button" className="button secondary" onClick={()=>controller.current?.abort()}><Square size={14}/>停止改稿</button>:<button type="button" className="button secondary" disabled={disabled||!message.trim()} onClick={()=>void revise()}><FilePenLine size={15}/>更新预览</button>}{previous&&<button type="button" className="text-button" disabled={disabled||busy} onClick={restore}><RotateCcw size={14}/>恢复改稿前版本</button>}</div>
    {busy&&<p className="muted" role="status"><LoaderCircle size={14} className="spin"/>Iris 正在修改当前稿件…</p>}
    {notice&&<p className="success" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
  </section>;
}
