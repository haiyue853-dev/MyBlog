import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {remarkParagraphIndent} from '@/lib/remark-paragraph-indent';
import {remarkArticleHeadings} from '@/lib/article-headings';
import {isValidElement} from 'react';
import {attachedArticleImage,articleImageWidth,articleImageAlignment} from '@/lib/article-images';
import type {ItemImage} from '@/lib/types';
import {ArticleImage} from './article-image';

export function RecordBody({body,articleHeadings=false,images=[]}:{body:string;articleHeadings?:boolean;images?:ItemImage[]}){
  return <div className="markdown detail-body"><ReactMarkdown remarkPlugins={[remarkGfm,remarkParagraphIndent,...(articleHeadings?[remarkArticleHeadings]:[])]} components={{a:props=><a {...props} target="_blank" rel="noopener noreferrer"/>,img:({src,alt,title})=>{const image=attachedArticleImage(typeof src==='string'?src:'',images);return image?<ArticleImage image={image} caption={alt||''} width={articleImageWidth(title)} alignment={articleImageAlignment(title)}/>:null;},pre:({node,children,...props})=>{const language=isValidElement<{className?:string}>(children)?children.props.className?.replace(/^language-/,''):'';return <div className="record-code-block"><div className="record-code-label">{language||'代码'}</div><pre {...props}>{children}</pre></div>;}}}>{body}</ReactMarkdown></div>;
}
