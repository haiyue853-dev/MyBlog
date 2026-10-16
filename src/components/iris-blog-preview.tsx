import {FilePenLine} from 'lucide-react';
import type {Item} from '@/lib/types';
import {fileUrl} from '@/lib/client';
import {RecordBody} from './record-body';
import {articleImageOccurrences} from '@/lib/article-images';

export function IrisBlogPreview({candidate,onEdit,onDiscard}:{candidate:Item;onEdit:()=>void;onDiscard:()=>void}){
  const inline=new Set(articleImageOccurrences(candidate.body,candidate.images||[]).map(occurrence=>occurrence.image.assetId));
  const gallery=(candidate.images||[]).filter(image=>!inline.has(image.assetId));
  return <article className="paper iris-blog-preview" aria-label="Iris 博客预览">
    <div className="iris-blog-preview-heading"><span className="eyebrow">尚未发布 · {candidate.article?'文章':'日常'}预览</span><span className="muted">{candidate.category}</span></div>
    <h3>{candidate.title}</h3>{candidate.article?.summary&&<p className="iris-blog-summary">{candidate.article.summary}</p>}
    <RecordBody body={candidate.body} images={candidate.images}/>
    {!candidate.article&&!!gallery.length&&<div className="iris-blog-photos">{gallery.map((image,index)=><img key={image.assetId} src={fileUrl(image.assetId,true)} alt={`配图 ${index+1}`}/>)}</div>}
    {!!candidate.tags.length&&<p className="muted">{candidate.tags.map(tag=>`#${tag}`).join(' · ')}</p>}
    <p className="hint">先检查文字和配图，进入编辑后可修改内容、选择公开范围或保存草稿。</p>
    <div className="form-actions"><button className="button secondary" type="button" onClick={onDiscard}>放弃这份预览</button><button className="button primary" type="button" onClick={onEdit}><FilePenLine size={16}/>编辑并确认发布</button></div>
  </article>;
}
