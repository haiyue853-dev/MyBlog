'use client';
import {articleImageWidthLabel,type ArticleImageOccurrence,type ArticleImageWidth} from '@/lib/article-images';
import {ArticleImage} from './article-image';
import type {ItemImage} from '@/lib/types';

export function ArticleImageControls({occurrences,disabled,onEdit}:{occurrences:ArticleImageOccurrence[];disabled:boolean;onEdit:(occurrence:ArticleImageOccurrence)=>void}){
  if(!occurrences.length)return null;
  return <section className="article-image-controls" aria-label="正文图片"><div className="article-image-controls-heading"><strong>正文图片</strong><span>预览图片，随时调整大小和说明</span></div><ol>{occurrences.map((occurrence,index)=><li key={occurrence.start}>
    <div className="article-image-card-preview"><ArticleImage image={occurrence.image} caption="" width="wide"/></div>
    <div className="article-image-card-info"><strong>图片 {index+1} · {articleImageWidthLabel(occurrence.width)}</strong><span>{occurrence.caption||'还没有图片说明'}</span><button className="button secondary" type="button" disabled={disabled} onClick={()=>onEdit(occurrence)} aria-label={`调整图片 ${index+1}`}>调整图片</button></div>
  </li>)}</ol></section>;
}
export function ArticleImageSizePreview({image,caption,width,onChange,disabled}:{image?:ItemImage;caption:string;width:ArticleImageWidth;onChange:(width:ArticleImageWidth)=>void;disabled:boolean}){
  const percent=typeof width==='number'?width:width==='wide'?100:75;
  return <div className="article-image-size-controls">
    <div className="article-image-size-heading"><strong>图片大小</strong><span>{articleImageWidthLabel(width)}</span></div>
    <label className="article-image-size-slider">占正文宽度<input type="range" aria-label="图片宽度百分比" min={25} max={100} step={5} value={percent} disabled={disabled} onChange={event=>onChange(Number(event.target.value))}/><span>25% — 100%</span></label>
    <div className="article-image-size-presets"><button type="button" disabled={disabled} aria-pressed={width==='normal'} onClick={()=>onChange('normal')}>普通宽度</button><button type="button" disabled={disabled} aria-pressed={width==='wide'} onClick={()=>onChange('wide')}>通栏展示</button></div>
    {image?<div className="article-image-size-preview markdown" role="region" aria-label="图片大小预览"><ArticleImage image={image} caption={caption} width={width}/></div>:<p className="muted">选择图片后，就能在这里预览大小。</p>}
    <p className="text-editor-hint">保持原图比例；实际大小随正文宽度调整，点击图片可放大查看。</p>
  </div>;
}
