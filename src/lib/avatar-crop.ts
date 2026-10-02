export type AvatarCenter={x:number;y:number};

// 坐标使用原图像素；预览和 Canvas 导出共用同一个裁剪框。
export function avatarCrop(width:number,height:number,zoom:number,center:AvatarCenter={x:.5,y:.5}){
  const size=Math.min(width,height)/zoom;
  const x=Math.min(width-size,Math.max(0,center.x*width-size/2));
  const y=Math.min(height-size,Math.max(0,center.y*height-size/2));
  return {x,y,size};
}
