'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {api,errorMessage} from '@/lib/client';
import type {SiteStatistics} from '@/lib/types';
import {ensureVisitor} from '@/lib/visitor-client';

const publicViews=['home','life','collection','about','stats'];
export function useSiteStatistics(view:string){
  const [stats,setStats]=useState<SiteStatistics|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  const visit=useRef<{view:string;eventId:string}|null>(null);const revision=useRef(0);
  const refresh=useCallback(async()=>{
    const current=++revision.current;setLoading(true);
    try{const data=await api<{stats:SiteStatistics}>('stats');if(current===revision.current){setStats(data.stats);setError('');}}
    catch(error){if(current===revision.current)setError(errorMessage(error));}
    finally{if(current===revision.current)setLoading(false);}
  },[]);
  useEffect(()=>{
    if(!publicViews.includes(view)){visit.current=null;return;}
    if(visit.current?.view!==view)visit.current={view,eventId:crypto.randomUUID()};
    const eventId=visit.current.eventId;const controller=new AbortController();const current=++revision.current;setLoading(true);
    async function record(){
      try{
        await ensureVisitor();if(controller.signal.aborted)return;
        const data=await api<{stats:SiteStatistics}>('stats',{method:'POST',body:JSON.stringify({view,eventId}),signal:controller.signal});
        if(!controller.signal.aborted&&current===revision.current){setStats(data.stats);setError('');}
      }catch(error){if(!controller.signal.aborted&&current===revision.current)setError(errorMessage(error));}
      finally{if(!controller.signal.aborted&&current===revision.current)setLoading(false);}
    }
    function focused(){void refresh();}
    window.addEventListener('focus',focused);void record();
    return()=>{controller.abort();window.removeEventListener('focus',focused);};
  },[view,refresh]);
  return {stats,error,loading,refresh};
}
