import type {ItemImage} from './types';
import type {TextEdit} from './text-format';
import {fromMarkdown} from 'mdast-util-from-markdown';
import type {Definition,RootContent} from 'mdast';

export type ArticleImageWidth='normal'|'wide'|number;
export type ArticleImageAlignment='left'|'center'|'right';
export interface ArticleImageOccurrence {start:number;end:number;raw:string;image:ItemImage;caption:string;width:ArticleImageWidth;alignment:ArticleImageAlignment}
export function articleImageWidth(title:string|null|undefined):ArticleImageWidth{
  title=title?.replace(/-(left|center|right)$/,'');
  if(title==='article-wide')return 'wide';
  const number=title?.match(/^article-(\d+)$/)?.[1];const width=Number(number);
  return number&&width>=25&&width<=100&&width%5===0?width:'normal';
}
export function articleImageAlignment(title:string|null|undefined):ArticleImageAlignment{return title?.match(/^article-(?:normal|wide|\d+)-(left|center|right)$/)?.[1] as ArticleImageAlignment||'center';}
export function articleImageWidthLabel(width:ArticleImageWidth){return typeof width==='number'?`${width}%`:width==='wide'?'通栏':'普通宽度';}
export function attachedArticleImage(src:string,images:ItemImage[]){
  const id=src.match(/^\/api\/files\/([a-f0-9-]{36})(?:\?inline=1)?$/)?.[1];
  return id?images.find(image=>image.assetId===id):undefined;
}
export function formatArticleImage(text:string,offset:number,assetId:string,caption:string,width:ArticleImageWidth,alignment:ArticleImageAlignment='center'):TextEdit{
  if(!/^[a-f0-9-]{36}$/.test(assetId))return {text,start:offset,end:offset};
  const markdown=imageMarkdown(assetId,caption,width,alignment);
  const before=text.slice(0,offset);const after=text.slice(offset);
  const prefix=before&&!before.endsWith('\n\n')?(before.endsWith('\n')?'\n':'\n\n'):'';
  const suffix=after.startsWith('\n\n')?'':after.startsWith('\n')?'\n':'\n\n';
  const inserted=prefix+markdown+suffix;const cursor=before.length+inserted.length;
  return {text:before+inserted+after,start:cursor,end:cursor};
}
function imageMarkdown(assetId:string,caption:string,width:ArticleImageWidth,alignment:ArticleImageAlignment){
  const label=caption.trim().replace(/\r?\n/g,' ').replace(/\\/g,'\\\\').replace(/[\[\]()]/g,'\\$&');
  const safeWidth=articleImageWidth(`article-${width}`);
  const align=alignment==='left'||alignment==='right'?`-${alignment}`:'';
  return `![${label}](/api/files/${assetId}?inline=1 "article-${safeWidth}${align}")`;
}
export function articleImageOccurrences(text:string,images:ItemImage[]):ArticleImageOccurrence[]{
  const occurrences:ArticleImageOccurrence[]=[];const tree=fromMarkdown(text);
  const definitions=new Map<string,Definition>();
  function collectDefinitions(node:RootContent){
    if(node.type==='definition'&&!definitions.has(node.identifier))definitions.set(node.identifier,node);
    if('children' in node)for(const child of node.children)collectDefinitions(child);
  }
  for(const node of tree.children)collectDefinitions(node);
  function visit(node:RootContent){
    if(node.type==='image'||node.type==='imageReference'){
      const definition=node.type==='imageReference'?definitions.get(node.identifier):undefined;
      const src=node.type==='image'?node.url:definition?.url;
      const image=attachedArticleImage(src||'',images);const start=node.position?.start.offset;const end=node.position?.end.offset;
      const title=node.type==='image'?node.title:definition?.title;
      if(image&&start!==undefined&&end!==undefined)occurrences.push({start,end,raw:text.slice(start,end),image,caption:node.alt||'',width:articleImageWidth(title),alignment:articleImageAlignment(title)});
    }
    if('children' in node)for(const child of node.children)visit(child);
  }
  for(const node of tree.children)visit(node);
  return occurrences;
}
export function updateArticleImage(text:string,occurrence:ArticleImageOccurrence,caption:string,width:ArticleImageWidth,alignment:ArticleImageAlignment=occurrence.alignment):TextEdit{
  if(text.slice(occurrence.start,occurrence.end)!==occurrence.raw)throw new Error('正文已经变化，请重新打开图片调整。');
  const markup=imageMarkdown(occurrence.image.assetId,caption,width,alignment);
  return {text:text.slice(0,occurrence.start)+markup+text.slice(occurrence.end),start:occurrence.start,end:occurrence.start+markup.length};
}
