'use client';
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Bold,Italic,Eye,Pencil,Code2,List,ListOrdered,Quote,ImagePlus,Check,IndentIncrease,LoaderCircle} from 'lucide-react';
import {formatHeading,formatInline,formatCodeBlock,formatBlock,continueBlock,insertTextIndent,headingLevel,type HeadingLevel,type InlineStyle,type BlockStyle,type TextEdit} from '@/lib/text-format';
import {RecordBody} from './record-body';
import {ThemeSelect} from './theme-select';
import {Modal} from './modal';
import {formatArticleImage,articleImageOccurrences,updateArticleImage,type ArticleImageOccurrence,type ArticleImageWidth} from '@/lib/article-images';
import {ArticleImageControls,ArticleImageSizePreview} from './article-image-controls';
import {errorMessage,fileUrl} from '@/lib/client';
import type {ItemImage} from '@/lib/types';
import {IrisMaterialEditor,type IrisMaterialEditorHandle} from './iris-material-editor';

const MAX_LENGTH=50000;

export function TextEditor({label,value,onChange,disabled=false,article=false,images=[],onImageUpload,initialPreview=false,previewVersion=0}:{label:string;value:string;onChange:(value:string)=>void;disabled?:boolean;article?:boolean;images?:ItemImage[];onImageUpload?:(file:File)=>Promise<ItemImage>;initialPreview?:boolean;previewVersion?:number}){
  const id=useId();const input=useRef<HTMLTextAreaElement>(null);
  const visual=article||images.length>0||!!onImageUpload;const richInput=useRef<IrisMaterialEditorHandle>(null);
  const pending=useRef<TextEdit|null>(null);
  const [selection,setSelection]=useState({start:0,end:0});
  const [preview,setPreview]=useState(initialPreview);const [error,setError]=useState('');
  useEffect(()=>{if(previewVersion)setPreview(true);},[previewVersion]);
  const [codeOpen,setCodeOpen]=useState(false);const [code,setCode]=useState('');const [language,setLanguage]=useState('');const codeRange=useRef({start:0,end:0});
  const [imageOpen,setImageOpen]=useState(false);const [imageId,setImageId]=useState('');const [caption,setCaption]=useState('');const [imageWidth,setImageWidth]=useState<ArticleImageWidth>('normal');const imageOffset=useRef(0);
  const [imageUploading,setImageUploading]=useState(false);const [imageError,setImageError]=useState('');const imageUploadGuard=useRef(false);
  const editingImage=useRef<ArticleImageOccurrence|null>(null);
  const occurrences=useMemo(()=>articleImageOccurrences(value,images),[value,images]);
  useLayoutEffect(()=>{
    const edit=pending.current;if(!edit||!input.current)return;
    pending.current=null;input.current.focus();input.current.setSelectionRange(edit.start,edit.end);
    setSelection({start:edit.start,end:edit.end});
  },[value]);
  function apply(edit:TextEdit){
    if(disabled||preview)return;
    if(edit.text.length>MAX_LENGTH){setError('文字已达到长度上限，请删减一些内容后再设置格式。');return;}
    setError('');
    if(visual){richInput.current?.applyEdit(edit);return;}
    if(edit.text===value){input.current?.focus();input.current?.setSelectionRange(edit.start,edit.end);return;}
    pending.current=edit;onChange(edit.text);
  }
  function selectedRange(){return visual?richInput.current?.getSelection()??selection:{start:input.current?.selectionStart??selection.start,end:input.current?.selectionEnd??selection.end};}
  function inline(style:InlineStyle){const range=selectedRange();apply(formatInline(value,range.start,range.end,style));}
  function heading(level:HeadingLevel){const range=selectedRange();apply(formatHeading(value,range.start,range.end,level));}
  function block(style:BlockStyle){const range=selectedRange();apply(formatBlock(value,range.start,range.end,style));}
  function indent(){const range=selectedRange();apply(insertTextIndent(value,range.start,range.end));}
  function openCode(){codeRange.current=selectedRange();setCode(value.slice(codeRange.current.start,codeRange.current.end));setError('');setCodeOpen(true);}
  function insertCode(){if(!code.trim())return;const edit=formatCodeBlock(value,codeRange.current.start,codeRange.current.end,code,language);if(edit.text.length>MAX_LENGTH){setError('文字已达到长度上限，请删减后再插入。');return;}apply(edit);setCodeOpen(false);setCode('');}
  function openImage(){editingImage.current=null;imageOffset.current=selectedRange().end;setImageId('');setCaption('');setImageWidth('normal');setError('');setImageError('');setImageOpen(true);}
  function editImage(occurrence:ArticleImageOccurrence){editingImage.current=occurrence;setImageId(occurrence.image.assetId);setCaption(occurrence.caption);setImageWidth(occurrence.width);setError('');setImageError('');setImageOpen(true);}
  async function uploadInline(file:File){
    if(!onImageUpload||disabled||imageUploadGuard.current)return;
    imageUploadGuard.current=true;setImageUploading(true);setImageError('');
    try{const image=await onImageUpload(file);setImageId(image.assetId);}catch(error){setImageError(errorMessage(error));}
    finally{imageUploadGuard.current=false;setImageUploading(false);}
  }
  async function uploadVisual(files:File[]){
    if(disabled||imageUploadGuard.current||!onImageUpload)return;
    imageUploadGuard.current=true;setImageUploading(true);setError('');
    try{for(const file of files){if(!/^image\/(png|jpeg|gif|webp)$/.test(file.type))throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片。');const image=await onImageUpload(file);richInput.current?.insertImages([{id:image.assetId,name:file.name,mime:file.type}]);}}
    catch(error){setError(errorMessage(error));}finally{imageUploadGuard.current=false;setImageUploading(false);}
  }
  function insertImage(){
    if(disabled||imageUploading||!images.some(image=>image.assetId===imageId))return;
    try{const edit=editingImage.current?updateArticleImage(value,editingImage.current,caption,imageWidth):formatArticleImage(value,imageOffset.current,imageId,caption,imageWidth);
      if(edit.text.length>MAX_LENGTH){setImageError('文字已达到长度上限，请删减后再设置图片。');return;}
      apply(edit);setImageOpen(false);
    }catch(error){setImageError(errorMessage(error));}
  }
  return <div className="text-editor">
    <label htmlFor={id}>{label}</label>
    <div className="text-editor-surface">
      <div className="text-editor-tools" role="group" aria-label="文字排版">
        <button type="button" className="text-format-button" aria-label="加粗" title="加粗（Ctrl / ⌘ + B）" disabled={disabled||preview} onPointerDown={event=>event.preventDefault()} onClick={()=>inline('bold')}><Bold size={16}/></button>
        <button type="button" className="text-format-button" aria-label="斜体" title="斜体（Ctrl / ⌘ + I）" disabled={disabled||preview} onPointerDown={event=>event.preventDefault()} onClick={()=>inline('italic')}><Italic size={16}/></button>
        <button type="button" className="text-format-button" aria-label="空两格" title="空两格（Tab）" disabled={disabled||preview} onPointerDown={event=>event.preventDefault()} onClick={indent}><IndentIncrease size={17}/></button>
        <ThemeSelect ariaLabel="字号与小标题" className="text-heading-select" value={String(headingLevel(value,selection.start))} disabled={disabled||preview} onChange={value=>heading(Number(value) as HeadingLevel)} options={[{value:'0',label:'正文'},{value:'3',label:'小标题'},{value:'2',label:'中标题'},{value:'1',label:'大标题'}]}/>
        <button type="button" className="text-format-button" aria-label="圆点列表" title="圆点列表" disabled={disabled||preview} onPointerDown={event=>event.preventDefault()} onClick={()=>block('bullet')}><List size={17}/></button>
        <button type="button" className="text-format-button" aria-label="编号列表" title="编号列表" disabled={disabled||preview} onPointerDown={event=>event.preventDefault()} onClick={()=>block('number')}><ListOrdered size={17}/></button>
        <button type="button" className="text-format-button" aria-label="引用" title="引用" disabled={disabled||preview} onPointerDown={event=>event.preventDefault()} onClick={()=>block('quote')}><Quote size={16}/></button>
        <button type="button" className="text-format-button" aria-label="插入代码块" title="插入代码块" disabled={disabled||preview} onClick={openCode}><Code2 size={17}/></button>
        {visual&&<button type="button" className="text-format-button" aria-label="插入正文图片" title="插入正文图片" disabled={disabled||preview} onClick={openImage}><ImagePlus size={17}/></button>}
        <button type="button" className="text-preview-button" aria-pressed={preview} disabled={disabled} onClick={()=>setPreview(!preview)}>{preview?<Pencil size={15}/>:<Eye size={15}/>}<span>{preview?'返回编辑':'预览'}</span></button>
      </div>
      {visual?<div hidden={preview} className="text-editor-visual"><IrisMaterialEditor ref={richInput} id={id} ariaLabel={label} maxLength={MAX_LENGTH} value={value} materials={images.map((image,index)=>({id:image.assetId,name:`正文图片 ${index+1}`,mime:'image/preview'}))} disabled={disabled||imageUploading||preview} onChange={text=>{setError('');onChange(text);}} onFiles={files=>void uploadVisual(files)} onSelectionChange={setSelection} onKeyDown={event=>{
        if(event.nativeEvent.isComposing||(event.target as HTMLElement).closest('button,select,input'))return;
        if(event.key==='Tab'&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();indent();return;}
        if(event.key==='Enter'&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey){const range=selectedRange();const edit=continueBlock(value,range.start,range.end);if(edit){event.preventDefault();apply(edit);}return;}
        if((event.ctrlKey||event.metaKey)&&!event.altKey){const key=event.key.toLowerCase();if(key==='b'||key==='i'){event.preventDefault();inline(key==='b'?'bold':'italic');}}
      }}/></div>:<textarea id={id} ref={input} value={value} onChange={event=>{setError('');onChange(event.target.value);}} onSelect={event=>setSelection({start:event.currentTarget.selectionStart,end:event.currentTarget.selectionEnd})} onKeyDown={event=>{
        if(event.nativeEvent.isComposing)return;
        if(event.key==='Tab'&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();indent();return;}
        if(event.key==='Enter'&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey){const edit=continueBlock(value,event.currentTarget.selectionStart,event.currentTarget.selectionEnd);if(edit){event.preventDefault();apply(edit);}return;}
        if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
        const key=event.key.toLowerCase();if(key==='b'||key==='i'){event.preventDefault();inline(key==='b'?'bold':'italic');}
      }} maxLength={MAX_LENGTH} rows={6} placeholder="写下想留下的话…" disabled={disabled} hidden={preview} aria-describedby={`${id}-hint`}/>}
      {preview&&<div className={`text-editor-preview ${article?'article-body-preview':''}`} role="region" aria-label="正文预览">{value.trim()?<RecordBody body={value} images={images}/>:<p className="muted">写几句话，再看看排版效果。</p>}</div>}
    </div>
    {!preview&&<ArticleImageControls occurrences={occurrences} disabled={disabled} onEdit={editImage}/>}
    <p id={`${id}-hint`} className="text-editor-hint">Tab 或“空两格”按钮插入两格缩进，Shift + Tab 切换焦点；列表中按 Enter 继续，空白项再按 Enter 结束。</p>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {imageOpen&&<Modal title={editingImage.current?'调整正文图片':'插入正文图片'} onClose={()=>{if(!imageUploading)setImageOpen(false);}} closeOnBackdrop={false} wide><div className="form-stack article-image-form">
      {onImageUpload&&!editingImage.current&&<label className="article-inline-upload"><ImagePlus size={24}/><strong>{imageUploading?'正在上传图片…':'从电脑或相册选择图片'}</strong><span>JPG、PNG、WebP、GIF · 上传后插入光标位置</span><input aria-label="选择正文图片" type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={disabled||imageUploading} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void uploadInline(file);}}/></label>}
      {imageUploading&&<p role="status" className="muted"><LoaderCircle size={14} className="spin"/>图片上传中，请稍等。</p>}
      {images.length>0&&!editingImage.current&&<details className="article-image-reuse"><summary>也可以使用已选图片 · {images.length} 张</summary><div className="article-image-choices" role="group" aria-label="选择正文照片">{images.map((image,index)=><button type="button" key={image.assetId} disabled={disabled||imageUploading} className={imageId===image.assetId?'is-selected':''} aria-label={`选择第 ${index+1} 张照片`} aria-pressed={imageId===image.assetId} onClick={()=>setImageId(image.assetId)}><img src={fileUrl(image.assetId,true)} alt={`文章照片 ${index+1}`}/><span>{imageId===image.assetId&&<Check size={13}/>}照片 {index+1}</span></button>)}</div></details>}
      <label>图片说明 <span className="muted">可选</span><input value={caption} disabled={disabled||imageUploading} onChange={event=>setCaption(event.target.value)} maxLength={200} placeholder="给这张照片留一句话…"/></label>
      <ArticleImageSizePreview image={images.find(image=>image.assetId===imageId)} caption={caption} width={imageWidth} onChange={setImageWidth} disabled={disabled||imageUploading}/>
      {(imageError||error)&&<p className="form-error" role="alert">{imageError||error}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={imageUploading} onClick={()=>setImageOpen(false)}>取消</button><button type="button" className="button primary" disabled={!imageId||disabled||imageUploading} onClick={insertImage}>{editingImage.current?'保存图片设置':'插入正文'}</button></div>
    </div></Modal>}
    {codeOpen&&<Modal title="插入代码块" onClose={()=>setCodeOpen(false)} closeOnBackdrop={false} wide><div className="form-stack code-block-form"><label>代码语言<ThemeSelect ariaLabel="代码语言" value={language} onChange={setLanguage} options={[{value:'',label:'纯文本'},{value:'js',label:'JavaScript'},{value:'ts',label:'TypeScript'},{value:'python',label:'Python'},{value:'html',label:'HTML'},{value:'css',label:'CSS'},{value:'json',label:'JSON'},{value:'sql',label:'SQL'},{value:'bash',label:'Shell'}]}/></label><label>代码内容<textarea value={code} onChange={event=>setCode(event.target.value)} rows={10} maxLength={MAX_LENGTH} spellCheck={false} autoCapitalize="off" autoCorrect="off" placeholder="把代码粘贴到这里，缩进会原样保留"/></label>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" onClick={()=>setCodeOpen(false)}>取消</button><button type="button" className="button primary" disabled={!code.trim()||disabled} onClick={insertCode}>插入正文</button></div></div></Modal>}
  </div>;
}
