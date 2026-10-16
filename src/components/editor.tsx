'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ImagePlus,LockKeyhole,Globe,LoaderCircle} from 'lucide-react';
import {errorMessage,fileUrl} from '@/lib/client';
import {saveEditorItem} from '@/lib/editor-save';
import {uploadPhoto} from '@/lib/upload-photo';
import {browserDraftStorage,clearEditorDraft,editorDraftChanged,initialEditorDraft,readEditorDraft,writeEditorDraft,type EditorDraft} from '@/lib/editor-draft';
import type {CardRatio,Item,ItemImage,ItemKind,Visibility} from '@/lib/types';
import {Modal} from './modal';
import {CategoryInput} from './category-input';
import {DiaryPhotos} from './diary-photos';
import {MAX_DIARY_IMAGES,appendItemPhoto} from '@/lib/item-images';
import {articleImageOccurrences} from '@/lib/article-images';
import {CollectionTagInput} from './collection-tag-input';
import {TextEditor} from './text-editor';
import {ArticleFields} from './article-fields';
import {CoverEditor} from './article-cover-editor';
import {ARTICLE_CATEGORIES,newArticle} from '@/lib/articles';
import {newWatch} from '@/lib/watch-collection';
import {WatchFields} from './watch-fields';
import {WatchTagInput} from './watch-tag-input';
import {IrisBlogRevision} from './iris-blog-revision';

const RATIO_OPTIONS:[CardRatio,string][]=[['auto','跟随原图'],['portrait','竖版'],['landscape','横版'],['square','方形']];

