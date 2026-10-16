'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Settings,LoaderCircle} from 'lucide-react';
import {api,errorMessage} from '@/lib/client';
import {defaultWritingPreferences,WRITING_OPTIONS,type IrisWritingPreferences as Preferences,type IrisWritingStyle} from '@/lib/iris-writing-preferences';
import {ThemeSelect} from './theme-select';

export function IrisWritingPreferences(){
 const [draft,setDraft]=useState(defaultWritingPreferences);const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const saving=useRef(false);
 useEffect(()=>{let active=true;api<{preferences:Preferences}>('iris/blog/preferences').then(result=>{if(active){setDraft(result.preferences);setLoaded(true);}}).catch(error=>{if(active)setError(errorMessage(error));});return()=>{active=false;};},[]);
 async function reload(){if(saving.current)return;setError('');try{const result=await api<{preferences:Preferences}>('iris/blog/preferences');setDraft(result.preferences);setLoaded(true);}catch(error){setError(errorMessage(error));}}
 function change(type:'article'|'moment',field:keyof IrisWritingStyle,value:string){setDraft(current=>({...current,[type]:{...current[type],[field]:value}}));setNotice('');}
 async function save(event:FormEvent){event.preventDefault();if(!loaded||saving.current)return;saving.current=true;setBusy(true);setError('');setNotice('');try{const result=await api<{preferences:Preferences}>('iris/blog/preferences',{method:'PUT',body:JSON.stringify(draft)});setDraft(result.preferences);setNotice('写作偏好已保存，下次拟稿和改稿会使用。');}catch(error){setError(errorMessage(error));}finally{saving.current=false;setBusy(false);}}
 return <details className="paper iris-writing-preferences"><summary><Settings size={17}/><span>我的写作偏好</span><span className="muted">文章和日常分别设置</span></summary><form className="form-stack" onSubmit={save}>
  <p className="hint">保存后，素材拟稿、聊天整理成博客和预览改稿默认使用这些偏好。本次提出的具体要求优先；仍需你确认发布。</p>
  <div className="iris-writing-preference-types">{(['article','moment'] as const).map(type=>{const label=type==='article'?'文章':'日常';return <fieldset key={type} className="form-stack" disabled={!loaded||busy}><legend>{label}偏好</legend>{([['tone','语气'],['length','篇幅'],['headings','小标题'],['title','标题风格']] as const).map(([field,name])=><label key={field}>{label}{name}<ThemeSelect value={draft[type][field]} options={[...WRITING_OPTIONS[field]]} ariaLabel={`${label}${name}`} onChange={value=>change(type,field,value)} disabled={!loaded||busy}/></label>)}<label>{label}补充要求<textarea aria-label={`${label}补充要求`} value={draft[type].instructions} rows={3} maxLength={500} onChange={event=>change(type,'instructions',event.target.value)} placeholder="例如：保留我的表达，少用套话，不要夸张。"/><span className="muted">{draft[type].instructions.length} / 500 字</span></label></fieldset>;})}</div>
  {!loaded&&!error&&<p className="muted" role="status">正在读取写作偏好…</p>}{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}
  <div className="form-actions">{!loaded&&error&&<button type="button" className="button secondary" onClick={()=>void reload()}>重新读取</button>}<button className="button primary" disabled={!loaded||busy}>{busy&&<LoaderCircle size={14} className="spin"/>}{busy?'保存中…':'保存写作偏好'}</button></div>
 </form></details>;
}
