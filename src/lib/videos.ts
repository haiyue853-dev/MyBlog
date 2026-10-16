import {isPublicItem} from './content-state';
import type {Item} from './types';

export const MAX_VIDEO_SIZE=100*1024*1024;
export const VIDEO_ACCEPT='.mp4,.webm,video/mp4,video/webm';
export function videoMime(bytes:Uint8Array):'video/mp4'|'video/webm'|null{
  const header=new TextDecoder('latin1').decode(bytes.subarray(0,4096));
  if(bytes.length>=24&&header.slice(4,8)==='ftyp'&&/^(isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV|dash)/.test(header.slice(8,12)))return 'video/mp4';
  if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3&&header.includes('webm'))return 'video/webm';
  return null;
}
export function videoDuration(duration?:number){
  if(!duration||!Number.isFinite(duration))return '';
  const seconds=Math.round(duration);const hours=Math.floor(seconds/3600);
  return [hours||'',String(Math.floor(seconds/60)%60).padStart(hours?2:1,'0'),String(seconds%60).padStart(2,'0')].filter(value=>value!=='').join(':');
}
export function visibleVideos(items:Item[],owner:boolean,category='',query=''){
  const needle=query.trim().toLocaleLowerCase();
  return items.filter(item=>item.kind==='video'&&item.video&&(owner||isPublicItem(item))&&(!category||item.category===category)&&(!needle||[item.title,item.body,item.category,...item.tags].join(' ').toLocaleLowerCase().includes(needle))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
}