export function Editor({kind,item,assistantDraft,onAssistantDraftChange,onClose,onSaved,categories=[],initialCategory='',articlePages=true,initialArticle=false,initialReview=false,initialWatch=false,reviews=[]}:{kind:ItemKind;item?:Item;assistantDraft?:Item;onAssistantDraftChange?:(draft:Item)=>void;onClose:()=>void;onSaved:(saved:Item)=>void;categories?:string[];initialCategory?:string;articlePages?:boolean;initialArticle?:boolean;initialReview?:boolean;initialWatch?:boolean;reviews?:Item[]}){
  const draftId=item?.id||assistantDraft?.id||(initialWatch?'new-watch':initialReview?'new-review':initialArticle?'new-article':undefined);
  const [original]=useState(()=>{const initial=initialEditorDraft(kind,item||assistantDraft,initialCategory);if(assistantDraft)return initial;if(!item&&kind==='collection'&&initialWatch)return {...initial,watch:newWatch(),category:'韩剧',visibility:'public' as const,cardRatio:'portrait' as const};return !item&&kind==='moment'&&(initialArticle||initialReview)?{...initial,article:newArticle(),articleMode:true,writingType:initialReview?'review' as const:'article' as const,category:initialReview?'观后感':initialCategory||'日常'}:initial;});
  const [cached]=useState(()=>readEditorDraft(browserDraftStorage(),kind,draftId));
  const first=cached?{...cached,...(cached.watch&&original.watch?{watch:{...original.watch,...cached.watch}}:{})}:original;
  const [title,setTitle]=useState(first.title);
  const [watch,setWatch]=useState(first.watch);
  const [body,setBody]=useState(first.body);
  const [article,setArticle]=useState(first.article);
  const [articleMode,setArticleMode]=useState(first.articleMode);
  const [reviewMode,setReviewMode]=useState(first.writingType==='review'||!first.writingType&&!!first.article&&['观后感','读后感'].includes(first.category));
  const [pinned,setPinned]=useState(first.pinned);
  const [status]=useState(first.status);
  const [category,setCategory]=useState(first.category==='读后感'?'观后感':first.category);
  const [tags,setTags]=useState(first.tags);
  const [url,setUrl]=useState(first.url);
  const [assetId,setAssetId]=useState(first.assetId);
  const [coverCrop,setCoverCrop]=useState(first.coverCrop);
  const [photos,setPhotos]=useState<ItemImage[]>(first.photos);
  const [visibility,setVisibility]=useState<Visibility>(first.visibility);
  const [cardRatio,setCardRatio]=useState<CardRatio>(first.cardRatio);
  const cover=photos.find(image=>image.assetId===assetId);
  const [imageSize,setImageSize]=useState(first.imageSize);
  const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState(false);const [error,setError]=useState('');
  const [revising,setRevising]=useState(false);const [previewVersion,setPreviewVersion]=useState(0);
  const [closing,setClosing]=useState(false);const [draftStored,setDraftStored]=useState<boolean|null>(null);
  const draft:EditorDraft={watch,title,body,category,tags,url,assetId,photos,visibility,cardRatio,imageSize,article,articleMode,status,pinned,writingType:article?(reviewMode?'review':'article'):undefined,...(coverCrop?{coverCrop}:{})};
  const encoded=JSON.stringify(draft);const dirty=editorDraftChanged(original,draft);
  useEffect(()=>{
    const storage=browserDraftStorage();
    if(dirty)setDraftStored(writeEditorDraft(storage,kind,draftId,draft));
    else{clearEditorDraft(storage,kind,draftId);setDraftStored(null);}
    // Content changes drive this effect, rather than the new object on each render.
  },[encoded,dirty,kind,draftId]);
  function close(){if(busy||uploading||revising)return;if(dirty)setClosing(true);else onClose();}
  function applyRevision(next:EditorDraft){
    setTitle(next.title);setBody(next.body);setCategory(next.category);setTags(next.tags);setUrl(next.url);setAssetId(next.assetId);setCoverCrop(next.coverCrop);setPhotos(next.photos);setVisibility(next.visibility);setCardRatio(next.cardRatio);setImageSize(next.imageSize);setArticle(next.article);setArticleMode(next.articleMode);setReviewMode(next.writingType==='review');setPinned(next.pinned);setPreviewVersion(value=>value+1);
    syncAssistantDraft(next);
  }
  function syncAssistantDraft(next:EditorDraft){
    if(assistantDraft)onAssistantDraftChange?.({...assistantDraft,title:next.title,body:next.body,category:next.category,tags:next.tags.split(/[,，]/).map(tag=>tag.trim()).filter(Boolean),url:next.url,assetId:next.assetId,images:next.photos,coverCrop:next.coverCrop,visibility:next.visibility,cardRatio:next.cardRatio,article:next.articleMode?next.article:null,pinned:next.pinned,writingType:next.writingType});
  }
  function keepAndClose(){
    if(busy||uploading||revising)return;
    if(!writeEditorDraft(browserDraftStorage(),kind,draftId,draft)){setError('草稿暂存失败，请先保存内容，再关闭窗口。');return;}
    onClose();
  }
  function discard(){
    if(busy||uploading||revising)return;
    if(!clearEditorDraft(browserDraftStorage(),kind,draftId)){setError('无法清除草稿，请稍后重试。');return;}
    if(assistantDraft)clearEditorDraft(browserDraftStorage(),kind,`${draftId}:iris-before`);
    syncAssistantDraft(original);
    onClose();
  }

  async function upload(file?:File){
    if(!file||busy||uploading||revising)return;setError('');setUploading(true);
    try{const photo=await uploadPhoto(file);setAssetId(photo.assetId);setImageSize(photo.width&&photo.height?{width:photo.width,height:photo.height}:null);}
    catch(error){setError(errorMessage(error));}finally{setUploading(false);}
  }

  function changePhotos(images:ItemImage[],coverId:string|null){
    setPhotos(images);if(coverId!==assetId){setCoverCrop(undefined);setArticle(current=>{if(!current)return current;const next={...current,coverPosition:'center' as const};delete next.coverCrop;return next;});}setAssetId(coverId);
  }
  async function uploadArticlePhoto(file:File,asCover=false){
    if(busy||uploading||revising)throw new Error('请等当前操作完成。');
    setUploading(true);setError('');
    try{
      const ids=[...new Set([...articleImageOccurrences(body,photos).map(occurrence=>occurrence.image.assetId),...photos.map(photo=>photo.assetId)])];
      const photo=await uploadPhoto(file,ids,photos.length>=MAX_DIARY_IMAGES);setPhotos(current=>appendItemPhoto(current,photo));
      if(asCover&&assetId!==photo.assetId){setAssetId(photo.assetId);setCoverCrop(undefined);setArticle(current=>{if(!current)return current;const next={...current,coverPosition:'center' as const};delete next.coverCrop;return next;});}
      return photo;
    }finally{setUploading(false);}
  }

  async function submit(event:FormEvent){
    event.preventDefault();if(busy||uploading||revising)return;setError('');setBusy(true);
    try{
      const savingDraft=kind==='moment'&&(event.nativeEvent as SubmitEvent).submitter?.getAttribute('data-status')==='draft';
      if(articleMode&&!savingDraft&&!title.trim())throw new Error(reviewMode?'请给观后感写一个标题。':'请给文章写一个标题。');
      if(!title.trim()&&!body.trim()&&!assetId)throw new Error('留几句话或一张照片，再保存吧。');
      if(watch&&!title.trim())throw new Error('请填写剧名或片名。');
      if(kind==='collection'&&!watch&&!category.trim())throw new Error('请填写人物或分组名称，例如 Jisoo。');
      const saved=await saveEditorItem({
        kind,watch,title:title.trim()||(articleMode?'未命名'+(reviewMode?'观后感':'文章'):body.trim().split('\n')[0].slice(0,40)||'今天的小小记录'),body,category:watch?.type||category,article:articleMode?article:null,status:savingDraft?'draft':'published',pinned:articleMode&&!savingDraft&&pinned,writingType:articleMode?(reviewMode?'review':'article'):undefined,
        tags:tags.split(/[,，]/).map(v=>v.trim()).filter(Boolean),url,assetId,visibility,cardRatio,coverCrop:kind==='moment'&&assetId?coverCrop||(!articleMode?{x:50,y:50,zoom:1}:undefined):undefined,
        images:kind==='moment'?photos:undefined,imageWidth:kind==='moment'?cover?.width:imageSize?.width,imageHeight:kind==='moment'?cover?.height:imageSize?.height,
      },item?.id,assistantDraft?.id);clearEditorDraft(browserDraftStorage(),kind,draftId);if(assistantDraft)clearEditorDraft(browserDraftStorage(),kind,`${draftId}:iris-before`);onSaved(saved);onClose();
    }catch(error){setError(errorMessage(error));}finally{setBusy(false);}
  }

  return <><Modal title={assistantDraft?'预览并发布内容':watch?(item?'编辑影视记录':'收好一部喜欢的影视'):articleMode?(reviewMode?(item?'编辑这篇观后感':'写下自己的观后感'):(item?'编辑这篇文章':'写下自己的故事')):item?'编辑这张小卡片':kind==='moment'?'记下一个小瞬间':'收好一份喜欢'} onClose={close} closeOnBackdrop={false} wide className={articleMode?'article-editor':''}>
    <form onSubmit={submit} className="form-stack">
      {cached&&<p className="success" role="status">已恢复这条记录未保存的草稿。</p>}
      {assistantDraft&&<IrisBlogRevision draft={draft} draftId={assistantDraft.id} disabled={busy||uploading} onApply={applyRevision} onBusyChange={setRevising}/>}
      <fieldset className="form-stack editor-fields" disabled={busy||revising} aria-label="编辑内容">
      {kind==='moment'&&articlePages&&<fieldset className="visibility-picker"><legend>记录方式</legend><label><input type="radio" name="record-mode" checked={!articleMode} onChange={()=>setArticleMode(false)}/>日常记录</label><label><input type="radio" name="record-mode" checked={articleMode&&!reviewMode} onChange={()=>{setArticle(article||newArticle());setArticleMode(true);setReviewMode(false);if(category==='观后感'||category==='生活'||!category)setCategory('日常');}}/>文章</label><label><input type="radio" name="record-mode" checked={articleMode&&reviewMode} onChange={()=>{setArticle(article||newArticle());setArticleMode(true);setReviewMode(true);setCategory('观后感');}}/>观后感</label></fieldset>}
      <label>{watch?'剧名／片名':articleMode?(reviewMode?'观后感标题':'文章标题'):'小标题'} {!articleMode&&!watch&&<span className="muted">可留空</span>}<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} required={!!watch} placeholder={watch?'例如：爱情怎么翻译':articleMode?'给这篇文章起一个名字':kind==='moment'?'给今天起个小标题':'专辑、舞台或收藏的名字'}/></label>
      {watch&&<WatchFields value={watch} onChange={setWatch} reviews={reviews} disabled={busy||uploading}/>}
      <TextEditor label={watch?'个人感受（仅自己可见）':kind==='moment'?'想留下的话':kind==='collection'?'收藏的理由（仅自己可见）':'收藏的理由'} value={body} onChange={setBody} disabled={busy||uploading||revising} article={articleMode} images={kind==='moment'?photos:[]} onImageUpload={kind==='moment'?file=>uploadArticlePhoto(file):undefined} initialPreview={!!assistantDraft} previewVersion={previewVersion}/>
      {watch?<WatchTagInput value={tags} onChange={setTags} disabled={busy||uploading||revising}/>:<div className="form-grid"><label>{kind==='collection'?'人物／分组':'分类'}{kind==='collection'&&<span className="muted">显示在卡片上，也用于筛选</span>}<CategoryInput value={category} onChange={setCategory} suggestions={kind==='collection'?categories:articleMode?ARTICLE_CATEGORIES:[]} includeDefaults={!articleMode&&kind!=='collection'}/></label>{kind==='collection'?<CollectionTagInput value={tags} onChange={setTags} disabled={busy}/>:<label>标签<input value={tags} onChange={e=>setTags(e.target.value)} placeholder={articleMode?'电影，读书，旅行…':'K-pop，日常'}/></label>}</div>}
      {articleMode&&article&&<ArticleFields value={article} onChange={setArticle} coverId={assetId} coverTitle={title} disabled={busy||uploading} coverControls={<div className="article-cover-source"><span>文章封面 <span className="muted">可选</span></span><div className="image-picker"><label className="upload-button"><ImagePlus size={16}/>{uploading?'图片上传中…':assetId?'更换封面图片':'选择封面图片'}<input aria-label="选择文章封面" type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={busy||uploading} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void uploadArticlePhoto(file,true).catch(error=>setError(errorMessage(error)));}}/></label>{assetId&&<button className="text-button" type="button" disabled={busy||uploading} onClick={()=>changePhotos(photos,null)}>移除封面</button>}</div></div>}/>}
      {kind==='collection'&&<label>收藏链接 <span className="muted">可选</span><input value={url} onChange={e=>setUrl(e.target.value)} type="url" placeholder="https://…" maxLength={2000}/></label>}
      {kind==='moment'?(articleMode?<details className="article-attachment-manager"><summary>整理已选图片 · {photos.length} 张</summary><DiaryPhotos images={photos} coverId={assetId} onChange={changePhotos} onUploadingChange={setUploading} disabled={busy||uploading} autoCover={false}/></details>:<DiaryPhotos images={photos} coverId={assetId} onChange={changePhotos} onUploadingChange={setUploading} disabled={busy||uploading}/>):<div className="image-picker">
        {assetId&&<div className="image-preview"><img src={fileUrl(assetId,true)} alt="记录配图"/><button type="button" className="text-button" disabled={busy||uploading} onClick={()=>{setAssetId(null);setImageSize(null);}}>移除配图</button></div>}
        <label className="upload-button"><ImagePlus size={17}/>{uploading?'图片上传中…':watch?'选择影视海报':'选一张图片'}<input aria-label={watch?'选择影视海报':'选择收藏图片'} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={event=>{const file=event.target.files?.[0];event.target.value='';void upload(file);}} disabled={busy||uploading}/></label>
      </div>}
      {kind==='collection'&&!watch&&<fieldset className="ratio-picker"><legend>卡片形状 <span className="muted">收藏馆里按它排布</span></legend>{RATIO_OPTIONS.map(([value,label])=><label key={value}><input type="radio" name="card-ratio" checked={cardRatio===value} onChange={()=>setCardRatio(value)}/>{label}</label>)}</fieldset>}
      {kind==='moment'&&!articleMode&&assetId&&<CoverEditor key={assetId} src={fileUrl(assetId,true)} value={coverCrop||{x:50,y:50,zoom:1}} onChange={setCoverCrop} disabled={busy||uploading||revising} preview="card" targetItemId={item?.id}/>}
      {kind==='collection'&&!watch&&cardRatio==='auto'&&<p className="hint">{imageSize?`按图片比例显示（${imageSize.width} × ${imageSize.height}）`:'按图片比例显示；没量到尺寸时用竖版 2:3。'}</p>}
      <fieldset className="visibility-picker"><legend>谁可以看见？</legend><label><input type="radio" name="visibility" checked={visibility==='private'} onChange={()=>setVisibility('private')}/><LockKeyhole size={16}/>仅自己</label><label><input type="radio" name="visibility" checked={visibility==='public'} onChange={()=>setVisibility('public')}/><Globe size={16}/>公开给访客</label></fieldset>
      {articleMode&&<label className="editor-pin-toggle"><input type="checkbox" checked={pinned} onChange={event=>setPinned(event.target.checked)}/>首页置顶 <span className="muted">发布后优先显示在最近更新</span></label>}
      </fieldset>
      {(kind==='moment'||visibility==='public'||dirty)&&<div className="editor-hints">
      {kind==='moment'&&<p className="hint">保存草稿仅自己可见；发布后按所选可见范围展示。</p>}
      {visibility==='public'&&<p className="hint">{watch?'保存为公开后，海报、简介和观看记录能被访客看见；个人感受仅你登录后可见。':kind==='collection'?'保存为公开后，配图和收藏信息能被访客看见；收藏的理由仅你登录后可见。':<>保存为公开后，这段文字和{kind==='moment'?'全部照片':'配图'}都能被访客看见。</>}</p>}
      {dirty&&<p className="hint">{draftStored===false?'草稿暂存失败，请保存后再关闭。':'草稿暂存在当前标签页，重新打开可继续编辑；保存后会清除。'}</p>}
      </div>}
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={close} disabled={busy||uploading||revising}>取消</button><>{kind==='moment'&&<button type="submit" data-status="draft" className="button secondary" disabled={busy||uploading||revising}>保存草稿</button>}<button className="button primary" disabled={busy||uploading||revising}>{busy&&<LoaderCircle size={16} className="spin"/>}{busy?'保存中…':assistantDraft?`确认发布${articleMode?(reviewMode?'观后感':'文章'):'日常'}`:watch?'保存影视记录':articleMode?(status==='draft'?(reviewMode?'发布观后感':'发布文章'):(reviewMode?'保存观后感':'保存文章')):status==='draft'?'发布日常':'保存小卡片'}</button></></div>
    </form>
  </Modal>{closing&&<Modal title="还有未保存的修改" onClose={()=>setClosing(false)} closeOnBackdrop={false}><div className="editor-close-prompt"><p>内容还没保存，关闭前想怎么处理？</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" autoFocus disabled={busy||uploading} onClick={()=>setClosing(false)}>继续编辑</button><button type="button" className="button secondary" disabled={busy||uploading} onClick={discard}>放弃修改</button><button type="button" className="button primary" disabled={busy||uploading} onClick={keepAndClose}>保留草稿并关闭</button></div></div></Modal>}</>;
}
