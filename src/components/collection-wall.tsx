'use client';
import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Disc3,Heart,Pencil,Trash2} from 'lucide-react';
import {dateLabel,fileUrl} from '@/lib/client';
import {cardAspect,type Item} from '@/lib/types';

// 把卡片分到尽量等高的几摞里。
//
// 为什么不在 CSS 里用多列：CSS 多列只能「按顺序切成连续几段」来平衡，切点不理想就会让最后一列短一截
// （把 1:2 ~ 2:1 的比例混在一起实测是 1299 / 1244 / 733 像素，差 77%）；而且浏览器自己那次平衡是近似的，
// 就算先替它排好，它也会再切一刀把结果拉偏。所以这里直接算好分配、自己生成列容器，不交给 CSS。
//
// 每页只有 9 张，暴力枚举 columns^9 种分配完全够快（3 列 = 19683 次，亚毫秒）。
// 高度按 `1/比例 + 固定余量` 估算：白边、描边、卡片间距对每张卡都一样，等宽的各列里它们不影响比较，
// 只是让矮卡相对贵一点，所以估一个常数足够 —— 不值得为此去读四五个计算样式。
const CARD_CHROME=0.15;
function balanceColumns(items:Item[],columns:number):Item[][]{
  if(columns<2||items.length<2)return [items];
  const height=items.map(item=>1/(Number(cardAspect(item))||2/3)+CARD_CHROME);
  const combinations=columns**items.length;
  if(combinations>400000)return [items];
  let bestCode=-1;let bestScore=Infinity;
  for(let code=0;code<combinations;code++){
    const sums=new Array(columns).fill(0);let rest=code;let drift=0;
    for(let i=0;i<height.length;i++){
      const column=rest%columns;rest=(rest-column)/columns;
      sums[column]+=height[i];
      drift+=Math.abs(column-i%columns);
    }
    // 主目标是「最高的那一摞尽量矮」。高度打平时（比如 9 张比例完全一样）会有大量并列解，
    // 这时用 drift 做次级偏好：偏向让卡片按原来的先后从左到右铺开，而不是被枚举顺序随手挑一个倒过来的排法。
    // 1e-6 的权重远小于任何真实的高度差，不会喧宾夺主。
    const score=Math.max(...sums)+drift*1e-6;
    if(score<bestScore-1e-9){bestScore=score;bestCode=code;}
  }
  if(bestCode<0)return [items];
  const buckets:Item[][]=Array.from({length:columns},()=>[]);
  let rest=bestCode;
  // 按原顺序 push：平衡只决定「哪张进哪一摞」，摞内的先后仍是时间倒序，不会被打乱。
  for(const item of items){const column=rest%columns;rest=(rest-column)/columns;buckets[column].push(item);}
  return buckets;
}

// 收藏馆的瀑布流卡片墙。
//
// 几件事决定了这里的结构：
// ① 每张卡有自己的宽高比（`cardAspect`），所以高度不齐。比例优先取手动选的形状，
//    其次取上传时量到的原图尺寸，都没有才退回 2:3。
// ② 卡片是「奶白卡纸 + 一圈印刷白边 + 里面一张照片」，像实体小卡。所以有两层：
//    外层 `.poster-card` 是卡纸和白边，内层 `.poster-frame` 才是照片，比例也长在内层上。
// ③ 照片上那层铺满的 <button> 负责点开详情；喜欢/编辑/删除必须是它的**兄弟节点**
//    （HTML 不允许 button 套 button），所以用绝对定位叠上去，而不是写进 <button> 里。
// ④ 列数是 CSS 用自定义属性 `--wall-columns` 定的（断点只写在一处），JS 读回来决定分几摞，
//    免得同一个断点在 CSS 和 JS 各写一遍、日后改一处忘一处。
//
// 触屏没有 hover，CSS 里对 `@media(hover:none)` 让按钮和信息条常驻，否则手机上只剩一张没名字的图。
export function CollectionWall({items,owner,liked,onLike,onOpen,onEdit,onRemove}:{
  items:Item[];
  owner:boolean;
  liked:string[];
  onLike:(id:string)=>void;
  onOpen:(item:Item)=>void;
  onEdit:(item:Item)=>void;
  onRemove:(item:Item)=>void;
}){
  const wall=useRef<HTMLDivElement>(null);
  const [columns,setColumns]=useState(1);
  // 用 layout effect：要在首次绘制前就把分列算好，否则会先闪一下没平衡的单列排布。
  useLayoutEffect(()=>{
    const element=wall.current;if(!element)return;
    const sync=()=>{const value=Number.parseInt(getComputedStyle(element).getPropertyValue('--wall-columns'),10);setColumns(Number.isFinite(value)&&value>1?value:1);};
    sync();
    // 容器宽度会跟着断点/侧栏变化，变了就重新读一次列数。
    const observer=new ResizeObserver(sync);observer.observe(element);
    return()=>observer.disconnect();
  },[]);
  const buckets=useMemo(()=>balanceColumns(items,columns),[items,columns]);
  return <div className="collection-wall" ref={wall}>{buckets.map((bucket,index)=><div className="wall-column" key={index}>
    {bucket.map(item=><article className="poster-card" key={item.id}>
      <div className="poster-frame" style={{aspectRatio:cardAspect(item)}}>
        <button className="poster-open" onClick={()=>onOpen(item)} aria-label={`查看 ${item.title}`}>
          {item.assetId?<img src={fileUrl(item.assetId,true)} alt="" loading="lazy"/>:<span className="poster-blank"><Disc3 size={38}/><span>no cover yet</span></span>}
        </button>
        <span className="poster-badge">{item.category||'收藏'}</span>
        <div className="poster-tools">
          <button className="poster-tool" onClick={()=>onLike(item.id)} aria-pressed={liked.includes(item.id)} aria-label={liked.includes(item.id)?`取消喜欢 ${item.title}`:`喜欢 ${item.title}`}><Heart size={14}/></button>
          {owner&&<><button className="poster-tool" onClick={()=>onEdit(item)} aria-label={`编辑 ${item.title}`}><Pencil size={13}/></button><button className="poster-tool" onClick={()=>onRemove(item)} aria-label={`删除 ${item.title}`}><Trash2 size={13}/></button></>}
        </div>
        <div className="poster-veil">
          <h3>{item.title}</h3>
          <span>{dateLabel(item.createdAt)}{item.tags.length?` · ${item.tags.slice(0,2).map(value=>'#'+value).join(' ')}`:''}</span>
        </div>
      </div>
    </article>)}
  </div>)}</div>;
}
