'use client';
import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import {Check,ChevronDown} from 'lucide-react';

export function ThemeSelect({value,options,onChange,ariaLabel,disabled=false,className=''}:{value:string;options:{value:string;label:string}[];onChange:(value:string)=>void;ariaLabel:string;disabled?:boolean;className?:string}){
  const id=useId();const root=useRef<HTMLDivElement>(null);const list=useRef<HTMLUListElement>(null);
  const [open,setOpen]=useState(false);const [active,setActive]=useState(0);const [placement,setPlacement]=useState({above:false,height:240});
  const selected=options.findIndex(option=>option.value===value);
  function show(){
    const rect=root.current?.getBoundingClientRect();if(!rect||disabled)return;
    const below=window.innerHeight-rect.bottom;const above=rect.top;const upwards=below<160&&above>below;
    setPlacement({above:upwards,height:Math.max(56,Math.min(240,(upwards?above:below)-12))});setActive(Math.max(0,selected));setOpen(true);
  }
  function choose(index:number){if(disabled||!options[index])return;onChange(options[index].value);setOpen(false);}
  function keyboard(event:KeyboardEvent<HTMLButtonElement>){
    if(event.nativeEvent.isComposing)return;
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();if(!open)show();
      setActive(current=>event.key==='Home'?0:event.key==='End'?options.length-1:!open?Math.max(0,selected):(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);
    }else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)choose(active);else show();}
    else if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);}
    else if(event.key==='Tab')setOpen(false);
  }
  useEffect(()=>{
    if(!open)return;
    function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false);}
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  useEffect(()=>{if(open&&active>=0)list.current?.children[active]?.scrollIntoView({block:'nearest'});},[open,active]);
  const expanded=open&&!disabled;
  return <div className={`theme-select ${className}`} ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <button type="button" className="theme-select-trigger" role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded?`${id}-options`:undefined} aria-activedescendant={expanded?`${id}-option-${active}`:undefined} disabled={disabled} onClick={()=>open?setOpen(false):show()} onKeyDown={keyboard}><span>{options[selected]?.label||'请选择'}</span><ChevronDown size={15}/></button>
    {expanded&&<ul ref={list} id={`${id}-options`} className={`theme-select-options ${placement.above?'opens-above':''}`} role="listbox" aria-label={`${ariaLabel}选项`} style={{maxHeight:placement.height}}>{options.map((option,index)=><li key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value===value} className={`${index===active?'is-active':''} ${option.value===value?'is-selected':''}`} onPointerDown={event=>event.preventDefault()} onPointerMove={()=>setActive(index)} onClick={event=>{event.preventDefault();choose(index);}}><span>{option.label}</span>{option.value===value&&<Check size={14}/>}</li>)}</ul>}
  </div>;
}
