import type {ArticleConfig,ArticleCoverCrop} from './types';

export const MAX_COVER_ZOOM=3;
export type CoverSize={imageWidth:number;imageHeight:number;frameWidth:number;frameHeight:number};
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:min));
export function validCoverCrop(value:unknown):value is ArticleCoverCrop{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as ArticleCoverCrop;
  return [v.x,v.y,v.zoom].every(n=>typeof n==='number'&&Number.isFinite(n))&&v.x>=0&&v.x<=100&&v.y>=0&&v.y<=100&&v.zoom>=1&&v.zoom<=MAX_COVER_ZOOM;
}
export function articleCoverCrop(config:Pick<ArticleConfig,'coverPosition'|'coverCrop'>):ArticleCoverCrop{
  return validCoverCrop(config.coverCrop)?config.coverCrop:{x:50,y:config.coverPosition==='top'?0:config.coverPosition==='bottom'?100:50,zoom:1};
}
export function articleCoverStyle(config:Pick<ArticleConfig,'coverPosition'|'coverCrop'>){
  return coverCropStyle(articleCoverCrop(config));
}
export function coverCropStyle(crop:ArticleCoverCrop){
  const anchor=`${crop.x}% ${crop.y}%`;
  return {objectPosition:anchor,transform:`scale(${crop.zoom})`,transformOrigin:anchor};
}
export function coverImageRect(crop:ArticleCoverCrop,size:CoverSize){
  const scale=Math.max(size.frameWidth/size.imageWidth,size.frameHeight/size.imageHeight)*crop.zoom;
  const width=size.imageWidth*scale;const height=size.imageHeight*scale;
  return {width,height,left:(size.frameWidth-width)*crop.x/100,top:(size.frameHeight-height)*crop.y/100};
}
export function moveCoverCrop(crop:ArticleCoverCrop,dx:number,dy:number,size:CoverSize):ArticleCoverCrop{
  const rect=coverImageRect(crop,size);const overflowX=Math.max(0,rect.width-size.frameWidth);const overflowY=Math.max(0,rect.height-size.frameHeight);
  return {...crop,x:overflowX>.01?clamp(crop.x-dx/overflowX*100,0,100):crop.x,y:overflowY>.01?clamp(crop.y-dy/overflowY*100,0,100):crop.y};
}
