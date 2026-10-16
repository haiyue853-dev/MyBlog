'use client';
import type {Item,WatchConfig,WatchState,WatchType} from '@/lib/types';
import {WATCH_STATES,WATCH_TYPES} from '@/lib/watch-collection';
import {managedContentType} from '@/lib/content-state';
import {ThemeSelect} from './theme-select';

export function WatchFields({value,onChange,reviews,disabled}:{value:WatchConfig;onChange:(value:WatchConfig)=>void;reviews:Item[];disabled:boolean}){
  const choices=reviews.filter(item=>item.article&&managedContentType(item)==='review');
  return <fieldset className="watch-fields form-stack" disabled={disabled}><legend>我的观看记录</legend><div className="form-grid">
    <label>影视类型<ThemeSelect ariaLabel="影视类型" value={value.type} options={WATCH_TYPES.map(type=>({value:type,label:type}))} disabled={disabled} onChange={type=>onChange({...value,type:type as WatchType})}/></label>
    <label>观看状态<ThemeSelect ariaLabel="观看状态" value={value.state} options={WATCH_STATES} disabled={disabled} onChange={state=>onChange({...value,state:state as WatchState,watched:state==='completed'&&value.episodes?value.episodes:value.watched})}/></label>
    <label>我的评分 <span className="muted">可留空 · 0–10 分</span><input aria-label="我的评分" type="number" min={0} max={10} step={0.1} placeholder="还没打分" value={value.rating??''} onChange={event=>onChange({...value,rating:event.target.value===''?null:Number(event.target.value)})}/></label>
    <label>上映年份 <span className="muted">可留空</span><input aria-label="上映年份" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" placeholder="例如 2026" value={value.year} onChange={event=>onChange({...value,year:event.target.value})}/></label>
    {value.type!=='电影'&&value.state!=='completed'&&<><label>总集数 <span className="muted">可留空</span><input aria-label="总集数" type="number" min={1} max={10000} step={1} placeholder="尚未确定" value={value.episodes??''} onChange={event=>onChange({...value,episodes:event.target.value===''?null:Number(event.target.value)})}/></label><label>看到第几集<input aria-label="看到第几集" type="number" min={0} max={value.episodes??10000} step={1} value={value.watched} onChange={event=>onChange({...value,watched:Number(event.target.value)})}/></label></>}
  </div><label>关联观后感 <span className="muted">可选</span><ThemeSelect ariaLabel="关联观后感" value={value.reviewId||''} options={[{value:'',label:'暂不关联'},...choices.map(item=>({value:item.id,label:item.title}))]} disabled={disabled} onChange={id=>onChange({...value,reviewId:id||null})}/></label>
    <label>简介 <span className="muted">公开记录的简介可被访客看见</span><textarea aria-label="简介" rows={4} maxLength={3000} placeholder="作品讲述的故事，不包含你的个人感受…" value={value.synopsis||''} onChange={event=>onChange({...value,synopsis:event.target.value})}/></label>
    <label>简介来源 <span className="muted">可选</span><input aria-label="简介来源" type="url" maxLength={2000} placeholder="https://…" value={value.synopsisSource||''} onChange={event=>onChange({...value,synopsisSource:event.target.value})}/></label>
  </fieldset>;
}
