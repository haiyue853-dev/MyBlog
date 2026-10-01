'use client';
import {useEffect,useRef} from 'react';

export function CursorNotes({enabled}:{enabled:boolean}){
  const layer=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const container=layer.current;if(!enabled||!container)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine=window.matchMedia('(any-pointer: fine)');
    let lastTime=-Infinity;let lastX=-Infinity;let lastY=-Infinity;let index=0;
    function clear(){container!.replaceChildren();lastTime=-Infinity;lastX=-Infinity;lastY=-Infinity;}
    function move(event:PointerEvent){
      if(event.pointerType!=='mouse'||reduced.matches||!fine.matches||document.hidden)return;
      const now=performance.now();
      if(now-lastTime<65||Math.hypot(event.clientX-lastX,event.clientY-lastY)<12)return;
      lastTime=now;lastX=event.clientX;lastY=event.clientY;
      const note=document.createElement('span');note.className='cursor-note';
      note.textContent=['♪','♫','♬'][index++%3];
      note.style.left=`${event.clientX+12}px`;note.style.top=`${event.clientY+10}px`;
      note.style.fontSize=`${18+Math.random()*6}px`;
      note.style.setProperty('--note-drift',`${(Math.random()-.5)*48}px`);
      note.style.setProperty('--note-rise',`${-45-Math.random()*30}px`);
      note.style.setProperty('--note-tilt',`${(Math.random()-.5)*36}deg`);
      note.addEventListener('animationend',()=>note.remove(),{once:true});
      if(container!.childElementCount>=18)container!.firstElementChild?.remove();
      container!.appendChild(note);
    }
    window.addEventListener('pointermove',move,{passive:true});
    window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
    reduced.addEventListener('change',clear);fine.addEventListener('change',clear);
    return()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('blur',clear);
      document.removeEventListener('visibilitychange',clear);
      reduced.removeEventListener('change',clear);fine.removeEventListener('change',clear);clear();
    };
  },[enabled]);
  return <div ref={layer} className="cursor-notes" aria-hidden="true"/>;
}
