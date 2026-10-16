'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Check,Globe,ImagePlus,LoaderCircle,LockKeyhole,X} from 'lucide-react';
import {api} from '@/lib/client';
import {MAX_COLLECTION_BATCH,saveCollectionBatch,type CollectionBatchEntry} from '@/lib/collection-batch';
import {uploadPhoto} from '@/lib/upload-photo';
import type {Visibility} from '@/lib/types';
import {Modal} from './modal';
import {CategoryInput} from './category-input';
import {CollectionTagInput} from './collection-tag-input';

export function CollectionBatch({onClose,onSaved,initialCategory='',categories=[]}:{onClose:()=>void;onSaved:()=>void;initialCategory?:string;categories?:string[]}){
  const [entries,setEntries]=useState<CollectionBatchEntry[]>([]);
  const [category,setCategory]=useState(initialCategory);const [tags,setTags]=useState('');
  const [visibility,setVisibility]=useState<Visibility>('private');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const previews=useRef<string[]>([]);const saving=useRef(false);
  useEffect(()=>()=>{for(const url of previews.current)URL.revokeObjectURL(url);},[]);
  const pending=entries.filter(entry=>entry.state!=='saved').length;
  const completed=entries.length-pending;
  function close(){if(!saving.current)onClose();}
  function choose(files:File[]){
    if(!files.length||busy)return;setError('');
    if(entries.length+files.length>MAX_COLLECTION_BATCH){setError(`一次最多上传 ${MAX_COLLECTION_BATCH} 张照片，请少选几张。`);return;}
    if(files.some(file=>!(/\.(png|jpe?g|webp|gif)$/i.test(file.name)))){setError('请选择 JPG、PNG、WebP 或 GIF 图片。');return;}
    const additions=files.map(file=>{
      const previewUrl=URL.createObjectURL(file);previews.current.push(previewUrl);
      return {key:crypto.randomUUID(),file,previewUrl,title:file.name.replace(/\.[^.]+$/,'').slice(0,160)||'收藏照片',state:'ready' as const};
    });setEntries(current=>[...current,...additions]);
  }
  async function submit(event:FormEvent){
    event.preventDefault();if(saving.current||!pending)return;setError('');
    if(!category.trim()){setError('请填写人物或分组名称，例如 Jisoo。这个名称会显示在卡片上。');return;}
    const values=tags.split(/[,，]/).map(value=>value.trim()).filter(Boolean);
    if(values.length>10||values.some(value=>value.length>30)){setError('标签最多 10 个，每个最多 30 字。');return;}
    if(entries.some(entry=>entry.state!=='saved'&&!entry.title.trim())){setError('请给每张照片填写一个标题。');return;}
    saving.current=true;setBusy(true);
    try{
      const result=await saveCollectionBatch(entries,{category,tags:values,visibility},{upload:uploadPhoto,
        save:input=>api('items',{method:'POST',body:JSON.stringify(input)}),
        onUpdate:entry=>setEntries(current=>current.map(value=>value.key===entry.key?entry:value)),
      });
      if(result.created)onSaved();
      if(result.failed)setError(`已保存 ${result.saved} 份收藏，${result.failed} 份未完成。重试时只处理未完成的照片。`);
      else onClose();
    }finally{saving.current=false;setBusy(false);}
  }
  return <Modal title="批量收好喜欢的照片" onClose={close} closeOnBackdrop={false} wide><form className="form-stack" onSubmit={submit}>
    <p className="muted">每张照片会生成一张独立收藏卡片，标题默认使用文件名，也可以分别修改。</p>
    <fieldset className="batch-collection-fields" disabled={busy}><div className="form-grid"><label>人物／分组<CategoryInput value={category} onChange={setCategory} suggestions={categories} includeDefaults={false}/></label><CollectionTagInput value={tags} onChange={setTags} disabled={busy}/></div></fieldset>
    <p className="hint">人物／分组会显示在每张卡片的角标上，也用于筛选；可以选择已有名称，或直接输入 Jisoo 等新名称。</p>
    <div className="diary-photo-heading"><span>这次想收藏的照片</span><span className="muted">{entries.length} / {MAX_COLLECTION_BATCH} 张</span></div>
    {entries.length>0&&<ol className="batch-collection-grid">{entries.map(entry=><li className="batch-collection-photo" key={entry.key}>
      <div className="diary-photo-image"><img src={entry.previewUrl} alt={entry.title}/>{entry.state==='saved'?<span className="batch-photo-saved"><Check size={14}/>已保存</span>:<button type="button" className="diary-photo-remove" aria-label={`移除 ${entry.title}`} disabled={busy} onClick={()=>setEntries(current=>current.filter(value=>value.key!==entry.key))}><X size={14}/></button>}</div>
      <label>收藏标题<input aria-label={`收藏标题 ${entry.file.name}`} value={entry.title} maxLength={160} disabled={busy||entry.state==='saved'} onChange={event=>setEntries(current=>current.map(value=>value.key===entry.key?{...value,title:event.target.value}:value))}/></label>
      {entry.state==='uploading'&&<span className="batch-photo-status" role="status"><LoaderCircle size={13} className="spin"/>正在上传并保存…</span>}
      {entry.error&&<p className="batch-photo-error">{entry.error}</p>}
    </li>)}</ol>}
    <label className={`diary-photo-upload ${busy||entries.length===MAX_COLLECTION_BATCH?'is-disabled':''}`}><ImagePlus size={23}/><span>{entries.length?'继续选择照片':'选择多张收藏照片'}</span><small>每张照片单独展示 · 一次最多 {MAX_COLLECTION_BATCH} 张</small><input type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" aria-label="批量选择收藏照片" disabled={busy||entries.length===MAX_COLLECTION_BATCH} onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value='';choose(files);}}/></label>
    <fieldset className="visibility-picker" disabled={busy}><legend>这些收藏谁可以看见？</legend><label><input type="radio" name="batch-visibility" checked={visibility==='private'} onChange={()=>setVisibility('private')}/><LockKeyhole size={16}/>仅自己</label><label><input type="radio" name="batch-visibility" checked={visibility==='public'} onChange={()=>setVisibility('public')}/><Globe size={16}/>公开给访客</label></fieldset>
    {visibility==='public'&&<p className="hint">保存后，这批收藏和照片都能被访客看见。</p>}
    {busy&&<p className="diary-photo-tip" role="status">已保存 {completed} / {entries.length} 份收藏，完成后即可关闭。</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button secondary" onClick={close} disabled={busy}>取消</button><button className="button primary" disabled={busy||!pending}>{busy&&<LoaderCircle size={15} className="spin"/>}{busy?'正在收好照片…':completed?`重试剩余 ${pending} 份收藏`:`保存 ${pending} 份收藏`}</button></div>
  </form></Modal>;
}
