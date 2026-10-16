'use client';
import {COLLECTION_CONTENT_TAGS} from '@/lib/collection-filters';

export function CollectionTagInput({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
  const tags=value.split(/[,，]/).map(tag=>tag.trim()).filter(Boolean);
  return <fieldset className="collection-tag-input" disabled={disabled}><legend>内容标签 · 用于类型筛选</legend>
    <div className="collection-tag-choices">{COLLECTION_CONTENT_TAGS.map(tag=><button type="button" key={tag} aria-label={`标签：${tag}`} aria-pressed={tags.includes(tag)} onClick={()=>onChange((tags.includes(tag)?tags.filter(value=>value!==tag):[...tags,tag]).join('，'))}>{tag}</button>)}</div>
    <label><span className="muted">也可自己填写，用逗号分隔</span><input aria-label="内容标签" value={value} onChange={event=>onChange(event.target.value)} placeholder="小卡，电影，韩剧…"/></label>
  </fieldset>;
}
