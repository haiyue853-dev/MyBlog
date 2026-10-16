'use client';
import {Plus,X} from 'lucide-react';
import type {ArticleConfig} from '@/lib/types';
import type {ReactNode} from 'react';
import {fileUrl} from '@/lib/client';
import {ArticleCoverEditor} from './article-cover-editor';

export function ArticleFields({value,onChange,coverId,coverTitle='',coverControls,disabled=false}:{value:ArticleConfig;onChange:(value:ArticleConfig)=>void;coverId?:string|null;coverTitle?:string;coverControls?:ReactNode;disabled?:boolean}){
  return <fieldset className="article-fields form-stack"><legend>文章封面与作品资料</legend>
    <label>简短摘要<textarea value={value.summary} maxLength={240} rows={2} placeholder="用一两句话介绍这篇文章，首页只显示这段摘要。" onChange={event=>onChange({...value,summary:event.target.value})}/></label>
    <div className="form-grid"><label>封面引导文字<input value={value.kicker} maxLength={100} placeholder="例如：观影手记 · 关于喜欢的故事" onChange={event=>onChange({...value,kicker:event.target.value})}/></label><label>专题系列 <span className="muted">可选</span><input value={value.series} maxLength={80} placeholder="例如：旅行手记、读书笔记" onChange={event=>onChange({...value,series:event.target.value})}/></label></div>
    {coverControls}
    {coverId?<ArticleCoverEditor key={coverId} src={fileUrl(coverId,true)} title={coverTitle} value={value} onChange={onChange} disabled={disabled}/>:<p className="hint">封面可留空；选好封面后可以拖动、缩放取景。正文图片在正文工具栏直接插入。</p>}
    <label className="article-spoiler"><input type="checkbox" checked={value.spoiler} onChange={event=>onChange({...value,spoiler:event.target.checked})}/>提示“含剧透”</label>
    <div className="article-fact-editor"><div className="article-fact-heading"><span>作品资料 <span className="muted">最多 6 项，可留空</span></span><button className="text-button" type="button" disabled={value.facts.length>=6} onClick={()=>onChange({...value,facts:[...value.facts,{label:'',value:''}]})}><Plus size={14}/>添加资料</button></div>{value.facts.map((fact,index)=><div className="article-fact-row" key={index}><label>资料名称 {index+1}<input value={fact.label} maxLength={30} placeholder="例如：上映、导演、初看" onChange={event=>onChange({...value,facts:value.facts.map((row,position)=>position===index?{...row,label:event.target.value}:row)})}/></label><label>资料内容 {index+1}<input value={fact.value} maxLength={100} placeholder="填写你想记录的信息" onChange={event=>onChange({...value,facts:value.facts.map((row,position)=>position===index?{...row,value:event.target.value}:row)})}/></label><button type="button" className="icon-button" aria-label={`移除资料 ${index+1}`} onClick={()=>onChange({...value,facts:value.facts.filter((_,position)=>position!==index)})}><X size={16}/></button></div>)}</div>
    <label>一句摘录 <span className="muted">可选</span><input value={value.quote} maxLength={300} placeholder="留下一句自己的感受或喜欢的话。" onChange={event=>onChange({...value,quote:event.target.value})}/></label>
  </fieldset>;
}
