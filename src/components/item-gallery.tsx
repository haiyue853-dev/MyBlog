'use client';
import {useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,ExternalLink,Images} from 'lucide-react';
import {fileUrl} from '@/lib/client';
import {itemImages} from '@/lib/item-images';
import {articleImageOccurrences} from '@/lib/article-images';
import type {Item} from '@/lib/types';

export function ItemGallery({item}:{item:Item}){
  const attached=itemImages(item);const inline=new Set(item.kind==='moment'?articleImageOccurrences(item.body,attached).map(occurrence=>occurrence.image.assetId):[]);
  const images=attached.filter(image=>!inline.has(image.assetId));
  const [index,setIndex]=useState(()=>Math.max(0,images.findIndex(image=>image.assetId===item.assetId)));
  const touch=useRef<{x:number;y:number}|null>(null);
  if(!images.length)return null;
  const current=Math.min(index,images.length-1);const image=images[current];
  const step=(direction:number)=>setIndex(value=>(value+direction+images.length)%images.length);
  return <section className="item-gallery" aria-label={`${item.title}的照片`}>
    <div className="item-gallery-stage" tabIndex={images.length>1?0:undefined} aria-label="照片浏览，使用左右方向键切换"
      onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();step(event.key==='ArrowLeft'?-1:1);}}}
      onTouchStart={event=>{const point=event.touches[0];touch.current=point?{x:point.clientX,y:point.clientY}:null;}}
      onTouchEnd={event=>{const start=touch.current;touch.current=null;const end=event.changedTouches[0];if(!start||!end)return;const dx=end.clientX-start.x;const dy=end.clientY-start.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy))step(dx<0?1:-1);}}
      onTouchCancel={()=>{touch.current=null;}}
    >
      <a className="item-gallery-original" href={fileUrl(image.assetId,true)} target="_blank" rel="noopener noreferrer" aria-label={`放大查看第 ${current+1} 张照片`}>
        <img className="item-gallery-image" src={fileUrl(image.assetId,true)} alt={`${item.title} · 第 ${current+1} 张照片`}/>
      </a>
      {images.length>1&&<><button type="button" className="item-gallery-arrow previous" aria-label="上一张照片" onClick={()=>step(-1)}><ChevronLeft size={22}/></button><button type="button" className="item-gallery-arrow next" aria-label="下一张照片" onClick={()=>step(1)}><ChevronRight size={22}/></button></>}
    </div>
    <div className="item-gallery-caption"><span aria-live="polite"><Images size={14}/>{current+1} / {images.length}</span><a href={fileUrl(image.assetId,true)} target="_blank" rel="noopener noreferrer">查看原图 <ExternalLink size={13}/></a></div>
    {images.length>1&&<div className="item-gallery-thumbnails" aria-label="选择照片">{images.map((photo,position)=><button type="button" key={photo.assetId} aria-label={`查看第 ${position+1} 张照片${photo.assetId===item.assetId?'（封面）':''}`} aria-pressed={position===current} onClick={()=>setIndex(position)}><img src={fileUrl(photo.assetId,true)} alt="" loading="lazy"/><span>{position+1}</span></button>)}</div>}
  </section>;
}
