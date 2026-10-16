import {cookies} from 'next/headers';
import {getStore} from './store';
import {visibleArticles} from './articles';

export async function articlePageData(){
  const store=getStore();const token=(await cookies()).get('world-session')?.value||'';
  const owner=token.length===64&&store.hasSession(token);
  const allItems=store.listItems(owner);const items=allItems.filter(item=>item.kind==='moment');
  return {owner,items,allItems,articles:visibleArticles(items,owner),profile:store.getProfile(),configured:!!store.getOwner()};
}
