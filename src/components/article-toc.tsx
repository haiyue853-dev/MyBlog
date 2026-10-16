'use client';
import {useEffect,useRef,useState,type CSSProperties,type MouseEvent,type RefObject} from 'react';
import {Check,ChevronDown,Copy,ListTree} from 'lucide-react';

interface Chapter{id:string;title:string;level:number}

export function ArticleToc({bodyRef,body,articleId}:{bodyRef:RefObject<HTMLDivElement|null>;body:string;articleId:string}){
  const [chapters,setChapters]=useState<Chapter[]>([]);
  const [active,setActive]=useState('');const [expanded,setExpanded]=useState(false);
  const [copied,setCopied]=useState('');const [message,setMessage]=useState('');const [fallback,setFallback]=useState('');
  const feedbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const navigationFrame=useRef(0);
  useEffect(()=>{
    const content=bodyRef.current;if(!content)return;
    const headings=Array.from(content.querySelectorAll<HTMLElement>('[data-article-heading]'));
    setChapters(headings.map(node=>({id:node.id,title:node.textContent?.trim()||'未命名章节',level:Number(node.dataset.articleHeading)})));
    setExpanded(false);setCopied('');setMessage('');setFallback('');
    if(!headings.length){setActive('');return;}
    const layout=content.closest<HTMLElement>('.article-reading-layout');
    const header=document.querySelector<HTMLElement>('.site-header');
    let offset=120;let frame=0;let hashFrame=0;
    function update(){
      frame=0;
      let current=headings[0].id;
      for(const heading of headings){if(heading.getBoundingClientRect().top<=offset+4)current=heading.id;else break;}
      setActive(current);
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(update);}
    function measure(){offset=(header?.getBoundingClientRect().height||96)+24;layout?.style.setProperty('--article-anchor-offset',`${offset}px`);schedule();}
    function fromHash(){
      let id='';try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
      const target=headings.find(heading=>heading.id===id);if(!target)return;
      cancelAnimationFrame(hashFrame);hashFrame=requestAnimationFrame(()=>{target.scrollIntoView({block:'start',behavior:'instant'});update();});
    }
    measure();fromHash();
    window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',measure);
    window.addEventListener('hashchange',fromHash);window.addEventListener('popstate',fromHash);
    const resize=new ResizeObserver(measure);resize.observe(content);if(header)resize.observe(header);
    return()=>{window.removeEventListener('scroll',schedule);window.removeEventListener('resize',measure);window.removeEventListener('hashchange',fromHash);window.removeEventListener('popstate',fromHash);resize.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(hashFrame);};
  },[body,bodyRef,articleId]);
  useEffect(()=>()=>{if(feedbackTimer.current)clearTimeout(feedbackTimer.current);cancelAnimationFrame(navigationFrame.current);},[]);

  function locate(event:MouseEvent<HTMLAnchorElement>,id:string){
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('[data-article-heading]')||[]).find(node=>node.id===id);if(!target)return;
    event.preventDefault();setExpanded(false);setActive(id);
    const url=new URL(location.href);url.hash=id;
    if(location.hash!==url.hash)history.pushState(null,'',url);
    cancelAnimationFrame(navigationFrame.current);
    navigationFrame.current=requestAnimationFrame(()=>{
      const reduced=target.closest('.motion-off')||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'});target.focus({preventScroll:true});
    });
  }
  async function copy(chapter:Chapter){
    if(feedbackTimer.current)clearTimeout(feedbackTimer.current);
    const url=new URL(`/posts/${encodeURIComponent(articleId)}`,location.origin);url.hash=chapter.id;
    try{await navigator.clipboard.writeText(url.href);setCopied(chapter.id);setFallback('');setMessage(`已复制“${chapter.title}”的章节链接`);feedbackTimer.current=setTimeout(()=>{setCopied('');setMessage('');},2600);}
    catch{setCopied('');setFallback(url.href);setMessage('可选中下方链接复制。');}
  }
  if(!chapters.length)return null;
  const baseLevel=Math.min(...chapters.map(chapter=>chapter.level));
  return <nav className="article-toc paper" aria-label="本文目录" data-expanded={expanded}>
    <div className="article-toc-desktop-heading"><ListTree size={17}/><h2>本文目录</h2><small>{chapters.length}</small></div>
    <button type="button" className="article-toc-toggle" aria-expanded={expanded} aria-controls={`article-toc-${articleId}`} onClick={()=>setExpanded(!expanded)}><ListTree size={17}/><span>本文目录</span><small>{chapters.length} 个章节</small><ChevronDown size={15}/></button>
    <div className="article-toc-content" id={`article-toc-${articleId}`}>
      <ol>{chapters.map(chapter=><li key={chapter.id} className={`article-toc-row ${chapter.id===active?'is-current':''}`} style={{'--toc-level':Math.max(0,chapter.level-baseLevel)} as CSSProperties}><a href={`#${encodeURIComponent(chapter.id)}`} aria-current={chapter.id===active?'location':undefined} onClick={event=>locate(event,chapter.id)}>{chapter.title}</a><button type="button" className="article-toc-copy" aria-label={`复制“${chapter.title}”的章节链接`} title="复制章节链接" onClick={()=>void copy(chapter)}>{copied===chapter.id?<Check size={13}/>:<Copy size={13}/>}</button></li>)}</ol>
      <p className="article-toc-feedback" role="status">{message}</p>{fallback&&<label className="article-toc-fallback">章节链接<input value={fallback} readOnly onFocus={event=>event.currentTarget.select()}/></label>}
    </div>
  </nav>;
}
