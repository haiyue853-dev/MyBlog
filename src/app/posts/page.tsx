import type {Metadata} from 'next';
import {articlePageData} from '@/lib/article-page-data';
import {Space} from '@/components/space';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'文章地图 · Hai’s Little World'};
export default async function Page({searchParams}:{searchParams:Promise<{category?:string;tag?:string;series?:string}>}){
  const data=await articlePageData();const filters=await searchParams;
  return <Space initialItems={data.allItems} initialProfile={data.profile} initialOwner={data.owner} configured={data.configured} initialView="posts" initialArticleFilters={{category:filters.category||'',tag:filters.tag||'',series:filters.series||''}}/>;
}
