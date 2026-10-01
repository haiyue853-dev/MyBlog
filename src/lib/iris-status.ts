export const IRIS_STAGE_LABELS:Record<string,string>={queued:'排队等待索引',parsing:'正在解析文件内容',chunking:'正在生成父子切片',graph:'正在提取知识图谱',embedding:'正在生成向量索引',completed:'索引已完成',failed:'索引失败'};

export interface IrisProgressItem {stage:string;message:string;}

export function irisStageLabel(stage:string){return IRIS_STAGE_LABELS[stage]||'正在建立索引';}

export function irisStageSettled(stage:string){return stage==='completed'||stage==='failed';}

export function irisDocumentStage(status?:string|null){return !status?'queued':status==='ready'?'completed':status;}

export function irisProgress(payload:unknown,documentId:string):IrisProgressItem|null{
  const items=(payload as {items?:unknown} | null | undefined)?.items;
  if(!Array.isArray(items))return null;
  const item=items.find(entry=>!!entry&&typeof entry==='object'&&(entry as {document_id?:unknown}).document_id===documentId) as {stage?:unknown;message?:unknown} | undefined;
  if(!item||typeof item.stage!=='string')return null;
  return {stage:item.stage,message:typeof item.message==='string'?item.message:''};
}
