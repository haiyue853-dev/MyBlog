'use client';
import {useEffect,useRef,type PointerEvent} from 'react';
import {Archive,ChevronDown,ListTodo,FolderHeart,Sparkles,ChartNoAxesCombined,Recycle} from 'lucide-react';

const entries=[{id:'content' as const,label:'内容管理',Icon:ListTodo},{id:'files' as const,label:'资料柜',Icon:FolderHeart},{id:'trash' as const,label:'回收站',Icon:Recycle},{id:'iris' as const,label:'Iris',Icon:Sparkles},{id:'stats' as const,label:'小屋统计',Icon:ChartNoAxesCombined}];
export function HouseTools({view,owner,onNavigate}:{view:string;owner:boolean;onNavigate:(view:'content'|'files'|'trash'|'iris'|'stats')=>void}){
  const root=useRef<HTMLDetailsElement>(null);
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  function cancelClose(){if(closeTimer.current!==null){clearTimeout(closeTimer.current);closeTimer.current=null;}}
  function close(){cancelClose();if(root.current)root.current.open=false;}
  function enter(event:PointerEvent<HTMLElement>){if(event.pointerType!=='mouse')return;cancelClose();if(root.current)root.current.open=true;}
  function leave(event:PointerEvent<HTMLElement>){if(event.pointerType!=='mouse')return;cancelClose();closeTimer.current=setTimeout(close,160);}
  useEffect(()=>{
    function outside(event:globalThis.PointerEvent){if(root.current?.open&&!root.current.contains(event.target as Node))close();}
    function escape(event:globalThis.KeyboardEvent){if(event.key==='Escape'&&root.current?.open){close();root.current.querySelector('summary')?.focus();}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{cancelClose();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[]);
  return <details ref={root} className={`house-tools ${entries.some(entry=>entry.id===view)?'is-current':''}`} onPointerEnter={enter} onPointerLeave={leave}>
    <summary onClick={cancelClose}><Archive size={18}/><span>小屋工具</span><ChevronDown className="house-tools-chevron" size={13}/></summary>
    <nav className="house-tools-menu" aria-label="小屋工具">{entries.filter(entry=>!['content','trash','iris'].includes(entry.id)||owner).map(({id,label,Icon})=><button key={id} type="button" title={label} aria-current={view===id?'page':undefined} onClick={()=>{close();onNavigate(id);}}><Icon size={17}/><span>{label}</span></button>)}</nav>
  </details>;
}
