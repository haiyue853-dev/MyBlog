'use client';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import type {ItemImage} from '@/lib/types';
import type {ArticleImageWidth,ArticleImageAlignment} from '@/lib/article-images';
import {fileUrl} from '@/lib/client';
import {Modal} from './modal';

export function ArticleImage({image,caption,width,alignment='center'}:{image:ItemImage;caption:string;width:ArticleImageWidth;alignment?:ArticleImageAlignment}){
  const [open,setOpen]=useState(false);
  return <span className={`article-body-image is-${typeof width==='number'?'custom':width}`} style={typeof width==='number'?{width:`${width}%`}:undefined} data-article-image={image.assetId} data-image-align={alignment} role="figure" aria-label={caption||'正文配图'}>
    <button type="button" className="article-image-open" aria-label={`放大查看：${caption||'正文配图'}`} onClick={()=>setOpen(true)}><img src={fileUrl(image.assetId,true)} alt={caption||'正文配图'} width={image.width} height={image.height} loading="lazy"/></button>
    {caption&&<span className="article-image-caption">{caption}</span>}
    {open&&createPortal(<Modal title="查看正文图片" onClose={()=>setOpen(false)} wide className="article-image-lightbox"><img className="article-image-full" src={fileUrl(image.assetId,true)} alt={caption||'正文配图'}/>{caption&&<p className="article-image-full-caption">{caption}</p>}</Modal>,document.body)}
  </span>;
}
