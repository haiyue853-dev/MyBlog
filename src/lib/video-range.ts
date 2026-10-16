export function videoByteRange(header:string|null,size:number):{start:number;end:number}|null|false{
  if(!header)return null;
  const match=header.match(/^bytes=(\d*)-(\d*)$/);if(!match||!size||(!match[1]&&!match[2]))return false;
  if(!match[1]){const length=Number(match[2]);return Number.isSafeInteger(length)&&length>0?{start:Math.max(0,size-length),end:size-1}:false;}
  const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),size-1):size-1;
  return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<size&&end>=start?{start,end}:false;
}
