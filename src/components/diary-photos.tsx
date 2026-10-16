'use client';
import {useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,GripVertical,ImagePlus,LoaderCircle,X} from 'lucide-react';
import {errorMessage,fileUrl} from '@/lib/client';
import {uploadPhoto} from '@/lib/upload-photo';
import {MAX_DIARY_IMAGES,appendItemPhoto} from '@/lib/item-images';
import type {ItemImage} from '@/lib/types';

export function DiaryPhotos({images,coverId,onChange,onUploadingChange,disabled=false,autoCover=true}:{
  images:ItemImage[];coverId:string|null;onChange:(images:ItemImage[],coverId:string|null)=>void;
  onUploadingChange:(uploading:boolean)=>void;disabled?:boolean;autoCover?:boolean;
}){
  const [progress,setProgress]=useState<{done:number;total:number}|null>(null);
  const [error,setError]=useState('');const [dragged,setDragged]=useState<string|null>(null);
  const uploadGuard=useRef(false);

  async function upload(files:File[]){
    if(!files.length||disabled||uploadGuard.current)return;
    setError('');
    if(files.length>MAX_DIARY_IMAGES){setError(`每次最多选择 ${MAX_DIARY_IMAGES} 张照片，请少选几张。`);return;}
    if(files.some(file=>!(/\.(png|jpe?g|webp|gif)$/i.test(file.name)))){setError('请选择 JPG、PNG、WebP 或 GIF 图片。');return;}
    uploadGuard.current=true;onUploadingChange(true);setProgress({done:0,total:files.length});
    let next=[...images];const failures:string[]=[];
    try{
      for(let index=0;index<files.length;index++){
        const file=files[index];
        try{
          const photo=await uploadPhoto(file,next.map(image=>image.assetId),next.length>=MAX_DIARY_IMAGES);
          next=appendItemPhoto(next,photo);
          onChange([...next],coverId||(autoCover?next[0]?.assetId:null)||null);
        }catch(error){failures.push(`${file.name}：${errorMessage(error)}`);}
        setProgress({done:index+1,total:files.length});
      }
      if(failures.length)setError(`有 ${failures.length} 张上传失败，已上传的照片已保留。${failures.join('；')}`);
    }finally{uploadGuard.current=false;setProgress(null);onUploadingChange(false);}
  }

  function move(from:number,to:number){
    if(disabled||from<0||to<0||from>=images.length||to>=images.length||from===to)return;
    const next=[...images];const [image]=next.splice(from,1);next.splice(to,0,image);onChange(next,coverId);
  }
  function remove(id:string){
    const next=images.filter(image=>image.assetId!==id);
    onChange(next,coverId===id?(autoCover?next[0]?.assetId:null)||null:coverId);
  }

  return <section className="diary-photo-editor" aria-label="日记照片">
    <div className="diary-photo-heading"><span>收好这些瞬间</span><span className="muted">{images.length} / {MAX_DIARY_IMAGES} 张</span></div>
    {images.length>0&&<ol className="diary-photo-grid">{images.map((image,index)=><li
      className={`diary-photo ${coverId===image.assetId?'is-cover':''} ${dragged===image.assetId?'is-dragging':''}`}
      key={image.assetId} draggable={!disabled}
      onDragStart={event=>{if(disabled){event.preventDefault();return;}event.dataTransfer.setData('text/plain',image.assetId);event.dataTransfer.effectAllowed='move';setDragged(image.assetId);}}
      onDragEnd={()=>setDragged(null)} onDragOver={event=>{if(!disabled)event.preventDefault();}}
      onDrop={event=>{event.preventDefault();move(images.findIndex(value=>value.assetId===event.dataTransfer.getData('text/plain')),index);setDragged(null);}}
    >
      <div className="diary-photo-image"><img src={fileUrl(image.assetId,true)} alt={`日记照片 ${index+1}`} draggable={false}/>
        <span className="diary-photo-number">{index+1}</span>
        <button type="button" className="diary-photo-remove" onClick={()=>remove(image.assetId)} disabled={disabled} aria-label={`移除第 ${index+1} 张照片`}><X size={14}/></button>
      </div>
      <div className="diary-photo-actions">
        <button type="button" className="diary-cover-button" aria-pressed={coverId===image.assetId} disabled={disabled} onClick={()=>onChange(images,image.assetId)}>{coverId===image.assetId?<><Check size={13}/>封面</>:'设为封面'}</button>
        <div className="diary-photo-order"><button type="button" disabled={disabled||index===0} onClick={()=>move(index,index-1)} aria-label={`将第 ${index+1} 张照片前移`}><ArrowLeft size={14}/></button><button type="button" disabled={disabled||index===images.length-1} onClick={()=>move(index,index+1)} aria-label={`将第 ${index+1} 张照片后移`}><ArrowRight size={14}/></button></div>
      </div>
    </li>)}</ol>}
    <label className={`diary-photo-upload ${disabled?'is-disabled':''}`}>
      {progress?<LoaderCircle size={23} className="spin"/>:<ImagePlus size={23}/>}
      <span>{progress?`正在上传 ${progress.done} / ${progress.total} 张…`:images.length?'继续添加照片':'选择照片（可多选）'}</span>
      {!progress&&<small>{images.length>=MAX_DIARY_IMAGES?'已满，可重复选择已有照片；添加新照片需先移除一张。':`JPG、PNG、WebP、GIF · 最多 ${MAX_DIARY_IMAGES} 张`}</small>}
      <input type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" aria-label="添加日记照片" disabled={disabled} onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value='';void upload(files);}}/>
    </label>
    {images.length>1&&<p className="diary-photo-tip"><GripVertical size={13}/>拖动照片调整顺序；手机上可用箭头移动。</p>}
    {progress&&<p className="diary-photo-tip" role="status">上传完成后即可保存日记。</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </section>;
}
