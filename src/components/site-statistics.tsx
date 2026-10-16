'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,CalendarDays,ChartNoAxesCombined,Disc3,Footprints,Heart,NotebookPen,RefreshCw,Sparkles,Tag,Timer,Users} from 'lucide-react';
import type {SiteStatistics} from '@/lib/types';
import {shiftDay} from '@/lib/statistics-schema';

const number=(value?:number)=>value===undefined?'—':value.toLocaleString('zh-CN');
export function formatSiteUptime(sinceDay:string,now:number){
  const start=Date.parse(`${sinceDay}T00:00:00+08:00`);if(!Number.isFinite(start))return '—';
  const seconds=Math.max(0,Math.floor((now-start)/1000));
  return `${Math.floor(seconds/86400)} 天 ${Math.floor(seconds%86400/3600)} 时 ${Math.floor(seconds%3600/60)} 分 ${seconds%60} 秒`;
}
export function StatsSummary({stats,onOpen}:{stats:SiteStatistics|null;onOpen:()=>void}){
  const [now,setNow]=useState<number|null>(null);
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  return <section className="paper sidebar-stats" aria-label="站点统计">
    <h2><span className="sidebar-stats-heading-icon"><ChartNoAxesCombined size={18}/></span>站点统计<Sparkles className="sidebar-stats-sparkle" size={18} aria-hidden="true"/></h2>
    <dl className="sidebar-stats-visits">
      <div className="sidebar-stats-uptime"><Timer size={21} aria-hidden="true"/><div><dt>已运行</dt><dd title={stats?`从 ${stats.sinceDay} 统计启用日起计算`:undefined}>{stats&&now!==null?formatSiteUptime(stats.sinceDay,now):'—'}</dd></div></div>
      {[{label:'今日访问',value:stats?.todayViews,Icon:CalendarDays},{label:'总访客',value:stats?.totalVisitors,Icon:Users},{label:'总访问',value:stats?.totalViews,Icon:ChartNoAxesCombined}].map(({label,value,Icon})=><div key={label}><Icon size={21} aria-hidden="true"/><div><dt>{label}</dt><dd>{number(value)}</dd></div></div>)}
    </dl>
    <dl className="sidebar-stats-content">{[{label:'文章字数',value:stats?.content.words},{label:'文章数量',value:stats?.content.articles},{label:'分类',value:stats?.content.categories},{label:'标签',value:stats?.content.tags}].map(({label,value})=><div key={label}><dt>{label}</dt><dd>{number(value)}</dd></div>)}</dl>
    <button className="text-button" onClick={onOpen}>翻开统计手账 <ArrowUpRight size={13}/></button>
  </section>;
}
export function SiteStats({stats,error,loading,onRefresh}:{stats:SiteStatistics|null;error:string;loading:boolean;onRefresh:()=>Promise<void>}){
  const [refreshing,setRefreshing]=useState(false);
  const feedbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const busy=loading||refreshing;
  useEffect(()=>()=>{if(feedbackTimer.current!==null)clearTimeout(feedbackTimer.current);},[]);
  async function refresh(){
    if(busy)return;
    setRefreshing(true);
    const started=performance.now();
    try{await onRefresh();}
    finally{feedbackTimer.current=setTimeout(()=>{feedbackTimer.current=null;setRefreshing(false);},Math.max(0,650-(performance.now()-started)));}
  }
  const cards=[{title:'今日的脚印',value:stats?.todayViews,note:'今天被翻开的页面',Icon:Footprints},{title:'来过的朋友',value:stats?.totalVisitors,note:'累计浏览器访客',Icon:Users},{title:'翻开的页面',value:stats?.totalViews,note:'累计页面浏览次数',Icon:ChartNoAxesCombined},{title:'收下的心心',value:stats?.content.likes,note:'公开卡片的累计喜欢',Icon:Heart}];
  const days:SiteStatistics['history']=[];
  if(stats){const start=stats.sinceDay>shiftDay(stats.day,-13)?stats.sinceDay:shiftDay(stats.day,-13);for(let day=start;day<=stats.day;day=shiftDay(day,1))days.push(stats.history.find(value=>value.day===day)||{day,views:0,visitors:0});}
  const max=Math.max(1,...days.map(day=>day.views));
  return <section className="statistics-page section-enter"><div className="statistics-heading"><span className="eyebrow">LITTLE SITE DIARY <span aria-hidden="true">♡</span></span><h2>今天也有人路过这里<span className="heading-dot">.</span></h2><p>每次翻开小屋，都留下一点温柔的足迹。</p><button className="stats-refresh" onClick={()=>void refresh()} disabled={busy} aria-label="刷新网页统计" aria-busy={busy}><RefreshCw size={15} aria-hidden="true" className={busy?'spin':''}/><span>{busy?'更新中…':'更新一下'}</span></button></div>{error&&<p className="form-error" role="alert">统计暂时没能更新：{error}</p>}
    <div className="stats-metrics" aria-busy={loading}>{cards.map(({title,value,note,Icon},index)=><article className={`paper stats-metric stats-tone-${index}`} key={title}><span className="stats-metric-icon"><Icon size={21}/></span><span className="metric-label">{title}</span><strong>{number(value)}<small>{index===1?'位':'次'}</small></strong><p>{note}</p></article>)}</div>
    <div className="paper stats-chart-card"><div className="stats-card-heading"><div><span className="eyebrow">VISIT FOOTPRINTS</span><h3>最近的访问足迹</h3></div><span className="stats-chart-legend"><i/>页面浏览</span></div><p className="stats-section-note">记录最近 14 天，今天的故事还在继续。</p>{stats?<div className={`stats-chart ${days.length<4?'stats-chart-short':''}`} aria-label="最近的每日浏览量">{days.map(day=><div className="stats-chart-day" key={day.day}><span className="chart-value">{number(day.views)}</span><div className="chart-bar-space"><span role="img" tabIndex={0} className="chart-bar" style={{height:`${day.views?Math.max(8,day.views/max*100):2}%`}} aria-label={`${day.day}，浏览 ${day.views} 次，访客 ${day.visitors} 位`} title={`${day.day} · 浏览 ${day.views} 次 · 访客 ${day.visitors} 位`}/></div><span className="chart-day-label">{day.day.slice(5).replace('-','/')}</span></div>)}</div>:<div className="stats-chart-placeholder">{error?'暂时没有读到足迹，稍后再试一次。':'正在把小小的足迹整理好…'}</div>}</div>
    <div className="paper stats-content-card"><div className="stats-card-heading"><div><span className="eyebrow">INSIDE THIS LITTLE WORLD</span><h3>小屋里，慢慢攒下的喜欢</h3></div><span className="stats-sticker" aria-hidden="true">✦</span></div><div className="content-totals">{[{label:'生活碎片',value:stats?.content.moments,Icon:NotebookPen,unit:'条'},{label:'珍藏的瞬间',value:stats?.content.collections,Icon:Disc3,unit:'份'},{label:'分类抽屉',value:stats?.content.categories,Icon:ChartNoAxesCombined,unit:'个'},{label:'灵感标签',value:stats?.content.tags,Icon:Tag,unit:'枚'}].map(({label,value,Icon,unit})=><div key={label}><Icon size={19}/><strong>{number(value)}<small>{unit}</small></strong><span>{label}</span></div>)}</div><p className="stats-section-note">这里数的是愿意分享的内容，每一份喜欢都有自己的位置。</p></div>
    <p className="stats-footnote">{stats?`访问统计从 ${stats.sinceDay.replaceAll('-','/')} 开始记录。`:'访问统计从启用后开始记录。'}同一浏览器使用 Cookie 识别，换浏览器或清除 Cookie 会作为新访客。这里展示汇总数字，不显示访客身份。</p>
  </section>;
}
