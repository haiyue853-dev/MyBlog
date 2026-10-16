import {TRAVEL_MAP_SIZE} from './travel';

export type MapPoint={x:number;y:number};
export type MapViewport=MapPoint&{scale:number};
export type MapBounds=MapPoint&{width:number;height:number};
export const NATIONAL_VIEW:MapViewport={scale:1,x:0,y:0};
export const MAX_MAP_SCALE=16;
const {width,height}=TRAVEL_MAP_SIZE;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

export function clampViewport(view:MapViewport):MapViewport{
  const scale=clamp(view.scale,1,MAX_MAP_SCALE);
  return {scale,x:clamp(view.x,width*(1-scale),0),y:clamp(view.y,height*(1-scale),0)};
}
export function zoomViewport(view:MapViewport,factor:number,anchor:MapPoint):MapViewport{
  const scale=clamp(view.scale*factor,1,MAX_MAP_SCALE);
  return clampViewport({scale,x:anchor.x-(anchor.x-view.x)*scale/view.scale,y:anchor.y-(anchor.y-view.y)*scale/view.scale});
}
export function panViewport(view:MapViewport,x:number,y:number):MapViewport{
  return clampViewport({...view,x:view.x+x,y:view.y+y});
}
export function pinchViewport(view:MapViewport,before:[MapPoint,MapPoint],after:[MapPoint,MapPoint]):MapViewport{
  const start={x:(before[0].x+before[1].x)/2,y:(before[0].y+before[1].y)/2};
  const end={x:(after[0].x+after[1].x)/2,y:(after[0].y+after[1].y)/2};
  const factor=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y)/Math.max(1,Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y));
  return panViewport(zoomViewport(view,factor,start),end.x-start.x,end.y-start.y);
}
export function fitViewport(bounds:MapBounds):MapViewport{
  const scale=clamp(Math.min(width/(Math.max(bounds.width,1)*1.3),height/(Math.max(bounds.height,1)*1.3)),1,MAX_MAP_SCALE);
  return clampViewport({scale,x:width/2-(bounds.x+bounds.width/2)*scale,y:height/2-(bounds.y+bounds.height/2)*scale});
}
export function nearestMarker<T extends MapPoint>(markers:T[],point:MapPoint,radius:number):T|undefined{
  let closest:T|undefined;let distance=radius;
  for(const marker of markers){const next=Math.hypot(marker.x-point.x,marker.y-point.y);if(next<=distance){closest=marker;distance=next;}}
  return closest;
}
