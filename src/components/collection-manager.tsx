'use client';
import {useRef,useState} from 'react';
import {CheckSquare,Globe,LoaderCircle,LockKeyhole,Tag,Trash2} from 'lucide-react';
import {api} from '@/lib/client';
import {manageCollections,type CollectionAction} from '@/lib/collection-management';
import type {Item} from '@/lib/types';
import {Modal} from './modal';
import {CategoryInput} from './category-input';
import {CollectionTagInput} from './collection-tag-input';

export function CollectionManager({items,visibleItems,selectedIds,onSelect,onDone,onSaved,onBusyChange,externalBusy=false}:{
  items:Item[];visibleItems:Item[];selectedIds:string[];onSelect:(ids:string[])=>void;onDone:()=>void;onSaved:()=>void;onBusyChange:(busy:boolean)=>void;externalBusy?:boolean;
}){
  const [dialog,setDialog]=useState<'category'|'tags'|'delete'|null>(null);
  const [category,setCategory]=useState('');const [tags,setTags]=useState('');const [localBusy,setBusy]=useState(false);
  const busy=localBusy||externalBusy;
  const [progress,setProgress]=useState('');const [message,setMessage]=useState('');
  const running=useRef(false);
  const selected=items.filter(item=>selectedIds.includes(item.id));
  const allVisible=visibleItems.length>0&&visibleItems.every(item=>selectedIds.includes(item.id));
  async function apply(action:CollectionAction){
    if(running.current||busy||!selected.length)return;
    if(action.type==='category'&&(!action.value.trim()||action.value.trim().length>40)){setMessage('请填写不超过 40 字的人物或分组名称。');return;}
    if(action.type==='tags'&&(action.value.length>10||action.value.some(value=>value.length>30))){setMessage('标签最多 10 个，每个最多 30 字。');return;}
    running.current=true;setBusy(true);onBusyChange(true);setMessage('');
    try{
      const result=await manageCollections(selected,action,{
        save:item=>api(`items/${item.id}`,{method:'PUT',body:JSON.stringify(item)}),
        remove:id=>api(`items/${id}`,{method:'DELETE'}),
        onProgress:(done,total)=>setProgress(`已处理 ${done} / ${total} 份收藏`),
      });
      onSelect(result.failed.map(value=>value.id));onSaved();setDialog(null);
      setMessage(result.failed.length?`已完成 ${result.completed.length} 份，${result.failed.length} 份失败，已保留选择。${result.failed.map(value=>value.message).join('；')}`:`已完成 ${result.completed.length} 份收藏的${action.type==='category'?'分组修改':action.type==='tags'?'标签修改':action.type==='delete'?'删除':action.value==='public'?'公开设置':'私密设置'}。`);
    }finally{running.current=false;setBusy(false);onBusyChange(false);setProgress('');}
  }
  return <div className="collection-management">
    <div className="collection-management-selection"><span><CheckSquare size={16}/>已选择 {selected.length} 份收藏</span><button type="button" disabled={busy||!visibleItems.length} onClick={()=>onSelect(allVisible?selectedIds.filter(id=>!visibleItems.some(item=>item.id===id)):[...new Set([...selectedIds,...visibleItems.map(item=>item.id)])])}>{allVisible?'取消本页全选':`全选本页（${visibleItems.length}）`}</button><button type="button" disabled={busy||!selected.length} onClick={()=>onSelect([])}>清空选择</button><button type="button" disabled={busy} onClick={onDone}>完成管理</button></div>
    <p className="muted">可跨页勾选；操作会应用到全部已选收藏。</p>
    <div className="collection-management-actions"><button className="button secondary" type="button" disabled={busy||!selected.length} onClick={()=>{setCategory(selected.every(item=>item.category===selected[0]?.category)?selected[0]?.category||'':'');setMessage('');setDialog('category');}}><Tag size={14}/>修改人物／分组</button><button className="button secondary" type="button" disabled={busy||!selected.length} onClick={()=>{setTags(selected[0]?.tags.filter(tag=>selected.every(item=>item.tags.includes(tag))).join('，')||'');setMessage('');setDialog('tags');}}><Tag size={14}/>设置内容标签</button><button className="button secondary" type="button" disabled={busy||!selected.length} onClick={()=>void apply({type:'visibility',value:'public'})}><Globe size={14}/>设为公开</button><button className="button secondary" type="button" disabled={busy||!selected.length} onClick={()=>void apply({type:'visibility',value:'private'})}><LockKeyhole size={14}/>设为私密</button><button className="button secondary" type="button" disabled={busy||!selected.length} onClick={()=>{setMessage('');setDialog('delete');}}><Trash2 size={14}/>删除所选</button></div>
    {busy&&<p className="diary-photo-tip" role="status"><LoaderCircle size={13} className="spin"/>{progress||'正在处理收藏…'}</p>}
    {message&&<p className="collection-management-message" role="status">{message}</p>}
    {dialog&&<Modal title={dialog==='category'?`修改 ${selected.length} 份收藏的分组`:dialog==='tags'?`设置 ${selected.length} 份收藏的标签`:`删除 ${selected.length} 份收藏`} onClose={()=>{if(!running.current)setDialog(null);}}>
      {dialog==='category'?<form className="form-stack" onSubmit={event=>{event.preventDefault();void apply({type:'category',value:category.trim()});}}>
        <label>人物／分组<CategoryInput value={category} onChange={setCategory} suggestions={items.map(item=>item.category)} includeDefaults={false}/></label>
        <p className="hint">例如 Jisoo。这个名称会显示在每张卡片上，也用于顶部筛选。</p>
        {message&&<p className="form-error" role="alert">{message}</p>}
        <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setDialog(null)}>取消</button><button className="button primary" disabled={busy||!category.trim()}>{busy?'正在修改…':'保存分组'}</button></div>
      </form>:dialog==='tags'?<form className="form-stack" onSubmit={event=>{event.preventDefault();void apply({type:'tags',value:[...new Set(tags.split(/[,，]/).map(value=>value.trim()).filter(Boolean))]});}}><CollectionTagInput value={tags} onChange={setTags} disabled={busy}/><p className="hint">所选收藏的标签会统一设置为这里填写的内容；人物／分组保持不变。</p>{message&&<p className="form-error" role="alert">{message}</p>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setDialog(null)}>取消</button><button className="button primary" disabled={busy}>{busy?'正在保存…':'保存标签'}</button></div></form>:<><p>确定删除以下 {selected.length} 份收藏？移入回收站后可恢复，图片和标签会保留。</p><ul className="collection-delete-list">{selected.map(item=><li key={item.id}>{item.title}<small>{item.category}</small></li>)}</ul><div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={()=>setDialog(null)}>保留收藏</button><button className="button danger" type="button" disabled={busy} onClick={()=>void apply({type:'delete'})}>{busy?'正在删除…':`删除这 ${selected.length} 份收藏`}</button></div></>}
    </Modal>}
  </div>;
}
