'use client';
import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import {Check,ChevronDown} from 'lucide-react';

const CATEGORIES=['生活','音乐','专辑','舞台','写真','K-pop 小卡','动漫','电视剧','电影','综艺','游戏','其他'];

export function CategoryInput({value,onChange}:{value:string;onChange:(value:string)=>void}){
  const id=useId();
  const root=useRef<HTMLDivElement>(null);
  const input=useRef<HTMLInputElement>(null);
  const list=useRef<HTMLUListElement>(null);
  const [open,setOpen]=useState(false);
  const [filter,setFilter]=useState(false);
  const [active,setActive]=useState(-1);
  const [placement,setPlacement]=useState({above:false,height:220});
  const options=filter?CATEGORIES.filter(option=>option.toLowerCase().includes(value.trim().toLowerCase())):CATEGORIES;

  function show(filtered=false){
    const element=root.current;if(!element)return;
    const rect=element.getBoundingClientRect();
    const container=element.closest('.modal-scroll')?.getBoundingClientRect();
    const below=Math.min(container?.bottom??window.innerHeight,window.innerHeight)-rect.bottom;
    const above=rect.top-Math.max(container?.top??0,0);
    const upwards=below<160&&above>below;
    setPlacement({above:upwards,height:Math.max(56,Math.min(220,(upwards?above:below)-12))});
    setFilter(filtered);setActive(filtered?-1:CATEGORIES.indexOf(value));setOpen(true);
  }
  function choose(option:string){onChange(option);setOpen(false);setActive(-1);}
  function keyboard(event:KeyboardEvent<HTMLInputElement>){
    if(event.nativeEvent.isComposing)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      if(!open){show();setActive(event.key==='ArrowDown'?0:CATEGORIES.length-1);return;}
      if(!options.length)return;
      setActive(current=>event.key==='ArrowDown'?(current+1)%options.length:(current<=0?options.length-1:current-1));
    }else if(event.key==='Enter'&&open&&active>=0&&options[active]){
      event.preventDefault();choose(options[active]);
    }else if(event.key==='Escape'&&open){
      event.preventDefault();event.stopPropagation();setOpen(false);
    }
  }
  useEffect(()=>{
    if(!open)return;
    function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false);}
    document.addEventListener('pointerdown',outside);
    return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  useEffect(()=>{if(open&&active>=0)list.current?.children[active]?.scrollIntoView({block:'nearest'});},[open,active]);

  return <div className="category-combobox" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <input ref={input} value={value} maxLength={40} autoComplete="off" role="combobox" aria-label="分类" aria-autocomplete="list" aria-expanded={open} aria-controls={open?`${id}-options`:undefined} aria-activedescendant={open&&active>=0?`${id}-option-${active}`:undefined} onFocus={()=>show()} onClick={()=>{if(!open)show();}} onKeyDown={keyboard} onChange={event=>{onChange(event.target.value);show(true);}}/>
    <button type="button" className="category-toggle" tabIndex={-1} aria-label={open?'收起分类建议':'展开分类建议'} aria-expanded={open} onPointerDown={event=>event.preventDefault()} onClick={event=>{event.preventDefault();if(open)setOpen(false);else{input.current?.focus();show();}}}><ChevronDown size={15}/></button>
    {open&&<ul ref={list} id={`${id}-options`} role="listbox" aria-label="分类建议" className={`category-options ${placement.above?'opens-above':''}`} style={{maxHeight:placement.height}}>
      {options.map((option,index)=><li key={option} id={`${id}-option-${index}`} role="option" aria-selected={value===option} className={`${index===active?'is-active':''} ${value===option?'is-selected':''}`} onPointerDown={event=>event.preventDefault()} onPointerMove={()=>setActive(index)} onClick={event=>{event.preventDefault();choose(option);}}><span>{option}</span>{value===option&&<Check size={14}/>}</li>)}
      {!options.length&&<li className="category-no-match" role="presentation">使用你输入的分类即可</li>}
    </ul>}
  </div>;
}
