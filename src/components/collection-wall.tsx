'use client';
import {Disc3,Heart,Pencil,Trash2} from 'lucide-react';
import {dateLabel,fileUrl} from '@/lib/client';
import type {Item} from '@/lib/types';

// 收藏馆的竖版海报墙。排版照参考站 yaronluo.com 的番剧墙：
// 2:3 海报铺满卡片、左上角分类角标、右上角操作按钮和底部信息条都在 hover 时浮出。
// 触屏没有 hover，所以 CSS 里对 `@media(hover:none)` 让这两块常驻，否则手机上只剩一张没名字的图。
//
// 注意：卡片本身是个铺满的 <button>，操作按钮必须是它的**兄弟节点**（HTML 不允许 button 套 button），
// 所以下面用绝对定位叠上去，而不是写进 <button> 里面。
export function CollectionWall({items,owner,liked,onLike,onOpen,onEdit,onRemove}:{
  items:Item[];
  owner:boolean;
  liked:string[];
  onLike:(id:string)=>void;
  onOpen:(item:Item)=>void;
  onEdit:(item:Item)=>void;
  onRemove:(item:Item)=>void;
}){
  return <div className="collection-wall">{items.map(item=><article className="poster-card" key={item.id}>
    <button className="poster-open" onClick={()=>onOpen(item)} aria-label={`查看 ${item.title}`}>
      {item.assetId?<img src={fileUrl(item.assetId,true)} alt="" loading="lazy"/>:<span className="poster-blank"><Disc3 size={38}/><span>no cover yet</span></span>}
    </button>
    <span className="poster-badge">{item.category||'收藏'}</span>
    <div className="poster-tools">
      <button className="poster-tool" onClick={()=>onLike(item.id)} aria-pressed={liked.includes(item.id)} aria-label={liked.includes(item.id)?`取消喜欢 ${item.title}`:`喜欢 ${item.title}`}><Heart size={14}/></button>
      {owner&&<><button className="poster-tool" onClick={()=>onEdit(item)} aria-label={`编辑 ${item.title}`}><Pencil size={13}/></button><button className="poster-tool" onClick={()=>onRemove(item)} aria-label={`删除 ${item.title}`}><Trash2 size={13}/></button></>}
    </div>
    <div className="poster-veil">
      <h3>{item.title}</h3>
      <span>{dateLabel(item.createdAt)}{item.tags.length?` · ${item.tags.slice(0,2).map(value=>'#'+value).join(' ')}`:''}</span>
    </div>
  </article>)}</div>;
}
