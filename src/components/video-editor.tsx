'use client';
import {useRef,useState,type FormEvent} from 'react';
import {Upload,ImagePlus,LoaderCircle,Clapperboard,Check} from 'lucide-react';
import {api,errorMessage,fileUrl} from '@/lib/client';
import {readVideoFile,uploadVideo} from '@/lib/video-upload';
import {MAX_VIDEO_SIZE,VIDEO_ACCEPT,videoDuration} from '@/lib/videos';
import type {Asset,Item,VideoConfig,Visibility} from '@/lib/types';
import {ThemeSelect} from './theme-select';
import {Modal} from './modal';

export function VideoEditor({item,onClose,onSaved}:{item?:Item;onClose:()=>void;onSaved:(item:Item)=>void}){
  const [title,setTitle]=useState(item?.title||'');const [body,setBody]=useState(item?.body||'');const [category,setCategory]=useState(item?.category||'');const [tags,setTags]=useState(item?.tags.join('，')||'');
  const [visibility,setVisibility]=useState<Visibility>(item?.visibility||'public');const [video,setVideo]=useState<VideoConfig|null>(item?.video||null);const [cover,setCover]=useState<string|null>(item?.assetId||null);
  const [uploading,setUploading]=useState('');const [progress,setProgress]=useState<number|null>(null);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [discard,setDiscard]=useState(false);
  const [requestId]=useState(()=>crypto.randomUUID());const picker=useRef<HTMLInputElement>(null);const posterPicker=useRef<HTMLInputElement>(null);
  const [original]=useState(()=>JSON.stringify({title:item?.title||'',body:item?.body||'',category:item?.category||'',tags:item?.tags.join('，')||'',visibility:item?.visibility||'public',video:item?.video||null,cover:item?.assetId||null}));
  const dirty=JSON.stringify({title,body,category,tags,visibility,video,cover})!==original;const busy=!!uploading||saving;
  function close(){if(busy)return;if(dirty)setDiscard(true);else onClose();}
  async function choose(file?:File){
    if(!file||busy)return;setError('');setProgress(null);
    if(file.size>MAX_VIDEO_SIZE){setError('每个视频最多 100 MB。');return;}
    if(!/\.(mp4|webm)$/i.test(file.name)){setError('请选择 MP4 或 WebM 视频。');return;}
    setUploading('正在读取画面…');
    try{
      const {metadata,poster}=await readVideoFile(file);setUploading('正在上传视频…');setProgress(0);
      const asset=await uploadVideo(file,setProgress);setVideo({assetId:asset.id,...metadata});
      if(!title.trim())setTitle(file.name.replace(/\.[^.]+$/,''));
      if(!cover&&poster){setUploading('正在收好封面…');const form=new FormData();form.set('file',poster);form.set('category','视频封面');const result=await api<{file:Asset}>('files',{method:'POST',body:form});setCover(result.file.id);}
    }catch(error){setError(errorMessage(error));}finally{setUploading('');setProgress(null);}
  }
  async function choosePoster(file?:File){
    if(!file||busy)return;setUploading('正在上传封面…');setError('');
    try{const form=new FormData();form.set('file',file);form.set('category','视频封面');const result=await api<{file:Asset}>('files',{method:'POST',body:form});if(!result.file.mime.startsWith('image/'))throw new Error('请选择图片作为封面。');setCover(result.file.id);}catch(error){setError(errorMessage(error));}finally{setUploading('');}
  }
  async function save(event:FormEvent){
    event.preventDefault();if(busy)return;setError('');if(!video){setError('先选择一个视频，再收好这份作品。');return;}
    setSaving(true);
    try{
      const tagList=[...new Set(tags.split(/[,，]/).map(tag=>tag.trim()).filter(Boolean))];
      if(tagList.length>10||tagList.some(tag=>tag.length>30))throw new Error('标签最多 10 个，每个最多 30 字。');
      const result=await api<{item:Item}>(item?`items/${item.id}`:'items',{method:item?'PUT':'POST',body:JSON.stringify({kind:'video',title,body,category,tags:tagList,visibility,assetId:cover,video,status:'published',url:'',article:null,...(!item?{clientRequestId:requestId}:{})})});
      onSaved(result.item);onClose();
    }catch(error){setError(errorMessage(error));}finally{setSaving(false);}
  }
  return <><Modal title={item?'编辑这份视频作品':'收好一份视频作品'} wide className="video-editor-dialog" onClose={close} closeOnBackdrop={false}>
    <form className="video-editor-form" onSubmit={save}>
      <input ref={picker} type="file" accept={VIDEO_ACCEPT} className="visually-hidden" aria-label="选择视频文件" disabled={busy} onChange={event=>{void choose(event.target.files?.[0]);event.target.value='';}}/>
      <input ref={posterPicker} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="visually-hidden" aria-label="选择视频封面" disabled={busy} onChange={event=>{void choosePoster(event.target.files?.[0]);event.target.value='';}}/>
      <div className="video-editor-media">
        <div className="video-cover-preview">{cover?<img src={fileUrl(cover,true)} alt="视频作品封面"/>:<Clapperboard size={38}/>}<button type="button" className="video-cover-change" disabled={busy} onClick={()=>posterPicker.current?.click()}><ImagePlus size={15}/>{cover?'更换封面':'选择封面'}</button></div>
        <div className="video-upload-panel"><span className="video-upload-label">{video?<><Check size={16}/>原视频已收好</>:'把喜欢的镜头，放在这里'}</span>{video&&<p>{videoDuration(video.duration)}{video.width&&video.height?` · ${video.width} × ${video.height}`:''}</p>}<button type="button" className="button secondary" disabled={busy} onClick={()=>picker.current?.click()}><Upload size={16}/>{video?'更换视频':'选择视频'}</button><p className="muted">MP4、WebM · 最多 100 MB</p>{uploading&&<div className="video-upload-status" role="status"><LoaderCircle size={15} className="spin"/><span>{uploading}{progress!==null?` ${progress}%`:''}</span></div>}{progress!==null&&<progress max={100} value={progress} aria-label="视频上传进度"/>}</div>
      </div>
      <label>作品标题<input aria-label="作品标题" value={title} required maxLength={160} disabled={busy} placeholder="给这段剪辑起一个名字" onChange={event=>setTitle(event.target.value)}/></label>
      <label>作品简介<textarea aria-label="作品简介" value={body} rows={4} maxLength={50000} disabled={busy} placeholder="镜头、音乐，或剪这段视频时想留下的话…" onChange={event=>setBody(event.target.value)}/></label>
      <div className="video-editor-fields"><label>分类<input aria-label="视频分类" value={category} maxLength={40} disabled={busy} placeholder="K-pop、旅行、日常…" onChange={event=>setCategory(event.target.value)}/></label><label>标签<input aria-label="视频标签" value={tags} disabled={busy} placeholder="用逗号分开，例如：Jisoo，舞台" onChange={event=>setTags(event.target.value)}/></label></div>
      <label>谁可以看<ThemeSelect ariaLabel="视频可见范围" value={visibility} onChange={value=>setVisibility(value as Visibility)} disabled={busy} options={[{value:'public',label:'公开'},{value:'private',label:'仅自己'}]}/></label>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={close}>取消</button><button className="button primary" disabled={busy}>{saving?<><LoaderCircle size={15} className="spin"/>正在保存…</>:'保存作品'}</button></div>
    </form>
  </Modal>{discard&&<Modal title="这份作品还没保存" onClose={()=>setDiscard(false)}><p>关闭后，这次编辑的标题、简介和设置不会保存。</p><div className="form-actions"><button className="button secondary" onClick={()=>setDiscard(false)}>继续编辑</button><button className="button primary" onClick={onClose}>放弃修改</button></div></Modal>}</>;
}
