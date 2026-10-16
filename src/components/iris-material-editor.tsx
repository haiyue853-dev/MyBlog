'use client';
import {useId,useImperativeHandle,useLayoutEffect,useRef,type Ref,type KeyboardEventHandler} from 'react';
import {articleImageOccurrences,formatArticleImage,type ArticleImageAlignment,type ArticleImageWidth} from '@/lib/article-images';
import {fileUrl} from '@/lib/client';
import type {IrisMaterial} from '@/lib/iris-blog-workspace';
import type {TextEdit} from '@/lib/text-format';

export interface IrisMaterialEditorHandle {captureSelection:()=>void;insertImages:(images:IrisMaterial[])=>void;getSelection:()=>{start:number;end:number};applyEdit:(edit:TextEdit)=>void;}
export function materialImageMarkup(image:IrisMaterial){return formatArticleImage('',0,image.id,'','normal').text.trim();}

function readEditor(node:Node):string{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent||'';
  if(!(node instanceof HTMLElement))return '';
  if(node.dataset.imageMarkup)return node.dataset.imageMarkup;
  if(node.tagName==='BR')return '\n';
  let text='';
  for(const child of Array.from(node.childNodes)){
    const block=child instanceof HTMLElement&&['DIV','P'].includes(child.tagName);
    if(block&&text&&!text.endsWith('\n'))text+='\n';
    text+=readEditor(child);
    if(block&&child.nextSibling&&!text.endsWith('\n'))text+='\n';
  }
  return text;
}

