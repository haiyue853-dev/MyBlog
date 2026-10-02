import {cookies} from 'next/headers';
import {getStore} from '@/lib/store';
import {Space} from '@/components/space';

export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){const store=getStore();const cookieStore=await cookies();const token=cookieStore.get('world-session')?.value||'';const owner=token.length===64&&store.hasSession(token);const {view}=await searchParams;const initialView=['home','life','collection','about','stats','files','iris','settings'].includes(view||'')?view as 'home'|'life'|'collection'|'about'|'stats'|'files'|'iris'|'settings':'home';return <Space initialItems={store.listItems(owner)} initialProfile={store.getProfile()} initialOwner={owner} configured={!!store.getOwner()} initialView={initialView}/>;}
