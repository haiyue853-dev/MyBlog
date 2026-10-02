'use client';
import {useEffect,useRef,useState} from 'react';
import {Heart} from 'lucide-react';
import {api,errorMessage} from '@/lib/client';
import type {DailyLike} from '@/lib/types';
import {applyDailyLike,mergeDailyLikes} from '@/lib/daily-like-state';
import {ensureVisitor} from '@/lib/visitor-client';

interface LikeStates {likes:Record<string,DailyLike>;day:string;nextDayAt:number;}
export function useDailyLikes(ids:string[],owner:boolean,onError:(message:string)=>void){
  const key=ids.join(',');
  const [snapshot,setSnapshot]=useState<{day:string;likes:Record<string,DailyLike>}>({day:'',likes:{}});
  const [pending,setPending]=useState<string[]>([]);
  const [readyKey,setReadyKey]=useState('');
  const [refresh,setRefresh]=useState(0);
  const posting=useRef(new Set<string>());
  const loadedDay=useRef('');
  const current=useRef(key);current.current=key;
  useEffect(()=>{
    if(!key)return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    setReadyKey('');
    async function load(){
      try{
        await ensureVisitor();if(controller.signal.aborted)return;
        const requested=key.split(',');const next:Record<string,DailyLike>={};let nextDayAt=0;let day='';
        // Sequential batches also ensure a first-time visitor receives one identity cookie.
        for(let index=0;index<requested.length;index+=80){
          const result=await api<LikeStates>(`likes?ids=${requested.slice(index,index+80).join(',')}`,{signal:controller.signal});
          if(controller.signal.aborted)return;
          if(result.day<loadedDay.current||(day&&day!==result.day)){setRefresh(value=>value+1);return;}
          day=result.day;
          Object.assign(next,result.likes);nextDayAt=result.nextDayAt;
        }
        if(controller.signal.aborted)return;
        loadedDay.current=day;
        setSnapshot(value=>({day:day>value.day?day:value.day,likes:mergeDailyLikes(value.likes,value.day,day,next)}));setReadyKey(key);
        timer=setTimeout(()=>setRefresh(value=>value+1),Math.max(1000,Math.min(86400000,nextDayAt-Date.now()+250)));
      }catch(error){if(!controller.signal.aborted)onError(errorMessage(error));}
    }
    function reload(){setRefresh(value=>value+1);}
    window.addEventListener('focus',reload);void load();
    return()=>{controller.abort();clearTimeout(timer);window.removeEventListener('focus',reload);};
  },[key,owner,refresh,onError]);
  async function like(id:string){
    if(posting.current.has(id)||readyKey!==key||snapshot.likes[id]?.liked)return;
    const before=snapshot.likes[id];
    posting.current.add(id);setPending(value=>[...value,id]);onError('');
    // 乐观更新：点击当下就把 +1 和「已喜欢」画出来。心形的填充与 heart-pop 动画都由
    // aria-pressed 驱动，等服务端响应再更新的话，线上一次往返（worker → D1，跨区）
    // 会让动画整整迟到大半秒到一秒，看起来像没点中。服务端回来后用它的真值覆盖，
    // 失败就回滚到 before，让按钮恢复可点。
    setSnapshot(value=>({...value,likes:{...value.likes,[id]:{count:(before?.count??0)+1,liked:true}}}));
    try{
      const result=await api<{like:DailyLike;day:string}>(`likes/${id}`,{method:'POST'});
      if(result.day<loadedDay.current){setRefresh(value=>value+1);return;}
      const changedDay=result.day>loadedDay.current;loadedDay.current=result.day;
      // 以服务端真值为准（期间别人也点了的话取较大的那个，mergeDailyLikes 里是 Math.max）。
      if(current.current.split(',').includes(id))setSnapshot(value=>({day:result.day>value.day?result.day:value.day,likes:applyDailyLike(value.likes,value.day,result.day,id,result.like)}));
      if(changedDay)setRefresh(value=>value+1);
    }catch(error){
      setSnapshot(value=>{const likes={...value.likes};if(before)likes[id]=before;else delete likes[id];return {...value,likes};});
      onError(errorMessage(error));
    }
    finally{posting.current.delete(id);setPending(value=>value.filter(value=>value!==id));}
  }
  return {likes:readyKey===key?snapshot.likes:{},pending,onLike:like};
}

export function DailyHeart({title,like,pending,onClick,className='heart-button'}:{title:string;like?:DailyLike;pending:boolean;onClick:()=>void;className?:string}){
  const label=`${like?.liked?'今日已喜欢':'喜欢'} ${title}${like?`，累计 ${like.count} 次`:''}`;
  return <button className={`${className} daily-heart`} onClick={onClick} disabled={!like||pending||like.liked}
    aria-pressed={!!like?.liked} aria-label={label} title={like?.liked?'今天点过了，明天可以再点':'每天可以点一次'}>
    <Heart size={14} fill={like?.liked?'currentColor':'none'}/><span aria-live="polite">{like?like.count:'…'}</span>
  </button>;
}
