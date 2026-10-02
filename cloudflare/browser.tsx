import {createRoot} from 'react-dom/client';
import {Space} from '../src/components/space';
import {api} from '../src/lib/client';
import type {Item,Profile} from '../src/lib/types';
import '../src/app/globals.css';
import '../src/app/about-statistics.css';
import '../src/app/editing-materials.css';

const root=document.getElementById('root')!;
async function start(){
  const data=await api<{items:Item[];profile:Profile;owner:boolean;configured:boolean}>('bootstrap');
  const requested=new URLSearchParams(location.search).get('view');
  const view=['home','life','collection','about','materials','stats','files','iris','settings'].includes(requested||'')?requested as 'home'|'life'|'collection'|'about'|'materials'|'stats'|'files'|'iris'|'settings':'home';
  document.title=`${data.profile.name} · 我的个人小屋`;
  createRoot(root).render(<Space initialItems={data.items} initialProfile={data.profile} initialOwner={data.owner} configured={data.configured} initialView={view}/>);
}
function retry(){root.replaceChildren();const message=document.createElement('p');message.textContent='暂时没能打开小屋，请稍后再试。';const button=document.createElement('button');button.textContent='重新打开';button.onclick=()=>{button.disabled=true;void start().catch(retry);};root.append(message,button);}
void start().catch(retry);
