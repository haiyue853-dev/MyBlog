'use client';
import {Heart,Plus,Trash2} from 'lucide-react';
import {DEFAULT_ABOUT_INTERESTS,type Profile} from '@/lib/types';

export function AboutFields({draft,onChange,busy}:{draft:Profile;onChange:(profile:Profile)=>void;busy:boolean}){
  const interests=draft.aboutInterests??DEFAULT_ABOUT_INTERESTS;
  function editInterest(index:number,key:'title'|'description',value:string){onChange({...draft,aboutInterests:interests.map((item,current)=>current===index?{...item,[key]:value}:item)});}
  return <fieldset className="about-fields" disabled={busy}><legend><Heart size={16}/>关于我</legend><p className="hint">以下内容会显示在公开的「关于我」页面。</p>
    <label>公开昵称 <span className="muted">可留空</span><input value={draft.aboutName??''} onChange={e=>onChange({...draft,aboutName:e.target.value})} maxLength={50} placeholder="希望别人怎么称呼你"/></label>
    <label>详细介绍 <span className="muted">留空时使用上方个人介绍</span><textarea value={draft.aboutIntro??''} onChange={e=>onChange({...draft,aboutIntro:e.target.value})} maxLength={2000} rows={5} placeholder="聊聊你的日常和喜欢的事…"/></label>
    <div className="interest-editor-heading"><span>我的兴趣小手账</span><button type="button" className="text-button" onClick={()=>onChange({...draft,aboutInterests:[...interests,{title:'',description:''}]})} disabled={interests.length>=8}><Plus size={13}/>添加兴趣</button></div>
    <div className="interest-editor-list">{interests.map((interest,index)=><div className="interest-editor" key={index}><label>兴趣 {index+1}<input value={interest.title} onChange={e=>editInterest(index,'title',e.target.value)} maxLength={40} required placeholder="例如：音乐 · 循环播放"/></label><label>一句介绍<textarea value={interest.description} onChange={e=>editInterest(index,'description',e.target.value)} maxLength={240} rows={2}/></label><button className="icon-button interest-remove" type="button" aria-label={`删除兴趣 ${index+1}`} onClick={()=>onChange({...draft,aboutInterests:interests.filter((_,current)=>current!==index)})}><Trash2 size={15}/></button></div>)}</div>
    <label>写给自己的小小寄语<textarea value={draft.aboutWish??''} onChange={e=>onChange({...draft,aboutWish:e.target.value})} maxLength={300} rows={2} placeholder="留一句此刻想对自己说的话…"/></label>
  </fieldset>;
}
