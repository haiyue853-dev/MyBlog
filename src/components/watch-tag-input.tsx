'use client';
import {WATCH_TAGS,toggleWatchTag} from '@/lib/watch-collection';

export function WatchTagInput({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
  const tags=[...new Set(value.split(/[,，]/).map(tag=>tag.trim()).filter(Boolean))];
  return <fieldset className="collection-tag-input watch-tag-input" disabled={disabled}><legend>题材标签 <span className="muted">可多选，最多 10 个</span></legend>
    <div className="collection-tag-choices">{WATCH_TAGS.map(tag=><button type="button" key={tag} aria-label={`标签：${tag}`} aria-pressed={tags.includes(tag)} disabled={disabled||tags.length>=10&&!tags.includes(tag)} onClick={()=>onChange(toggleWatchTag(value,tag))}>{tag}</button>)}</div>
    <label><span className="muted">也可自己填写，用逗号分隔</span><input aria-label="影视标签" value={value} onChange={event=>onChange(event.target.value)} placeholder="爱情，悬疑，治愈…"/></label>
  </fieldset>;
}
