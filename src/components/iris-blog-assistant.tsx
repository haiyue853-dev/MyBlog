'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {FilePenLine,Paperclip,LoaderCircle,X,Square} from 'lucide-react';
import {api,errorMessage,fileUrl} from '@/lib/client';
import {uploadPhoto} from '@/lib/upload-photo';
import {MAX_IRIS_MATERIALS,manualBlogDraft,type IrisBlogType} from '@/lib/iris-blog';
import {browserDraftStorage} from '@/lib/editor-draft';
import {readIrisBlogWorkspace,writeIrisBlogWorkspace,type IrisMaterial} from '@/lib/iris-blog-workspace';
import type {Asset,Item} from '@/lib/types';
import {ThemeSelect} from './theme-select';
import {Editor} from './editor';
import {IrisBlogPreview} from './iris-blog-preview';
import {IrisMaterialEditor,materialImageMarkup,type IrisMaterialEditorHandle} from './iris-material-editor';
import {articleImageOccurrences} from '@/lib/article-images';

export function IrisBlogAssistant({online,onSaved}:{online:boolean;onSaved?:()=>void}){
  const [workspaceLoaded,setWorkspaceLoaded]=useState(false);
  const [message,setMessage]=useState('');const [type,setType]=useState<IrisBlogType>('article');const [materials,setMaterials]=useState<IrisMaterial[]>([]);
  const [candidate,setCandidate]=useState<Item|null>(null);const [editing,setEditing]=useState(false);const [saved,setSaved]=useState<Item|null>(null);const [retained,setRetained]=useState(true);
  const [generating,setGenerating]=useState(false);const [uploading,setUploading]=useState(false);const [error,setError]=useState('');
  const controller=useRef<AbortController|null>(null);const uploadingGuard=useRef(false);const blocked=generating||uploading||editing;
  const materialEditor=useRef<IrisMaterialEditorHandle>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{const restored=readIrisBlogWorkspace(browserDraftStorage());if(restored){let text=restored.message;for(const image of restored.materials.filter(asset=>asset.mime.startsWith('image/'))){const added='\n\n'+materialImageMarkup(image)+'\n\n';if(!articleImageOccurrences(text,[{assetId:image.id}]).length&&text.length+added.length<=10000)text+=added;}setMessage(text);setType(restored.type);setMaterials(restored.materials);setCandidate(restored.candidate);}setWorkspaceLoaded(true);},[]);
  useEffect(()=>{if(workspaceLoaded)setRetained(writeIrisBlogWorkspace(browserDraftStorage(),{message,type,materials,candidate}));},[workspaceLoaded,message,type,materials,candidate]);
  async function upload(files:File[]){
    if(!files.length||blocked||uploadingGuard.current)return;
    if(materials.length+files.length>MAX_IRIS_MATERIALS){setError('每次最多选择 10 份素材，请分批整理。');return;}
    uploadingGuard.current=true;setUploading(true);setError('');setSaved(null);
    try{
      for(const file of files){
        if(!/\.(png|jpe?g|webp|pdf|txt|md|docx|xlsx|xls)$/i.test(file.name))throw new Error('素材支持 PNG、JPG、WebP、PDF、TXT、Markdown、Word 和 Excel。');
        let material:IrisMaterial;
        if(/\.(png|jpe?g|webp)$/i.test(file.name)){const photo=await uploadPhoto(file);material={id:photo.assetId,name:file.name,mime:'image/preview'};}
        else {const form=new FormData();form.append('file',file);form.append('category','Iris 写作素材');material=(await api<{file:Asset}>('files',{method:'POST',body:form})).file;}
        if(material.mime.startsWith('image/'))materialEditor.current?.insertImages([material]);
        setMaterials(current=>[...current,material]);
      }
    }catch(error){setError(errorMessage(error));}finally{uploadingGuard.current=false;setUploading(false);}
  }
  async function generate(event:FormEvent){
    event.preventDefault();if(blocked||!online||!message.trim()||controller.current)return;
    const aborter=new AbortController();controller.current=aborter;setGenerating(true);setError('');setSaved(null);setCandidate(null);
    try{const result=await api<{candidate:Item}>('iris/blog/prepare',{method:'POST',body:JSON.stringify({message,type,assetIds:materials.map(asset=>asset.id)}),signal:aborter.signal});if(!aborter.signal.aborted){setCandidate(result.candidate);setEditing(true);}}
    catch(error){setError(aborter.signal.aborted?'整理已停止，文字和素材仍然保留。':errorMessage(error));}
    finally{controller.current=null;setGenerating(false);}
  }
  function stored(item:Item){setSaved(item);setCandidate(null);setMessage('');setMaterials([]);setError('');onSaved?.();}
  function publishOriginal(){
    if(blocked||!message.trim())return;
    setError('');setSaved(null);setCandidate(manualBlogDraft(message,type,materials));setEditing(true);
  }
  return <details className="paper iris-blog-assistant">
    <summary><FilePenLine size={18}/><span>让 Iris 帮我写博客</span><span className="muted">先预览，再确认发布</span></summary>
    <div className="iris-blog-workspace"><form className="form-stack" onSubmit={generate}>
      <label>整理成<ThemeSelect ariaLabel="选择博客内容类型" value={type} options={[{value:'article',label:'文章'},{value:'moment',label:'日常记录'}]} onChange={value=>setType(value as IrisBlogType)} disabled={blocked}/></label>
      <div className="form-stack"><label id="iris-material-editor-label">把素材和想法告诉 Iris</label><IrisMaterialEditor ref={materialEditor} value={message} materials={materials} disabled={blocked||!workspaceLoaded} onChange={value=>{setMessage(value);setMaterials(current=>current.filter(asset=>!asset.mime.startsWith('image/')||!articleImageOccurrences(message,[{assetId:asset.id}]).length||articleImageOccurrences(value,[{assetId:asset.id}]).length>0));}} onFiles={files=>void upload(files)}/></div>
      <div className="iris-blog-materials">{materials.filter(asset=>!asset.mime.startsWith('image/')||!articleImageOccurrences(message,[{assetId:asset.id}]).length).map(asset=><div className="iris-blog-material" key={asset.id}>{asset.mime.startsWith('image/')?<img src={fileUrl(asset.id,true)} alt=""/>:<Paperclip size={16}/>}<span>{asset.name}</span><button type="button" className="icon-button" aria-label={`移除素材 ${asset.name}`} disabled={blocked} onClick={()=>setMaterials(current=>current.filter(item=>item.id!==asset.id))}><X size={15}/></button></div>)}</div>
      <div className="iris-blog-composer-actions"><label className="upload-button" onPointerDown={()=>materialEditor.current?.captureSelection()}><Paperclip size={16}/>{uploading?'上传中…':'添加图片或文档'}<input type="file" aria-label="上传写作素材" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.docx,.xlsx,.xls" multiple disabled={blocked||materials.length>=MAX_IRIS_MATERIALS} onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value='';void upload(files);}}/></label><span className="muted">{materials.length} / 10 份 · 单份最多 20 MB</span>
        <button type="button" className="button secondary" disabled={blocked||!message.trim()} onClick={publishOriginal}>直接编辑并发布</button>
        {generating?<button type="button" className="button secondary" onClick={()=>controller.current?.abort()}><Square size={14}/>停止整理</button>:<button className="button primary" disabled={blocked||!online||!message.trim()}><FilePenLine size={16}/>整理成预览</button>}
      </div>
      <p className="hint">写好的图文可以直接发布或保存草稿，也可以交给 Iris 润色。文档仅作为整理素材，不随正文公开。</p>
      {!online&&<p className="muted">Iris 暂时离线，仍可直接编辑发布或保存草稿。</p>}
      {!retained&&<p className="hint">当前标签页无法暂存，请在离开前保存为博客草稿。</p>}
      {generating&&<p className="muted" role="status"><LoaderCircle size={14} className="spin"/> Iris 正在整理文字和素材…</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
    </form>
    {candidate&&<IrisBlogPreview candidate={candidate} onEdit={()=>setEditing(true)} onDiscard={()=>setCandidate(null)}/>}
    {saved&&<p className="success" role="status">{saved.status==='draft'?'已保存草稿，可以从内容管理继续编辑。':saved.visibility==='private'?'已保存为仅自己可见。':'已发布到博客。'} {saved.status!=='draft'&&<a className="text-button" href={saved.article?`/posts/${saved.id}`:'/?view=life'}>查看{saved.article?'文章':'日常'} →</a>}</p>}
    </div>{editing&&candidate&&<Editor key={candidate.id} kind="moment" assistantDraft={candidate} onAssistantDraftChange={setCandidate} onClose={()=>setEditing(false)} onSaved={stored}/>}
  </details>;
}
