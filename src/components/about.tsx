'use client';
import {ArrowUpRight,Clapperboard,Disc3,Gamepad2,Heart,Music2,NotebookPen,Sparkles,Tv} from 'lucide-react';
import {fileUrl} from '@/lib/client';
import {DEFAULT_ABOUT_INTERESTS,type Profile} from '@/lib/types';

const interestIcons=[Gamepad2,Music2,Tv,Clapperboard];
const labels=['GAME TIME','ON REPEAT','STORY TIME','MY LITTLE EDITS'];
export function About({profile,onCollection,onLife,onEdit,owner}:{profile:Profile;onCollection:()=>void;onLife:()=>void;onEdit:()=>void;owner:boolean}){
  const interests=profile.aboutInterests??DEFAULT_ABOUT_INTERESTS;
  return <section className="about-page section-enter">
    <div className="paper about-intro">
      <div className="about-portrait"><span className="about-tape" aria-hidden="true"/><div className="about-avatar">{profile.avatarId?<img src={fileUrl(profile.avatarId,true)} alt="我的头像"/>:<Disc3 size={70}/>}</div><span className="about-status"><span/>今日也在慢慢生活</span></div>
      <div className="about-copy"><span className="eyebrow">ABOUT ME <span aria-hidden="true">♡</span></span><h2>{profile.aboutName?<>你好呀，我是<br/><span>{profile.aboutName}</span></>:<>你好呀，<br/><span>欢迎来我的小屋。</span></>}</h2><p className="about-intro-text">{profile.aboutIntro||profile.bio}</p><div className="about-badges"><span><Music2 size={13}/>音乐</span><span><NotebookPen size={13}/>日常</span><span><Heart size={13}/>喜欢的瞬间</span></div>{owner&&<button className="text-button" onClick={onEdit}>修改我的介绍 <ArrowUpRight size={14}/></button>}</div>
      <span className="about-doodle about-doodle-one" aria-hidden="true">✦</span><span className="about-doodle about-doodle-two" aria-hidden="true">♪</span>
    </div>
    {interests.length>0&&<div className="about-interests"><div className="about-section-heading"><span className="eyebrow">MY FAVORITES</span><h3>我的兴趣小手账<span className="heading-dot">.</span></h3><p>喜欢的事，给它们留一个小小的位置。</p></div><div className="interest-grid">{interests.map((interest,index)=>{const Icon=interestIcons[index%interestIcons.length];return <article className={`paper interest-card interest-tone-${index%4}`} key={index}><div className="interest-card-top"><span className="interest-icon"><Icon size={25}/></span><span className="eyebrow">{labels[index%labels.length]}</span></div><h4>{interest.title}</h4><p>{interest.description}</p><span className="interest-mark" aria-hidden="true">{['✧','♫','♡','✦'][index%4]}</span></article>;})}</div></div>}
    {profile.aboutWish&&<div className="paper about-wish"><span className="wish-flower" aria-hidden="true">✦</span><div><span className="eyebrow">A LITTLE WISH</span><h3>写给以后的自己</h3><p>{profile.aboutWish}</p></div><Heart size={30} strokeWidth={1.2}/></div>}
    <div className="about-welcome"><span className="eyebrow">STAY A LITTLE LONGER</span><h3>都来到这里了，再坐一会儿吧。</h3><p>翻翻最近的小事，或者看看那些被认真收好的喜欢。</p><div><button className="button primary" onClick={onCollection}><Disc3 size={15}/>看看我的收藏 <ArrowUpRight size={14}/></button><button className="button secondary" onClick={onLife}><NotebookPen size={15}/>翻翻生活碎片</button></div><span className="about-signoff" aria-hidden="true">♫ &nbsp; ♡ &nbsp; ✦</span></div>
  </section>;
}
