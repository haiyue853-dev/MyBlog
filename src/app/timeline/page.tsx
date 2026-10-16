import type {Metadata} from 'next';
import {articlePageData} from '@/lib/article-page-data';
import {Space} from '@/components/space';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'时光轴 · Hai’s Little World'};
export default async function Page(){const data=await articlePageData();return <Space initialItems={data.allItems} initialProfile={data.profile} initialOwner={data.owner} configured={data.configured} initialView="timeline"/>;}
