import QRCode from 'qrcode';
import {fileUrl} from './client';
import {wrapPosterText,type ArticleShareData} from './article-share-data';
import {articleCoverCrop,coverImageRect} from './article-cover';

const FONT='"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';
export const SHARE_POSTER_SIZE={width:1080,height:1440};
function loadCover(id:string,signal:AbortSignal):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{
    const image=new Image();const timer=setTimeout(()=>finish(new Error('封面加载较慢，请重新生成。')),12000);
    function finish(error?:Error){clearTimeout(timer);image.onload=null;image.onerror=null;signal.removeEventListener('abort',abort);if(error){image.src='';reject(error);}else resolve(image);}
    function abort(){finish(new DOMException('已取消生成','AbortError'));}
    image.onload=()=>finish();image.onerror=()=>finish(new Error('封面加载失败，请重新生成。'));
    if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});image.src=fileUrl(id,true);
  });
}
function text(context:CanvasRenderingContext2D,value:string,x:number,y:number,width:number,size:number,lineHeight:number,maxLines:number,color:string,weight=400){
  context.font=`${weight} ${size}px ${FONT}`;context.fillStyle=color;
  wrapPosterText(value,string=>context.measureText(string).width,width,maxLines).forEach((line,index)=>context.fillText(line,x,y+index*lineHeight));
}
function rounded(context:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,radius:number,color:string){context.beginPath();context.roundRect(x,y,width,height,radius);context.fillStyle=color;context.fill();}
export async function createSharePoster(data:ArticleShareData,signal:AbortSignal):Promise<Blob>{
  const cover=data.coverId?await loadCover(data.coverId,signal):null;
  await document.fonts.ready;signal.throwIfAborted();
  const canvas=document.createElement('canvas');canvas.width=SHARE_POSTER_SIZE.width;canvas.height=SHARE_POSTER_SIZE.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('图片生成失败，请换一个浏览器重试。');
  ctx.fillStyle='#f5e5df';ctx.fillRect(0,0,1080,1440);rounded(ctx,24,24,1032,1392,40,'#fffaf3');
  text(ctx,data.siteName,64,99,900,30,40,1,data.accent,600);
  text(ctx,'把日常收好，把喜欢留下。',64,146,900,21,30,1,'#ac9080');
  ctx.save();ctx.beginPath();ctx.roundRect(64,190,952,410,28);ctx.clip();
  if(cover){
    const rect=coverImageRect(articleCoverCrop(data),{imageWidth:cover.naturalWidth,imageHeight:cover.naturalHeight,frameWidth:952,frameHeight:410});
    ctx.drawImage(cover,64+rect.left,190+rect.top,rect.width,rect.height);
  }else{
    const gradient=ctx.createLinearGradient(64,190,1016,600);gradient.addColorStop(0,'#f5dce5');gradient.addColorStop(1,'#f4e8ce');ctx.fillStyle=gradient;ctx.fillRect(64,190,952,410);
    ctx.strokeStyle='#ffffffaa';ctx.lineWidth=2;for(const radius of [70,130,200]){ctx.beginPath();ctx.arc(860,305,radius,0,Math.PI*2);ctx.stroke();}
    text(ctx,'♫',116,384,300,112,130,1,data.accent);text(ctx,'一些值得留下的瞬间',116,510,700,32,46,1,'#91786a');
  }
  ctx.restore();text(ctx,data.category,64,655,950,25,34,1,data.accent,600);
  text(ctx,data.title,64,727,950,54,74,3,'#453f3b',700);
  text(ctx,data.summary,64,941,950,28,42,3,'#887970');
  text(ctx,`${data.date}   ·   ${data.characters} 字   ·   约 ${data.minutes} 分钟`,64,1082,950,23,30,1,'#ad8d7b');
  ctx.strokeStyle='#eadbd1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(64,1114);ctx.lineTo(1016,1114);ctx.stroke();
  text(ctx,data.author,64,1208,610,30,42,2,'#453f3b',600);
  text(ctx,'扫码，慢慢读完这篇故事',64,1306,610,25,36,1,data.accent);
  text(ctx,new URL(data.url).host,64,1350,610,21,30,1,'#a99383');
  // Use integer-sized modules and a four-module quiet zone, independent of the site accent.
  const qr=QRCode.create(data.url,{errorCorrectionLevel:'M'});const quiet=4;const size=240;const cell=Math.floor(size/(qr.modules.size+quiet*2));const extent=(qr.modules.size+quiet*2)*cell;const startX=776+Math.floor((size-extent)/2);const startY=1138+Math.floor((size-extent)/2);
  ctx.fillStyle='#ffffff';ctx.fillRect(776,1138,size,size);ctx.fillStyle='#453f3b';
  for(let row=0;row<qr.modules.size;row++)for(let column=0;column<qr.modules.size;column++)if(qr.modules.get(row,column))ctx.fillRect(startX+(column+quiet)*cell,startY+(row+quiet)*cell,cell,cell);
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片生成失败，请重新生成。')),'image/png'));
}
