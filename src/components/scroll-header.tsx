'use client';
import {useEffect,useState,type ReactNode} from 'react';

export function ScrollHeader({children}:{children:ReactNode}){
  const [joined,setJoined]=useState(false);
  useEffect(()=>{
    let frame=0;
    function sync(){frame=0;setJoined(window.scrollY>48);}
    function scroll(){if(!frame)frame=requestAnimationFrame(sync);}
    sync();window.addEventListener('scroll',scroll,{passive:true});
    return()=>{window.removeEventListener('scroll',scroll);cancelAnimationFrame(frame);};
  },[]);
  return <header className={`site-header ${joined?'is-joined':''}`} data-joined={joined}>{children}</header>;
}