export function IrisMaterialEditor({ref,id,ariaLabel='博客整理要求',maxLength=10000,value,materials,disabled,onChange,onFiles,onSelectionChange,onKeyDown}:{ref?:Ref<IrisMaterialEditorHandle>;id?:string;ariaLabel?:string;maxLength?:number;value:string;materials:IrisMaterial[];disabled:boolean;onChange:(value:string)=>void;onFiles:(files:File[])=>void;onSelectionChange?:(selection:{start:number;end:number})=>void;onKeyDown?:KeyboardEventHandler<HTMLDivElement>}){
  const hintId=useId();const pendingSelection=useRef<{start:number;end:number}|null>(null);
  const editor=useRef<HTMLDivElement>(null);const selection=useRef<Range|null>(null);const lastValue=useRef<string|null>(null);const focusAfterInsert=useRef(false);
  function offsets(){
    const root=editor.current;const range=selection.current;if(!root||!range||!root.contains(range.commonAncestorContainer))return {start:value.length,end:value.length};
    function before(node:Node,offset:number){const prefix=document.createRange();prefix.selectNodeContents(root!);prefix.setEnd(node,offset);const wrapper=document.createElement('div');wrapper.append(prefix.cloneContents());return readEditor(wrapper).length;}
    return {start:before(range.startContainer,range.startOffset),end:before(range.endContainer,range.endOffset)};
  }
  function remember(){const selected=window.getSelection();if(selected?.rangeCount&&editor.current?.contains(selected.anchorNode)&&editor.current.contains(selected.focusNode)){selection.current=selected.getRangeAt(0).cloneRange();onSelectionChange?.(offsets());}}
  function restoreSelection(position:{start:number;end:number}){
    const root=editor.current;if(!root)return;
    function point(offset:number):[Node,number]{let remaining=offset;const nodes=Array.from(root!.childNodes);for(const [index,node] of nodes.entries()){const image=node instanceof HTMLElement?node.dataset.imageMarkup:undefined;const length=image?.length??node.textContent?.length??0;if(remaining<=length)return image?[root!,index+(remaining>0?1:0)]:[node,remaining];remaining-=length;}return [root!,nodes.length];}
    const range=document.createRange();range.setStart(...point(position.start));range.setEnd(...point(position.end));root.focus();const selected=window.getSelection();selected?.removeAllRanges();selected?.addRange(range);selection.current=range;onSelectionChange?.(position);
  }
  function imageNode(image:IrisMaterial,markup:string){
    const figure=document.createElement('span');figure.contentEditable='false';figure.className='iris-material-image';figure.dataset.imageMarkup=markup;figure.dataset.imageId=image.id;figure.tabIndex=0;
    const tools=document.createElement('span');tools.className='iris-material-image-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label',`图片排版 ${image.name}`);
    for(const [alignment,label] of [['left','左对齐'],['center','居中'],['right','右对齐']] as const){const button=document.createElement('button');button.type='button';button.dataset.imageAlignAction=alignment;button.textContent=label;button.disabled=disabled;tools.append(button);}
    const size=document.createElement('select');size.dataset.imageSize='true';size.setAttribute('aria-label',`图片大小 ${image.name}`);size.disabled=disabled;
    for(const [value,label] of [['normal','适中'],['25','25%'],['50','50%'],['75','75%'],['wide','100%']]){const option=document.createElement('option');option.value=value;option.textContent=label;size.append(option);}tools.append(size);
    const slider=document.createElement('input');slider.type='range';slider.min='25';slider.max='100';slider.step='5';slider.dataset.imageSize='true';slider.setAttribute('aria-label',`图片宽度 ${image.name}`);slider.disabled=disabled;tools.append(slider);
    const photo=document.createElement('img');photo.src=fileUrl(image.id,true);photo.alt=image.name;photo.draggable=false;
    const remove=document.createElement('button');remove.type='button';remove.className='iris-material-image-remove';remove.dataset.removeImage='true';remove.setAttribute('aria-label',`移除图片 ${image.name}`);remove.textContent='×';remove.disabled=disabled;
    figure.append(tools,photo,remove);applyImageLayout(figure);return figure;
  }
  function applyImageLayout(figure:HTMLElement,width?:ArticleImageWidth,alignment?:ArticleImageAlignment){
    const current=articleImageOccurrences(figure.dataset.imageMarkup||'',[{assetId:figure.dataset.imageId!}])[0];if(!current)return;
    const nextWidth=width??current.width;const nextAlign=alignment??current.alignment;
    if(width!==undefined||alignment!==undefined)figure.dataset.imageMarkup=formatArticleImage('',0,current.image.assetId,current.caption,nextWidth,nextAlign).text.trim();
    figure.dataset.imageAlign=nextAlign;figure.style.width='100%';
    const photo=figure.querySelector('img');if(photo)photo.style.width=typeof nextWidth==='number'?`${nextWidth}%`:nextWidth==='wide'?'100%':'min(100%, 560px)';
    figure.querySelectorAll<HTMLButtonElement>('[data-image-align-action]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.imageAlignAction===nextAlign)));
    const size=figure.querySelector<HTMLSelectElement>('[data-image-size]');if(size){if(!Array.from(size.options).some(option=>option.value===String(nextWidth))){const option=document.createElement('option');option.value=String(nextWidth);option.textContent=`${nextWidth}%`;size.append(option);}size.value=String(nextWidth);}
    const slider=figure.querySelector<HTMLInputElement>('input[data-image-size]');if(slider)slider.value=String(typeof nextWidth==='number'?nextWidth:nextWidth==='wide'?100:75);
  }
  function render(text:string){
    const root=editor.current;if(!root)return;
    const fragment=document.createDocumentFragment();const images=materials.filter(image=>image.mime.startsWith('image/'));
    let offset=0;
    for(const occurrence of articleImageOccurrences(text,images.map(image=>({assetId:image.id})))){
      fragment.append(document.createTextNode(text.slice(offset,occurrence.start)),imageNode(images.find(image=>image.id===occurrence.image.assetId)!,occurrence.raw));offset=occurrence.end;
    }
    fragment.append(document.createTextNode(text.slice(offset)));root.replaceChildren(fragment);lastValue.current=text;
  }
  useLayoutEffect(()=>{if(lastValue.current!==value)render(value);if(pendingSelection.current){restoreSelection(pendingSelection.current);pendingSelection.current=null;}});
  useLayoutEffect(()=>{if(!disabled&&focusAfterInsert.current&&editor.current){editor.current.focus();const selected=window.getSelection();if(selection.current&&editor.current.contains(selection.current.commonAncestorContainer)){selected?.removeAllRanges();selected?.addRange(selection.current);}focusAfterInsert.current=false;}});
  useLayoutEffect(()=>{editor.current?.querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>('button,select,input').forEach(control=>{control.disabled=disabled;});},[disabled]);
  function emit(){
    if(!editor.current)return;
    const text=readEditor(editor.current);
    if(text.length>maxLength){render(lastValue.current||'');return;}
    lastValue.current=text;onChange(text);remember();
  }
  function insert(nodes:Node[]){
    const root=editor.current;if(!root)return;
    root.focus();let range=selection.current;
    if(!range||!root.contains(range.commonAncestorContainer)){range=document.createRange();range.selectNodeContents(root);range.collapse(false);}
    const container=range.startContainer instanceof HTMLElement?range.startContainer:range.startContainer.parentElement;const image=container?.closest('[data-image-markup]');
    if(image&&root.contains(image)){range.setStartAfter(image);range.collapse(true);}
    range.deleteContents();const fragment=document.createDocumentFragment();nodes.forEach(node=>fragment.append(node));const last=nodes.at(-1);range.insertNode(fragment);
    if(last){range.setStartAfter(last);range.collapse(true);const selected=window.getSelection();selected?.removeAllRanges();selected?.addRange(range);selection.current=range.cloneRange();}
    focusAfterInsert.current=true;emit();
  }
  useImperativeHandle(ref,()=>({captureSelection:remember,getSelection(){remember();return offsets();},applyEdit(edit){if(edit.text===value){restoreSelection(edit);return;}pendingSelection.current=edit;onChange(edit.text);},insertImages(images){
    const added=images.reduce((count,image)=>count+materialImageMarkup(image).length+4,0);
    if((lastValue.current?.length||0)+added>maxLength)throw new Error(`文字和配图位置超过 ${maxLength} 字，请缩短后再添加图片。`);
    insert(images.flatMap(image=>[document.createTextNode('\n\n'),imageNode(image,materialImageMarkup(image)),document.createTextNode('\n\n')]));
  }}));
  return <div className="iris-material-editor-wrap">
    <div id={id} ref={editor} className="iris-material-editor" role="textbox" aria-label={ariaLabel} aria-multiline="true" aria-disabled={disabled} aria-describedby={hintId} contentEditable={!disabled} suppressContentEditableWarning data-placeholder="写下想法，在光标位置插入图片，再接着写…"
      onInput={event=>{const target=event.target;if((target instanceof HTMLSelectElement||target instanceof HTMLInputElement)&&target.matches('[data-image-size]')){if(disabled)return;const figure=target.closest<HTMLElement>('[data-image-markup]');if(figure)applyImageLayout(figure,target.value==='normal'||target.value==='wide'?target.value:Number(target.value));}emit();}} onBlur={remember} onKeyUp={remember} onMouseUp={remember} onSelect={remember} onKeyDown={onKeyDown}
      onClick={event=>{
        if(disabled)return;const target=event.target as HTMLElement;const figure=target.closest<HTMLElement>('[data-image-markup]');if(!figure)return;
        editor.current?.querySelectorAll('.iris-material-image.is-selected').forEach(image=>image.classList.remove('is-selected'));figure.classList.add('is-selected');
        if(target.closest('[data-remove-image]')){event.preventDefault();figure.remove();emit();return;}
        const align=target.closest<HTMLElement>('[data-image-align-action]')?.dataset.imageAlignAction as ArticleImageAlignment|undefined;
        if(align){applyImageLayout(figure,undefined,align);emit();}
      }}
      onPaste={event=>{if(disabled)return;event.preventDefault();remember();const files=Array.from(event.clipboardData.files);if(files.length){onFiles(files);return;}insert([document.createTextNode(event.clipboardData.getData('text/plain'))]);}}
      onDragOver={event=>{if(Array.from(event.dataTransfer.types).includes('Files')){event.preventDefault();event.dataTransfer.dropEffect=disabled?'none':'copy';}}}
      onDrop={event=>{event.preventDefault();if(disabled)return;const files=Array.from(event.dataTransfer.files);if(!files.length)return;const range=document.caretRangeFromPoint?.(event.clientX,event.clientY);if(range&&editor.current?.contains(range.commonAncestorContainer))selection.current=range;else remember();onFiles(files);}}/>
    <p id={hintId} className="hint">在文字间插入图片，也可以粘贴截图或拖入图片；点击图片调整对齐和大小，插入后继续写。</p>
  </div>;
}
