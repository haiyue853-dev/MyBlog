'use client';
import {useEffect,useRef,useState,type PointerEvent,type KeyboardEvent} from 'react';
import {Move,Minus,Plus,RotateCcw,Monitor,Smartphone} from 'lucide-react';
import {articleCoverCrop,coverCropStyle,coverImageRect,moveCoverCrop,MAX_COVER_ZOOM,type CoverSize} from '@/lib/article-cover';
import type {ArticleConfig,ArticleCoverCrop} from '@/lib/types';

export function ArticleCoverEditor({src,title,value,onChange,disabled=false}:{src:string;title:string;value:ArticleConfig;onChange:(value:ArticleConfig)=>void;disabled?:boolean}){
  return <CoverEditor src={src} title={title} value={articleCoverCrop(value)} onChange={coverCrop=>onChange({...value,coverCrop})} disabled={disabled}/>;
}

export function CoverEditor({src,title='',value:crop,onChange,disabled=false,preview='article',targetItemId}:{src:string;title?:string;value:ArticleCoverCrop;onChange:(value:ArticleCoverCrop)=>void;disabled?:boolean;preview?:'article'|'card';targetItemId?:string}){
  const [phone,setPhone]=useState(false);const [natural,setNatural]=useState<{width:number;height:number}|null>(null);const [error,setError]=useState(false);const [dragging,setDragging]=useState(false);
  const frame=useRef<HTMLDivElement>(null);
  const [frameSize,setFrameSize]=useState<{width:number;height:number}|null>(null);
  const [pageFrame,setPageFrame]=useState<{aspect:number;phone:boolean}|null>(null);
  useEffect(()=>{
    const media=window.matchMedia('(max-width:640px)');
    setPhone(media.matches);
    const target=preview==='card'?document.querySelector<HTMLElement>(targetItemId?`[data-cover-item="${CSS.escape(targetItemId)}"]`:'.main-content .card-image'):null;
    const host=target||document.querySelector<HTMLElement>('.main-content');
    function measure(){
      if(preview!=='card'||!host)return;
      const rect=host.getBoundingClientRect();if(rect.width<=0)return;
      const width=target?rect.width:rect.width-2;
      const height=target?rect.height:media.matches?215:240;
      if(height>0)setPageFrame({aspect:width/height,phone:media.matches});
    }
    function resize(){setPhone(media.matches);measure();}
    measure();const observer=new ResizeObserver(measure);if(host)observer.observe(host);
    media.addEventListener('change',resize);
    return()=>{observer.disconnect();media.removeEventListener('change',resize);};
  },[preview,targetItemId]);
  useEffect(()=>{
    const node=frame.current;if(!node)return;
    const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;setFrameSize({width,height});});
    observer.observe(node);return()=>observer.disconnect();
  },[]);
  const imageRect=natural&&frameSize?coverImageRect(crop,{imageWidth:natural.width,imageHeight:natural.height,frameWidth:frameSize.width,frameHeight:frameSize.height}):null;
  const drag=useRef<{pointerId:number;startX:number;startY:number;crop:ArticleCoverCrop;size:CoverSize}|null>(null);
  function change(next:ArticleCoverCrop){if(!disabled)onChange(next);}
  function zoom(next:number){change({...crop,zoom:Math.max(1,Math.min(MAX_COVER_ZOOM,Math.round(next*100)/100))});}
  function start(event:PointerEvent<HTMLDivElement>){
    if(disabled||!natural||event.button!==0||drag.current)return;
    event.preventDefault();event.currentTarget.focus({preventScroll:true});const rect=event.currentTarget.getBoundingClientRect();
    drag.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,crop,size:{imageWidth:natural.width,imageHeight:natural.height,frameWidth:rect.width,frameHeight:rect.height}};
    event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);
  }
  function move(event:PointerEvent<HTMLDivElement>){const active=drag.current;if(!active||active.pointerId!==event.pointerId||disabled)return;change(moveCoverCrop(active.crop,event.clientX-active.startX,event.clientY-active.startY,active.size));}
  function end(event:PointerEvent<HTMLDivElement>){if(drag.current?.pointerId!==event.pointerId)return;drag.current=null;setDragging(false);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
  function keys(event:KeyboardEvent<HTMLDivElement>){
    if(disabled||!natural)return;
    const actions:Record<string,()=>void>={ArrowLeft:()=>change({...crop,x:Math.max(0,crop.x-2)}),ArrowRight:()=>change({...crop,x:Math.min(100,crop.x+2)}),ArrowUp:()=>change({...crop,y:Math.max(0,crop.y-2)}),ArrowDown:()=>change({...crop,y:Math.min(100,crop.y+2)}),'+':()=>zoom(crop.zoom+.1),'=':()=>zoom(crop.zoom+.1),'-':()=>zoom(crop.zoom-.1),Home:()=>change({x:50,y:50,zoom:1})};
    if(actions[event.key]){event.preventDefault();event.stopPropagation();actions[event.key]();}
  }
  return <div className="article-cover-editor">
    <div className="cover-crop-heading"><span><Move size={15}/>封面取景</span><div className="cover-preview-tabs" aria-label="封面预览尺寸"><button type="button" aria-pressed={!phone} disabled={disabled} onClick={()=>setPhone(false)}><Monitor size={13}/>桌面预览</button><button type="button" aria-pressed={phone} disabled={disabled} onClick={()=>setPhone(true)}><Smartphone size={13}/>手机预览</button></div></div>
    <div className="cover-crop-stage"><div ref={frame} className={`cover-crop-frame ${preview==='card'?'cover-crop-card':''} ${phone?'cover-crop-phone':''} ${dragging?'is-dragging':''}`} style={preview==='card'&&pageFrame?.phone===phone?{aspectRatio:pageFrame.aspect}:undefined} role="group" aria-label="封面取景框" aria-description="亮框内为页面实际显示范围，框外为裁切掉的部分。拖动图片调整取景。" aria-disabled={disabled} tabIndex={disabled?-1:0} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={()=>{drag.current=null;setDragging(false);}} onKeyDown={keys}>
      <img src={src} alt={preview==='card'?'日常封面预览':'文章封面预览'} draggable={false} style={imageRect?{width:imageRect.width,height:imageRect.height,left:imageRect.left,top:imageRect.top}:coverCropStyle(crop)} onLoad={event=>{setError(false);setNatural({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight});}} onError={()=>{setError(true);setNatural(null);}}/>
      <div className="cover-crop-grid" aria-hidden="true"/>{preview==='article'&&<div className="cover-crop-caption" aria-hidden="true"><span>文章封面</span><strong>{title||'你的文章标题'}</strong></div>}
      <div className="cover-crop-boundary" aria-hidden="true"><span>页面实际显示范围</span></div>
      {error&&<span className="cover-crop-error" role="alert">封面暂时没有加载出来，请重新打开或选择图片。</span>}
    </div></div>
    <div className="cover-zoom-controls"><button type="button" className="icon-button" aria-label="缩小封面" disabled={disabled||crop.zoom<=1} onClick={()=>zoom(crop.zoom-.1)}><Minus size={16}/></button><label>缩放<input aria-label="封面缩放" type="range" min={1} max={MAX_COVER_ZOOM} step={.01} value={crop.zoom} disabled={disabled} onChange={event=>zoom(Number(event.target.value))}/></label><button type="button" className="icon-button" aria-label="放大封面" disabled={disabled||crop.zoom>=MAX_COVER_ZOOM} onClick={()=>zoom(crop.zoom+.1)}><Plus size={16}/></button><output aria-label="封面缩放比例">{Math.round(crop.zoom*100)}%</output><button type="button" className="text-button" disabled={disabled} onClick={()=>change({x:50,y:50,zoom:1})}><RotateCcw size={13}/>重置</button></div>
    <p className="cover-crop-hint">亮框内是页面实际显示的封面，框外暗色部分会被裁掉。拖动图片或调整缩放来取景；可切换桌面、手机预览，聚焦取景框后也可用方向键调整。</p>
  </div>;
}
