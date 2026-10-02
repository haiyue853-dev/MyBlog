// 上传前在浏览器里把图片压一压：长边收到 1600px 以内，统一转成 WebP。
// 之所以放在前端做：后端是零依赖的纯 TS（不引入 sharp 这类需要原生二进制的库），
// 而 Canvas + toBlob 是浏览器自带的，压完再传还能顺带省掉一大半上传时间。
// 收藏馆这类一屏要铺九张图的页面，靠它才能从 8 MB 降到 1 MB 出头。

export const IMAGE_MAX_EDGE=1600;
export const IMAGE_QUALITY=0.82;

// 已经这么小的图就不再动它，免得二次有损反而变糊。
const SKIP_BELOW=400*1024;

// GIF 可能是动图，压成 WebP 只会剩下第一帧；SVG 是矢量，转位图既变大又失真。
const SKIP_TYPES=new Set(['image/gif','image/svg+xml']);

// 浏览器是照扩展名猜 type 的，文件没有扩展名时 type 是空字符串 —— 这时不能一棍子打死，
// 得自己看文件头（服务端认图本来也是靠魔数）。
async function skippableByMagic(file:File){
  try{
    const head=new Uint8Array(await file.slice(0,1024).arrayBuffer());
    const start=String.fromCharCode(...head.subarray(0,16));
    if(start.startsWith('GIF87a')||start.startsWith('GIF89a'))return true;
    if(/<\s*svg/i.test(String.fromCharCode(...head))||String.fromCharCode(...head.subarray(0,8)).includes('<?xml'))return true;
  }catch{
    // 读不出来就当不是，交给解码那一步去判。
  }
  return false;
}

export interface ImagePlan{
  file:File;
  width:number;
  height:number;
  /** 是否真的改过（缩放或转码）。false 表示原样上传。 */
  optimized:boolean;
  originalSize:number;
}

interface Decoded{
  width:number;
  height:number;
  draw(ctx:CanvasRenderingContext2D,width:number,height:number):void;
  release():void;
}

function blobToWebp(canvas:HTMLCanvasElement):Promise<Blob|null>{
  return new Promise(resolve=>{
    canvas.toBlob(blob=>resolve(blob&&blob.size?blob:null),'image/webp',IMAGE_QUALITY);
  });
}

async function decode(file:File):Promise<Decoded|null>{
  if(typeof createImageBitmap==='function'){
    try{
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      if(bitmap.width&&bitmap.height)return {width:bitmap.width,height:bitmap.height,draw:(ctx,w,h)=>ctx.drawImage(bitmap,0,0,w,h),release:()=>bitmap.close()};
      bitmap.close();
    }catch{
      // 某些浏览器不认 imageOrientation 选项，退回 <img> 解码。
    }
  }
  return new Promise(resolve=>{
    const url=URL.createObjectURL(file);const image=new Image();
    const done=(value:Decoded|null)=>{URL.revokeObjectURL(url);resolve(value);};
    image.onload=()=>done(image.naturalWidth&&image.naturalHeight?{width:image.naturalWidth,height:image.naturalHeight,draw:(ctx,w,h)=>ctx.drawImage(image,0,0,w,h),release:()=>{}}:null);
    image.onerror=()=>done(null);
    image.src=url;
  });
}

// 去掉扩展名换成 .webp，顺便把文件名里的控制字符和路径分隔符换成下划线。
function webpName(name:string){
  const stem=[...name.replace(/\.[^.]+$/,'')]
    .map(char=>{
      const code=char.charCodeAt(0);
      return code<32||char==='/'||char==='\\'?'_':char;
    })
    .join('')
    .trim();
  return `${stem||'image'}.webp`;
}

/**
 * 把一张图片压到「长边 ≤ IMAGE_MAX_EDGE 的 WebP」。
 * 返回 null 表示这张不该由我们处理（非图片、GIF、SVG、浏览器解不开），调用方直接用原文件即可。
 */
export async function optimizeImage(file:File):Promise<ImagePlan|null>{
  // type 明确写着不是图片的（PDF、文本文档…）直接放过，省掉一次注定失败的解码。
  if(file.type&&!file.type.startsWith('image/'))return null;
  if(SKIP_TYPES.has(file.type)||await skippableByMagic(file))return null;
  const decoded=await decode(file);
  if(!decoded)return null;
  try{
    const {width,height}=decoded;
    const scale=Math.min(1,IMAGE_MAX_EDGE/Math.max(width,height));
    const targetWidth=Math.max(1,Math.round(width*scale));
    const targetHeight=Math.max(1,Math.round(height*scale));
    // 只有「尺寸超标」「体积偏大」或「还是 PNG」这三种情况才值得动它。
    if(scale>=1&&file.size<=SKIP_BELOW&&file.type!=='image/png')return {file,width,height,optimized:false,originalSize:file.size};
    const canvas=document.createElement('canvas');
    canvas.width=targetWidth;canvas.height=targetHeight;
    const ctx=canvas.getContext('2d');
    if(!ctx)return {file,width,height,optimized:false,originalSize:file.size};
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    decoded.draw(ctx,targetWidth,targetHeight);
    const blob=await blobToWebp(canvas);
    // 编不出来、或者压完反而更大，就老老实实传原图。
    if(!blob||(blob.size>=file.size&&scale>=1))return {file,width,height,optimized:false,originalSize:file.size};
    return {file:new File([blob],webpName(file.name),{type:'image/webp'}),width:targetWidth,height:targetHeight,optimized:true,originalSize:file.size};
  }finally{
    decoded.release();
  }
}
