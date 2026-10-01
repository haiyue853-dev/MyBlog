export type ItemKind = 'moment' | 'collection';
export type Visibility = 'public' | 'private';
// 卡片形状。'auto' 是默认值：按上传时量到的原图比例显示，横图就横、竖图就竖。
// 其余三个是手动覆盖，给「想让一组卡整齐一致」的情况用。
export type CardRatio = 'auto' | 'portrait' | 'landscape' | 'square';
export interface ItemInput {id?:string;kind:ItemKind;title:string;body:string;tags:string[];category:string;url:string;assetId:string|null;visibility:Visibility;cardRatio?:CardRatio;imageWidth?:number;imageHeight?:number;}
export interface Item extends ItemInput {id:string;createdAt:string;updatedAt:string;}
export interface Asset {id:string;name:string;mime:string;size:number;category:string;createdAt:string;}
export interface Profile {name:string;bio:string;subtitle:string;avatarId:string|null;accent:string;}
export interface IrisEvent {type:string;data:Record<string,unknown>;}
export const DEFAULT_PROFILE:Profile={name:"Hai's Little World",bio:'收集喜欢的音乐，记录平凡但可爱的日常。',subtitle:'音乐、日常，以及属于我的小小世界。',avatarId:null,accent:'#d27b98'};
export const CARD_RATIOS:CardRatio[]=['auto','portrait','landscape','square'];
// 站主密码的下限。放在这里是为了让三处校验共用同一个数字：服务端 `auth/setup`、
// 终端里的 `npm run setup-owner`、以及前端建站表单的本地预校验。
// 前端不能从 security.ts 取值（那边依赖 node:crypto），所以只能放在这个纯模块里。
export const MIN_PASSWORD_LENGTH=8;
// 三个手动档位的宽高比；'auto' 走原图，不在这里。
const FIXED_RATIOS:Record<'portrait'|'landscape'|'square',number>={portrait:2/3,landscape:3/2,square:1};
// 自动档的上下限：极端长图（全景、手机长截图）会把瀑布流里那一列拉成一根面条，
// 所以夹到 1:2 ~ 2:1。常见的 2:3、3:2、4:5、1:1 都落在这个区间里，不会被夹到。
const AUTO_MIN=0.5;const AUTO_MAX=2;
// 卡片宽高比。优先手动覆盖；'auto' 用上传时量到的原图尺寸；两者都没有就退回 2:3。
// 之所以把尺寸存在条目上而不是图片上，是为了让瀑布流**不依赖图片加载完成**就能算对高度 ——
// 否则图片每加载一张，下面所有卡片都会跟着跳一次。
export function cardAspect(item:{cardRatio?:CardRatio;imageWidth?:number;imageHeight?:number}):string{
  if(item.cardRatio&&item.cardRatio!=='auto')return String(Number(FIXED_RATIOS[item.cardRatio].toFixed(4)));
  const width=Number(item.imageWidth);const height=Number(item.imageHeight);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return String(Number((2/3).toFixed(4)));
  return String(Number(Math.min(AUTO_MAX,Math.max(AUTO_MIN,width/height)).toFixed(4)));
}
