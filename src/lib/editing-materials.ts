export interface MaterialImage {src:string;label:string;}
export interface MaterialGallery {id:string;title:string;eyebrow:string;description:string;features:string[];prices:{label:string;amount:number}[];images:MaterialImage[];}
const image=(name:string,label:string):MaterialImage=>({src:`/editing-materials/${name}`,label});
export const MATERIAL_CONTACT={name:'月海',brand:'YOcean',wechat:'yuehai2',email:'2138286174@qq.com',douyin:'https://v.douyin.com/ob8e05R6PoQ/',github:'https://github.com/haiyue853-dev',avatar:'/editing-materials/user-avatar.jpg',qr:image('wechat-qr.jpg','微信二维码'),douyinImage:image('douyin-profile.jpg','抖音主页截图')};
export const MATERIAL_GALLERIES:MaterialGallery[]=[
  {id:'group-one',title:'素材群①',eyebrow:'K-POP · 4K MOMENTS',description:'收录 K-pop 各团的 4K 修复高清素材，给喜欢的镜头多留一点细节。',features:['随机男团、女团素材','高清 4K 修复','慢放与补帧'],prices:[{label:'素材群①',amount:40}],images:Array.from({length:4},(_,i)=>image(`group1-img${i+1}.png`,`素材群① · 展示图 ${i+1}`))},
  {id:'group-two',title:'素材群②',eyebrow:'BLACKPINK · MORE TO KEEP',description:'包含素材群①，另有 BLACKPINK（ROSÉ、Jennie、Jisoo）300 GB＋原视频素材，以及少量其他团的素材。',features:['团综与演唱会','MV 原视频素材','更多人物与舞台片段'],prices:[{label:'素材群②',amount:70}],images:Array.from({length:6},(_,i)=>image(`group2-img${i+1}.png`,`素材群② · 展示图 ${i+1}`))},
  {id:'single-materials',title:'单卖素材',eyebrow:'A LITTLE EXTRA',description:'也可以选一份想要的素材，慢慢剪成自己的作品。',features:['鞠婧祎素材','张元英素材'],prices:[{label:'鞠婧祎',amount:45},{label:'张元英',amount:20}],images:Array.from({length:5},(_,i)=>image(`singles-img${i+1}.png`,`单卖素材 · 展示图 ${i+1}`))},
];
