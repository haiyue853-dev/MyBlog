'use client';
import {useState,type FormEvent} from 'react';
import {ImagePlus,LockKeyhole,Globe,LoaderCircle} from 'lucide-react';
import {api,errorMessage,fileUrl} from '@/lib/client';
import type {Asset,CardRatio,Item,ItemKind,Visibility} from '@/lib/types';
import {Modal} from './modal';
import {CategoryInput} from './category-input';

// 上传前先在本地量一下原图宽高，跟条目一起存下来。
// 收藏馆的瀑布流靠它算卡片高度 —— 有了它就不必等图片加载完成才能排版，
// 否则每加载一张图，下面所有卡片都会跟着跳一次。
// 量不到（浏览器解不开这张图）就返回 null，条目退回默认的 2:3。
function measureImage(file:File):Promise<{width:number;height:number}|null>{
  return new Promise(resolve=>{
    const url=URL.createObjectURL(file);const image=new Image();
    const done=(value:{width:number;height:number}|null)=>{URL.revokeObjectURL(url);resolve(value);};
    image.onload=()=>done(image.naturalWidth>0&&image.naturalHeight>0?{width:image.naturalWidth,height:image.naturalHeight}:null);
    image.onerror=()=>done(null);
    image.src=url;
  });
}

const RATIO_OPTIONS:[CardRatio,string][]=[['auto','跟随原图'],['portrait','竖版'],['landscape','横版'],['square','方形']];

export function Editor({kind,item,onClose,onSaved}:{kind:ItemKind;item?:Item;onClose:()=>void;onSaved:()=>void}){
  const [title,setTitle]=useState(item?.title||'');const [body,setBody]=useState(item?.body||'');const [category,setCategory]=useState(item?.category||(kind==='moment'?'生活':'音乐'));const [tags,setTags]=useState(item?.tags.join('，')||'');const [url,setUrl]=useState(item?.url||'');const [assetId,setAssetId]=useState(item?.assetId||null);const [visibility,setVisibility]=useState<Visibility>(item?.visibility||'private');const [cardRatio,setCardRatio]=useState<CardRatio>(item?.cardRatio||'auto');const [imageSize,setImageSize]=useState<{width:number;height:number}|null>(item?.imageWidth&&item?.imageHeight?{width:item.imageWidth,height:item.imageHeight}:null);const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState(false);const [error,setError]=useState('');
  async function upload(file?:File){if(!file)return;setError('');setUploading(true);try{const size=await measureImage(file);const form=new FormData();form.append('file',file);form.append('category','记录图片');const data=await api<{file:Asset}>('files',{method:'POST',body:form});if(!data.file.mime.startsWith('image/'))throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片。');setAssetId(data.file.id);setImageSize(size);}catch(error){setError(errorMessage(error));}finally{setUploading(false);}}
  async function submit(event:FormEvent){event.preventDefault();setError('');setBusy(true);try{if(!title.trim()&&!body.trim()&&!assetId)throw new Error('留几句话或一张照片，再保存吧。');await api(`items${item?'/'+item.id:''}`,{method:item?'PUT':'POST',body:JSON.stringify({kind,title:title.trim()||body.trim().split('\n')[0].slice(0,40)||'今天的小小记录',body,category,tags:tags.split(/[,，]/).map(v=>v.trim()).filter(Boolean),url,assetId,visibility,cardRatio,imageWidth:imageSize?.width,imageHeight:imageSize?.height})});onSaved();onClose();}catch(error){setError(errorMessage(error));}finally{setBusy(false);}}
  return <Modal title={item?'编辑这张小卡片':kind==='moment'?'记下一个小瞬间':'收好一份喜欢'} onClose={onClose} wide><form onSubmit={submit} className="form-stack"><label>小标题 <span className="muted">可留空</span><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} placeholder={kind==='moment'?'给今天起个小标题':'专辑、舞台或收藏的名字'}/></label><label>{kind==='moment'?'想留下的话':'收藏的理由'}<textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={50000} rows={6} placeholder="几句话也很好。支持简单的 Markdown 排版。"/></label><div className="form-grid"><label>分类{kind==='collection'&&<span className="muted">收藏馆里按它分组</span>}<CategoryInput value={category} onChange={setCategory}/></label><label>标签<input value={tags} onChange={e=>setTags(e.target.value)} placeholder="K-pop，日常"/></label></div>{kind==='collection'&&<label>收藏链接 <span className="muted">可选</span><input value={url} onChange={e=>setUrl(e.target.value)} type="url" placeholder="https://…" maxLength={2000}/></label>}<div className="image-picker">{assetId&&<div className="image-preview"><img src={fileUrl(assetId,true)} alt="记录配图"/><button type="button" className="text-button" onClick={()=>{setAssetId(null);setImageSize(null);}}>移除配图</button></div>}<label className="upload-button"><ImagePlus size={17}/>{uploading?'图片上传中…':'选一张图片'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={e=>void upload(e.target.files?.[0])} disabled={uploading}/></label></div>{kind==='collection'&&<fieldset className="ratio-picker"><legend>卡片形状 <span className="muted">收藏馆里按它排布</span></legend>{RATIO_OPTIONS.map(([value,label])=><label key={value}><input type="radio" name="card-ratio" checked={cardRatio===value} onChange={()=>setCardRatio(value)}/>{label}</label>)}</fieldset>}{kind==='collection'&&cardRatio==='auto'&&<p className="hint">{imageSize?`按原图比例显示（原图 ${imageSize.width} × ${imageSize.height}）`:'按原图比例显示；没量到尺寸时用竖版 2:3。'}</p>}<fieldset className="visibility-picker"><legend>谁可以看见？</legend><label><input type="radio" name="visibility" checked={visibility==='private'} onChange={()=>setVisibility('private')}/><LockKeyhole size={16}/>仅自己</label><label><input type="radio" name="visibility" checked={visibility==='public'} onChange={()=>setVisibility('public')}/><Globe size={16}/>公开给访客</label></fieldset>{visibility==='public'&&<p className="hint">保存为公开后，这段文字和配图都能被访客看见。</p>}{error&&<p role="alert" className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={busy||uploading}>{busy&&<LoaderCircle size={16} className="spin"/>}{busy?'保存中…':'保存小卡片'}</button></div></form></Modal>;
}
