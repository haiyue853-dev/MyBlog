import {ArrowLeft,Map,Music2,History} from 'lucide-react';
import type {Profile} from '@/lib/types';

export function ArticleHeader({profile}:{profile:Profile}){
  return <header className="article-site-header"><a className="article-brand" href="/"><Music2 size={21}/><span>{profile.name}</span></a><nav aria-label="文章导航"><a href="/?view=life"><ArrowLeft size={15}/>生活碎片</a><a href="/?view=timeline"><History size={15}/>时光轴</a><a href="/?view=posts"><Map size={15}/>文章地图</a></nav></header>;
}
