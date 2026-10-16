'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {LoaderCircle} from 'lucide-react';
import {api,errorMessage} from '@/lib/client';
import type {VisitorProfile} from '@/lib/types';

const SIGNATURE_EVENT='visitor-signature-changed';
export function useVisitorProfile(enabled=true){
  const [visitor,setVisitor]=useState<VisitorProfile|null>(null);
  useEffect(()=>{
    if(!enabled)return;
    const controller=new AbortController();
    async function refresh(){try{const result=await api<{visitor:VisitorProfile|null}>('visitor',{signal:controller.signal});if(!controller.signal.aborted)setVisitor(result.visitor);}catch{/* The name form can still be retried if the initial request fails. */}}
    void refresh();window.addEventListener(SIGNATURE_EVENT,refresh);
    return()=>{controller.abort();window.removeEventListener(SIGNATURE_EVENT,refresh);};
  },[enabled]);
  return {visitor,setVisitor};
}
export async function rememberVisitor(name:string){const result=await api<{visitor:VisitorProfile}>('visitor',{method:'POST',body:JSON.stringify({name})});window.dispatchEvent(new Event(SIGNATURE_EVENT));return result.visitor;}
export function VisitorNameForm({initialName='',onSaved}:{initialName?:string;onSaved:(visitor:VisitorProfile)=>void}){
  const [name,setName]=useState(initialName);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function submit(event:FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError('');try{onSaved(await rememberVisitor(name));}catch(error){setError(errorMessage(error));}finally{setBusy(false);}}
  return <form className="form-stack visitor-name-form" aria-label="访客署名" onSubmit={submit}><p>留一个昵称，评论时会用它署名。</p><label>你的昵称<input value={name} onChange={event=>setName(event.target.value)} placeholder="给自己起一个名字" maxLength={24} required autoFocus disabled={busy} autoComplete="nickname"/></label>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button primary" disabled={busy}>{busy&&<LoaderCircle size={15} className="spin"/>}{busy?'保存中…':initialName?'保存昵称':'记住昵称'}</button></div></form>;
}
