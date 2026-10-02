'use client';
import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {LoaderCircle,RotateCcw} from 'lucide-react';
import {avatarCrop,type AvatarCenter} from '@/lib/avatar-crop';
import {errorMessage} from '@/lib/client';
import {Modal} from './modal';

function toBlob(canvas:HTMLCanvasElement,mime:string,quality?:number){
  return new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,mime,quality));
}

export function AvatarCrop({file,onClose,onConfirm}:{file:File;onClose:()=>void;onConfirm:(file:File)=>Promise<void>}){
  const [url,setUrl]=useState('');
  const [dimensions,setDimensions]=useState<{width:number;height:number}|null>(null);
  const [zoom,setZoom]=useState(1);
  const [center,setCenter]=useState<AvatarCenter>({x:.5,y:.5});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const image=useRef<HTMLImageElement>(null);
  const drag=useRef<{pointer:number;x:number;y:number;center:AvatarCenter;size:number;frame:number}|null>(null);
  useEffect(()=>{const source=URL.createObjectURL(file);setUrl(source);return()=>URL.revokeObjectURL(source);},[file]);
  const crop=dimensions?avatarCrop(dimensions.width,dimensions.height,zoom,center):null;
  function position(next:AvatarCenter,nextZoom=zoom){
    if(!dimensions)return;
    const rect=avatarCrop(dimensions.width,dimensions.height,nextZoom,next);
    setCenter({x:(rect.x+rect.size/2)/dimensions.width,y:(rect.y+rect.size/2)/dimensions.height});
  }
  function begin(event:PointerEvent<HTMLDivElement>){
    if(!dimensions||!crop||saving||event.button!==0||drag.current)return;
    event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,center:{x:(crop.x+crop.size/2)/dimensions.width,y:(crop.y+crop.size/2)/dimensions.height},size:crop.size,frame:event.currentTarget.getBoundingClientRect().width};
  }
  function move(event:PointerEvent<HTMLDivElement>){
    const start=drag.current;if(!start||!dimensions||start.pointer!==event.pointerId)return;
    position({x:start.center.x-(event.clientX-start.x)/start.frame*start.size/dimensions.width,y:start.center.y-(event.clientY-start.y)/start.frame*start.size/dimensions.height});
  }
  function end(event:PointerEvent<HTMLDivElement>){if(drag.current?.pointer===event.pointerId)drag.current=null;}
  function keyboard(event:KeyboardEvent<HTMLDivElement>){
    if(!dimensions||!crop||saving)return;
    const directions:Record<string,[number,number]>={ArrowLeft:[1,0],ArrowRight:[-1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};
    const direction=directions[event.key];if(!direction)return;event.preventDefault();
    position({x:(crop.x+crop.size/2+direction[0]*crop.size*.025)/dimensions.width,y:(crop.y+crop.size/2+direction[1]*crop.size*.025)/dimensions.height});
  }
  async function confirm(){
    if(!dimensions||!crop||!image.current)return;
    setSaving(true);setError('');
    try{
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
      const context=canvas.getContext('2d');if(!context)throw new Error('图片处理失败，请重新选择照片。');
      context.drawImage(image.current,crop.x,crop.y,crop.size,crop.size,0,0,512,512);
      // 头像最后只显示成一枚小圆图，512×512 已经绰绰有余；
      // 存成 WebP 比 PNG 小一个数量级，编不出来再退回 PNG。
      const encoded=await toBlob(canvas,'image/webp',0.85)??await toBlob(canvas,'image/png');
      if(!encoded)throw new Error('无法保存这张照片，请换一张重试。');
      const suffix=encoded.type==='image/webp'?'webp':'png';
      await onConfirm(new File([encoded],`${file.name.replace(/\.[^.]+$/,'')||'头像'}-avatar.${suffix}`,{type:encoded.type}));
    }catch(error){setError(errorMessage(error));}finally{setSaving(false);}
  }
  return <Modal title="调整头像" onClose={()=>{if(!saving)onClose();}}>
    <div className="avatar-crop-editor">
      <p id="avatar-crop-help" className="muted">拖动照片调整位置，滑动下方滑块缩放。也可用方向键移动。</p>
      <div className="avatar-crop-stage" role="group" aria-label="头像裁剪区域" aria-describedby="avatar-crop-help" tabIndex={0} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={()=>{drag.current=null;}} onKeyDown={keyboard}>
        {url&&<img ref={image} src={url} alt="待调整的头像" draggable={false} className="avatar-crop-image" style={crop&&dimensions?{width:`${dimensions.width/crop.size*100}%`,height:`${dimensions.height/crop.size*100}%`,left:`${-crop.x/crop.size*100}%`,top:`${-crop.y/crop.size*100}%`}:{visibility:'hidden'}} onLoad={event=>setDimensions({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} onError={()=>{setDimensions(null);setError('这张图片无法打开，请重新选择 JPG、PNG、WebP 或 GIF 图片。');}}/>}
        {!dimensions&&!error&&<LoaderCircle size={24} className="spin avatar-crop-loading"/>}
      </div>
      <label className="avatar-crop-zoom" htmlFor="avatar-zoom"><span>缩放 <output htmlFor="avatar-zoom">{Math.round(zoom*100)}%</output></span><input id="avatar-zoom" type="range" min={1} max={4} step={.01} value={zoom} aria-valuetext={`${Math.round(zoom*100)}%`} disabled={!dimensions||saving} onChange={event=>{const next=Number(event.target.value);position(center,next);setZoom(next);}}/></label>
      {file.type==='image/gif'&&<p className="muted">GIF 会保存为静态头像。</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="avatar-crop-actions"><button type="button" className="text-button" disabled={saving||!dimensions} onClick={()=>{setZoom(1);setCenter({x:.5,y:.5});}}><RotateCcw size={14}/>重置位置</button><div className="form-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>取消</button><button type="button" className="button primary" disabled={!dimensions||saving} onClick={()=>void confirm()}>{saving&&<LoaderCircle size={16} className="spin"/>}{saving?'正在保存…':'使用这张头像'}</button></div></div>
    </div>
  </Modal>;
}
