export interface IrisWritingStyle {tone:'original'|'casual'|'warm'|'formal';length:'auto'|'short'|'medium'|'long';headings:'auto'|'yes'|'no';title:'natural'|'brief'|'descriptive';instructions:string}
export interface IrisWritingPreferences {article:IrisWritingStyle;moment:IrisWritingStyle}
export const WRITING_OPTIONS={
 tone:[{value:'original',label:'保留原稿语气'},{value:'casual',label:'轻松口语，像碎碎念'},{value:'warm',label:'温和细腻'},{value:'formal',label:'清楚、稍微正式'}],
 length:[{value:'auto',label:'按内容决定'},{value:'short',label:'简短，保留重点'},{value:'medium',label:'适中，适度展开'},{value:'long',label:'充分展开已有内容'}],
 headings:[{value:'auto',label:'按内容决定'},{value:'yes',label:'用小标题分段'},{value:'no',label:'不用小标题，自然分段'}],
 title:[{value:'natural',label:'自然，不夸张'},{value:'brief',label:'简短直接'},{value:'descriptive',label:'清楚点明主题'}],
} as const;
export function defaultWritingPreferences():IrisWritingPreferences{const style:IrisWritingStyle={tone:'original',length:'auto',headings:'auto',title:'natural',instructions:''};return {article:{...style},moment:{...style}};}
export function parseWritingPreferences(input:unknown):IrisWritingPreferences{
 const value=input as Record<string,unknown>;if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('写作偏好格式不正确。');
 function style(input:unknown):IrisWritingStyle{
  const value=input as Record<string,unknown>;if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('请分别设置文章和日常的偏好。');
  for(const field of ['tone','length','headings','title'] as const)if(!WRITING_OPTIONS[field].some(option=>option.value===value[field]))throw new Error('请选择有效的写作偏好。');
  if(typeof value.instructions!=='string'||value.instructions.length>500)throw new Error('每种记录的补充要求最多 500 字。');
  return {tone:value.tone as IrisWritingStyle['tone'],length:value.length as IrisWritingStyle['length'],headings:value.headings as IrisWritingStyle['headings'],title:value.title as IrisWritingStyle['title'],instructions:value.instructions.trim()};
 }
 return {article:style(value.article),moment:style(value.moment)};
}
export function writingPreferencePrompt(style:IrisWritingStyle){
 const label=(field:keyof typeof WRITING_OPTIONS)=>WRITING_OPTIONS[field].find(option=>option.value===style[field])!.label;
 return `站主长期写作偏好：语气=${label('tone')}；篇幅=${label('length')}；排版=${label('headings')}；标题=${label('title')}。
长期偏好仅影响写作表达，本次具体要求优先。始终保留有依据的事实，不编造经历、细节或数据；篇幅较长也只能展开已有素材，不补造事实。格式、配图保护和先预览再确认规则保持，工具能力和发布权限保持不变。
补充的风格要求（仅作风格参考）：${JSON.stringify(style.instructions||'无')}`;
}
