import type {IrisChatAttachment} from '@/lib/iris-chat-files';
import {IrisChatImage} from './iris-chat-image';

export function IrisChatPhotoPicker({sessionId,photos,selected,disabled,onChange}:{sessionId:string;photos:IrisChatAttachment[];selected:string[];disabled:boolean;onChange:(ids:string[])=>void}){
  if(!photos.length)return null;
  return <fieldset className="iris-chat-photo-picker" disabled={disabled}><legend>选择博客配图</legend><p className="hint">勾选想带入预览的图片；未勾选的照片和文档不会加入博客。</p><div className="iris-chat-photo-options">{photos.map(photo=><div key={photo.id}><IrisChatImage name={photo.original_name} sessionId={sessionId} attachmentId={photo.id}/><label><input type="checkbox" checked={selected.includes(photo.id)} onChange={event=>onChange(event.target.checked?[...selected,photo.id]:selected.filter(id=>id!==photo.id))}/>{photo.original_name}</label></div>)}</div></fieldset>;
}
