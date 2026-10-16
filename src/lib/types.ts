export type ItemKind = 'moment' | 'collection' | 'video';
export type PublicationStatus='draft'|'published';
export type WritingType='article'|'review';
export type Visibility = 'public' | 'private';
// 卡片形状。'auto' 是默认值：按上传时量到的原图比例显示，横图就横、竖图就竖。
// 其余三个是手动覆盖，给「想让一组卡整齐一致」的情况用。
export type CardRatio = 'auto' | 'portrait' | 'landscape' | 'square';
export interface ItemImage {assetId:string;width?:number;height?:number;}
export interface VideoConfig {assetId:string;duration?:number;width?:number;height?:number;}
export type WatchType='韩剧'|'电影'|'国产电视剧'|'动漫'|'其他';
export type WatchState='planned'|'watching'|'completed'|'paused'|'dropped';
export interface WatchConfig {type:WatchType;state:WatchState;rating:number|null;episodes:number|null;watched:number;year:string;reviewId:string|null;synopsis?:string;synopsisSource?:string;}
export interface ArticleCoverCrop {x:number;y:number;zoom:number;}
export interface ArticleConfig {summary:string;kicker:string;series:string;spoiler:boolean;coverPosition:'top'|'center'|'bottom';coverCrop?:ArticleCoverCrop;facts:{label:string;value:string}[];quote:string;}
export interface ItemInput {id?:string;kind:ItemKind;title:string;body:string;tags:string[];category:string;url:string;assetId:string|null;images?:ItemImage[];coverCrop?:ArticleCoverCrop;visibility:Visibility;cardRatio?:CardRatio;imageWidth?:number;imageHeight?:number;article?:ArticleConfig|null;video?:VideoConfig|null;watch?:WatchConfig;status?:PublicationStatus;pinned?:boolean;writingType?:WritingType;}
export interface Item extends ItemInput {id:string;createdAt:string;updatedAt:string;}
export interface TrashEntry {item:Item;deletedAt:string;}
export interface DailyLike {count:number;liked:boolean;}
export interface VisitorProfile {name:string;}
export interface CommentInput {itemId:string;visitor:string;name:string;body:string;owner:boolean;}
export interface StoredComment extends CommentInput {id:string;createdAt:string;}
export interface CommentReply {commentId:string;name:string;body:string;createdAt:string;updatedAt:string;}
export interface ArticleComment extends Omit<StoredComment,'visitor'> {canDelete:boolean;reply:CommentReply|null;}
export interface ManagedComment extends Omit<StoredComment,'visitor'> {unread:boolean;reply:CommentReply|null;item:{id:string;title:string;type:WritingType;visibility:Visibility;status:PublicationStatus};}
export interface Asset {id:string;name:string;mime:string;size:number;category:string;createdAt:string;}
export interface AboutInterest {title:string;description:string;}
export interface Profile {name:string;bio:string;subtitle:string;avatarId:string|null;accent:string;aboutName?:string;aboutIntro?:string;aboutInterests?:AboutInterest[];aboutWish?:string;}
export interface SiteStatistics {day:string;sinceDay:string;totalViews:number;totalVisitors:number;todayViews:number;todayVisitors:number;content:{moments:number;collections:number;categories:number;tags:number;likes:number;articles:number;words:number};history:{day:string;views:number;visitors:number}[];}
export interface IrisEvent {type:string;data:Record<string,unknown>;}
// 侧边栏个人卡片下面的「联系方式」图标。做法参考参照站 yaronluo.com：
// 社交入口就一排小圆按钮挂在名字/简介下面，不走大块联系人卡片。
// 注意这里是公开可见的邮箱，改的时候记得它会进公开仓库。
export const SITE_CONTACT={email:'hibozeng@qq.com',qq:'1905499552',qqUrl:'https://qm.qq.com/q/8C8gbecOMo',github:'https://github.com/haiyue853-dev'} as const;
export const DEFAULT_ABOUT_INTERESTS:AboutInterest[]=[
  {title:'游戏 · 快乐时光',description:'永劫无间、CS2。给生活留一点游戏时间。'},
  {title:'音乐 · 循环播放',description:'喜欢 K-pop 音乐，让喜欢的旋律陪着日常。'},
  {title:'追剧 · 故事里的世界',description:'喜欢看韩剧，也喜欢仙侠国漫。慢慢看，慢慢感受故事。'},
  {title:'剪辑 · 留住心动',description:'剪一段 K-pop 短视频，把喜欢的镜头和音乐放在一起。'},
];
export const DEFAULT_PROFILE:Profile={name:"Hai's Little World",bio:'收集喜欢的音乐，记录平凡但可爱的日常。',subtitle:'音乐、日常，以及属于我的小小世界。',avatarId:null,accent:'#d27b98',aboutName:'',aboutIntro:'',aboutInterests:DEFAULT_ABOUT_INTERESTS,aboutWish:'把喜欢的事情，慢慢做成生活的一部分。'};
export const CARD_RATIOS:CardRatio[]=['auto','portrait','landscape','square'];
// 站主密码的下限。放在这里是为了让三处校验共用同一个数字：服务端 `auth/setup`、
// 终端里的 `npm run setup-owner`、以及前端建站表单的本地预校验。
// 前端不能从 security.ts 取值（那边依赖 node:crypto），所以只能放在这个纯模块里。
export const MIN_PASSWORD_LENGTH=10;
// 密码哈希（scrypt）的成本参数，本地与云端浏览器端共用同一个数字，避免两方漂移。
// N=2^15 是 Node 默认（2^14）的 4 倍，抗离线破解明显更强；r/p 沿用安全实践。
// 注意：N=32768、r=8 时 scrypt 约需 ~32MB 内存，服务端必须显式把 maxmem 抬到 64MB，
// 否则 Node 会抛 “Memory limit exceeded”。
export const SCRYPT_N=32768;
export const SCRYPT_R=8;
export const SCRYPT_P=1;
export const SCRYPT_KEYLEN=64;
export const SCRYPT_MAXMEM=64*1024*1024;
// 兼容旧哈希（没有显式成本参数时按 Node 历史默认 2^14 解读）。
export const SCRYPT_LEGACY_N=16384;
// 云端校验「成本档位」时用的常量，浏览器与 worker 必须一致。
export const SCRYPT_COST=SCRYPT_N;
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
