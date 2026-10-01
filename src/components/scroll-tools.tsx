'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUp} from 'lucide-react';

// 回到顶部按钮出现前需要滚过的距离：整页较长，弹窗里的文章较短。
const PAGE_SHOW_AFTER=520;
const DIALOG_SHOW_AFTER=180;

// 优先跟随正在阅读的长内容：弹窗里的文章可滚动时用它，否则用整页。
function readingSurface(){
  const dialog=document.querySelector('dialog[open]');
  if(dialog&&dialog.scrollHeight-dialog.clientHeight>48)return dialog;
  return null;
}

function scrollToTop(behavior:ScrollBehavior){
  const surface=readingSurface();
  if(surface)surface.scrollTo({top:0,behavior});
  else window.scrollTo({top:0,behavior});
}

export function ScrollTools({motion}:{motion:boolean}){
  const bar=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    let frame=0;let shown=false;
    function sync(){
      frame=0;
      const surface=readingSurface();
      const top=surface?surface.scrollTop:window.scrollY;
      const max=surface?surface.scrollHeight-surface.clientHeight:document.documentElement.scrollHeight-window.innerHeight;
      const ratio=max>40?Math.min(1,Math.max(0,top/max)):0;
      const node=bar.current;
      if(node){node.style.transform=`scaleX(${ratio})`;node.dataset.active=ratio>0.002?'true':'false';}
      const next=top>(surface?DIALOG_SHOW_AFTER:PAGE_SHOW_AFTER);
      if(next!==shown){shown=next;setVisible(next);}
    }
    function request(){if(!frame)frame=requestAnimationFrame(sync);}
    sync();
    // 滚动事件不冒泡，用捕获阶段才能同时收到整页和弹窗内部（文章）的滚动。
    document.addEventListener('scroll',request,{passive:true,capture:true});
    window.addEventListener('resize',request);
    // 切换栏目、打开弹窗、图片撑开高度都会改内容高度，需要重新算一次。
    const resized=new ResizeObserver(request);resized.observe(document.body);
    const mutated=new MutationObserver(request);mutated.observe(document.body,{childList:true,subtree:true});
    return()=>{document.removeEventListener('scroll',request,{capture:true});window.removeEventListener('resize',request);resized.disconnect();mutated.disconnect();cancelAnimationFrame(frame);};
  },[]);
  return <>
    <div className="reading-progress" ref={bar} data-active="false" aria-hidden="true"/>
    <button type="button" className={`back-to-top ${visible?'is-visible':''}`} aria-label="回到顶部" title="回到顶部" onClick={()=>scrollToTop(motion?'smooth':'instant')}>
      <span className="back-to-top-star" aria-hidden="true">✦</span>
      <ArrowUp size={16}/>
      <span className="back-to-top-label" aria-hidden="true">TOP</span>
    </button>
  </>;
}
