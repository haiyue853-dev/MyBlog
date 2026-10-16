import {isPublicItem} from '@/lib/content-state';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {articlePageData} from '@/lib/article-page-data';
import {articleContext,itemExcerpt} from '@/lib/articles';
import {Space} from '@/components/space';

export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params;const data=await articlePageData();const item=articleContext(data.articles,id,data.owner)?.item;
  if(!item)return {title:'文章未找到',robots:{index:false,follow:false}};
  return {title:`${item.title} · ${data.profile.name}`,description:itemExcerpt(item,240),robots:{index:isPublicItem(item),follow:isPublicItem(item)}};
}
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const data=await articlePageData();const context=articleContext(data.articles,id,data.owner);
  if(!context)notFound();
  return <Space initialItems={data.allItems} initialProfile={data.profile} initialOwner={data.owner} configured={data.configured} initialView="article" initialArticleId={context.item.id}/>;
}
