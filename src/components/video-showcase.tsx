'use client';
import {useState} from 'react';
import {Clapperboard,Plus,Play,Pencil,Trash2,Search,ArrowRight,LockKeyhole} from 'lucide-react';
import {visibleVideos,videoDuration} from '@/lib/videos';
import {dateLabel,fileUrl} from '@/lib/client';
import type {Item} from '@/lib/types';
import {ThemeSelect} from './theme-select';
import {VideoEditor} from './video-editor';

export function VideoShowcase({items,owner,onOpen,onRemove,onSaved}:{items:Item[];owner:boolean;onOpen:(item:Item)=>void;onRemove:(item:Item)=>void;onSaved:(item:Item)=>void}){
  const [query,setQuery]=useState('');const [category,setCategory]=useState('');const [editing,setEditing]=useState<{item?:Item}|null>(null);
  const all=visibleVideos(items,owner);const shown=visibleVideos(items,owner,category,query);const categories=[...new Set(all.map(item=>item.category).filter(Boolean))];
  return <section className="video-showcase" aria-label="视频作品栏目">
    <div className="video-showcase-heading"><div><p className="video-eyebrow">FRAMES I KEEP</p><h1><Clapperboard size={30}/>视频作品<span className="heading-dot">.</span></h1><p>把喜欢的镜头和音乐，剪成自己的作品。</p></div>{owner&&<button className="button primary" onClick={()=>setEditing({})}><Plus size={16}/>上传作品</button>}</div>
    <div className="video-showcase-toolbar"><span className="video-count">{all.length} 份作品</span>{all.length>0&&<div className="video-filters"><label className="search-field"><Search size={16}/><input aria-label="搜索视频作品" value={query} placeholder="找一段喜欢的剪辑…" onChange={event=>setQuery(event.target.value)}/></label><ThemeSelect ariaLabel="筛选视频分类" value={category} onChange={setCategory} options={[{value:'',label:'全部分类'},...categories.map(value=>({value,label:value}))]}/></div>}</div>
    {shown.length?<div className="video-grid">{shown.map(item=><article key={item.id} className="video-card paper">
      <button className="video-card-cover" onClick={()=>onOpen(item)} aria-label={`播放视频：${item.title}`}>{item.assetId?<img src={fileUrl(item.assetId,true)} alt={item.title} loading="lazy"/>:<div className="video-cover-placeholder"><Clapperboard size={38}/><span>收好的镜头</span></div>}<span className="video-card-play"><Play size={22} fill="currentColor"/></span>{item.video?.duration&&<span className="video-card-duration">{videoDuration(item.video.duration)}</span>}{owner&&item.visibility==='private'&&<span className="video-card-private"><LockKeyhole size={11}/>仅自己</span>}</button>
      <div className="video-card-copy"><div className="video-card-meta"><span>{item.category||'我的剪辑'}</span><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></div><h2><button onClick={()=>onOpen(item)}>{item.title}<ArrowRight size={18}/></button></h2>{item.body&&<p>{item.body}</p>}<div className="video-card-tags">{item.tags.slice(0,3).map(tag=><span key={tag}>#{tag}</span>)}</div>{owner&&<div className="video-card-actions"><button onClick={()=>setEditing({item})}><Pencil size={13}/>编辑</button><button onClick={()=>onRemove(item)}><Trash2 size={13}/>删除</button></div>}</div>
    </article>)}</div>:<div className="video-empty paper"><div className="video-empty-icon"><Clapperboard size={36}/></div><h2>{query||category?'还没找到这段剪辑':'给自己的剪辑留一个位置'}</h2><p>{query||category?'换个关键词，或看看其他分类。':'舞台、旅行，或日常里的一个瞬间。喜欢的镜头，慢慢收好。'}</p>{owner&&!query&&!category&&<button className="button primary" onClick={()=>setEditing({})}><Plus size={16}/>上传第一份作品</button>}</div>}
    {owner&&editing&&<VideoEditor key={editing.item?.id||'new'} item={editing.item} onClose={()=>setEditing(null)} onSaved={onSaved}/>}
  </section>;
}
