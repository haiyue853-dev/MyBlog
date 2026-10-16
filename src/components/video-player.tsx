'use client';
import {useState} from 'react';
import {fileUrl,dateLabel} from '@/lib/client';
import {videoDuration} from '@/lib/videos';
import type {Item} from '@/lib/types';
import {Modal} from './modal';

export function VideoPlayer({item,onClose}:{item:Item;onClose:()=>void}){
  const [error,setError]=useState(false);
  return <Modal title={item.title} wide className="video-player-dialog" onClose={onClose}>
    {item.video&&<video className="video-player" src={fileUrl(item.video.assetId,true)} poster={item.assetId?fileUrl(item.assetId,true):undefined} controls playsInline preload="metadata" onError={()=>setError(true)} aria-label={`播放视频：${item.title}`}/>}
    {error&&<p className="form-error" role="alert">视频暂时无法播放，可以刷新重试，或<a href={item.video?fileUrl(item.video.assetId):undefined}>下载原视频</a>观看。</p>}
    <div className="video-player-meta"><span>{dateLabel(item.createdAt)}</span>{item.category&&<span>{item.category}</span>}<span>{videoDuration(item.video?.duration)}</span></div>
    {item.body&&<p className="video-player-description">{item.body}</p>}
    {!!item.tags.length&&<div className="card-tags">{item.tags.map(tag=><span key={tag}>#{tag}</span>)}</div>}
  </Modal>;
}
