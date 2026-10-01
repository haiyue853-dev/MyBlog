'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';

export function ScrollHeader({children}:{children:ReactNode}){
  const [joined,setJoined]=useState(false);
  const header=useRef<HTMLElement>(null);
  useEffect(()=>{
    const element=header.current;if(!element)return;
    const brand=element.querySelector('.brand');const nav=element.querySelector('.main-nav');const tools=element.querySelector('.header-tools');
    if(!brand||!nav||!tools)return;
    function measure(){
      const box=element!.getBoundingClientRect();
      const b=brand!.getBoundingClientRect();const n=nav!.getBoundingClientRect();const t=tools!.getBoundingClientRect();
      function shape(x:number,y:number,w:number,h:number,r:number[]){
        const [tl,tr,br,bl]=r;return `M${x+tl} ${y}H${x+w-tr}Q${x+w} ${y} ${x+w} ${y+tr}V${y+h-br}Q${x+w} ${y+h} ${x+w-br} ${y+h}H${x+bl}Q${x} ${y+h} ${x} ${y+h-bl}V${y+tl}Q${x} ${y} ${x+tl} ${y}Z`;
      }
      const paths=[b,n,t].map(rect=>shape(rect.left-box.left,rect.top-box.top,rect.width,rect.height,Array(4).fill(rect.height/2)));
      const open=paths.join('');
      const left=b.left-box.left;const right=t.right-box.left;const top=Math.min(b.top,n.top,t.top)-box.top;
      const bottom=Math.max(b.bottom,n.bottom,t.bottom)-box.top;const h=bottom-top;
      const radius=n.top>b.top+5?27:h/2;
      // Keep one glass layer: only the brand outline grows; the other paths stay fixed.
      const joined=shape(left,top,right-left,h,Array(4).fill(radius))+paths[1]+paths[2];
      element!.style.setProperty('--header-left',`${left}px`);
      element!.style.setProperty('--header-top-open',`${b.top-box.top}px`);
      element!.style.setProperty('--header-bottom-open',`${box.bottom-b.bottom}px`);
      element!.style.setProperty('--header-right-open',`${box.right-b.right}px`);
      element!.style.setProperty('--header-top-joined',`${top}px`);
      element!.style.setProperty('--header-bottom-joined',`${box.height-bottom}px`);
      element!.style.setProperty('--header-right-joined',`${box.right-t.right}px`);
      element!.style.setProperty('--header-clip-open',`path('${open}')`);
      element!.style.setProperty('--header-clip-joined',`path('${joined}')`);
      element!.dataset.measured='true';
    }
    let frame=0;
    function sync(){frame=0;setJoined(window.scrollY>20);}
    function scroll(){if(!frame)frame=requestAnimationFrame(sync);}
    measure();sync();window.addEventListener('scroll',scroll,{passive:true});
    const observer=new ResizeObserver(measure);for(const target of [element,brand,nav,tools])observer.observe(target);
    // 首帧之后布局还可能再落位一次（字体、头像图、首屏图片），这时必须重新量：
    // 否则 --header-* 会一直停在旧值，胶囊几何就和名牌自身的盒子对不上了。
    let alive=true;let settle=requestAnimationFrame(()=>{settle=requestAnimationFrame(()=>{if(alive)measure();});});
    function remeasure(){if(alive)measure();}
    window.addEventListener('load',remeasure);
    if(document.fonts&&document.fonts.ready)void document.fonts.ready.then(remeasure).catch(()=>{});
    return()=>{alive=false;window.removeEventListener('scroll',scroll);window.removeEventListener('load',remeasure);cancelAnimationFrame(frame);cancelAnimationFrame(settle);observer.disconnect();};
  },[]);
  return <header ref={header} className={`site-header ${joined?'is-joined':''}`} data-joined={joined}>{children}</header>;
}
