import {randomUUID} from 'node:crypto';
import {ApiError,json,readJson} from '../http';
import {getRuntimeStore,runtimeConfig} from '../runtime';
import {irisTextDelta,readIrisEvents} from '../iris-stream';
import {irisBlogPrompt,irisMaterialMime,MAX_IRIS_MATERIALS,parseIrisBlogContent} from '../iris-blog';
import type {Asset} from '../types';
import {readRevisionSource,protectRevisionPhotos,restoreRevisionPhotos,irisRevisionPrompt} from '../iris-blog-revision';
import {writingPreferencePrompt} from '../iris-writing-preferences';
import {articleImageOccurrences} from '../article-images';

// Called only after irisApi has checked the owner session and request origin.
export async function prepareIrisBlog(request:Request){
  if(request.method!=='POST')throw new ApiError(405,'请通过整理按钮生成预览。');
  const data=await readJson(request);
  if(!['article','moment'].includes(String(data.type))||typeof data.message!=='string'||!data.message.trim()||data.message.length>10000)throw new ApiError(400,'请选择文章或日常，并输入不超过 10000 字的整理要求。');
  if(!Array.isArray(data.assetIds)||data.assetIds.length>MAX_IRIS_MATERIALS||data.assetIds.some((id:unknown)=>typeof id!=='string'||!(/^[a-f0-9-]{36}$/.test(id)))||new Set(data.assetIds).size!==data.assetIds.length)throw new ApiError(400,'请选择最多 10 份不重复的素材。');
  const fromChat=data.sourceReply!==undefined;
  let sourceDraft:ReturnType<typeof readRevisionSource>|null=null;
  let protectedPhotos:ReturnType<typeof protectRevisionPhotos>|null=null;
  try{if(data.sourceDraft!==undefined){sourceDraft=readRevisionSource(data.sourceDraft);protectedPhotos=protectRevisionPhotos(sourceDraft);}}
  catch(error){throw new ApiError(400,error instanceof Error?error.message:'当前稿件格式不正确。');}
  if(sourceDraft&&(fromChat||data.assetIds.length||sourceDraft.type!==data.type))throw new ApiError(400,'改稿只使用当前预览，不同时选择聊天回答或其他素材。');
  if(fromChat&&(typeof data.sourceReply!=='string'||!data.sourceReply.trim()||data.sourceReply.length>50000||data.assetIds.length))throw new ApiError(400,'请选择一条不超过 50000 字的完整聊天回答，聊天整理不同时添加素材。');
  const store=getRuntimeStore();const materials:Asset[]=[];
  for(const id of data.assetIds){const asset=await store.getAsset(id);if(!asset)throw new ApiError(404,'素材文件不存在，请重新选择。');if(!irisMaterialMime(asset))throw new ApiError(400,'素材支持 PNG、JPG、WebP、PDF、TXT、Markdown、Word 和 Excel。');materials.push(asset);}
  const images=materials.filter(asset=>asset.mime.startsWith('image/')).map(asset=>({assetId:asset.id}));
  let inlinePhotos:ReturnType<typeof protectRevisionPhotos>|null=null;
  if(!sourceDraft&&!fromChat&&articleImageOccurrences(data.message,images).length){
    try{
      inlinePhotos=protectRevisionPhotos({type:data.type as 'article'|'moment',title:'',body:data.message,category:'',tags:[],summary:'',images:images.map(image=>image.assetId)});
      if(inlinePhotos.photos.length!==articleImageOccurrences(data.message,images).length)throw new Error('请只插入已选择的素材图片。');
    }catch(error){throw new ApiError(400,error instanceof Error?error.message:'配图位置不正确。');}
  }
  const preferences=await store.getIrisWritingPreferences();
  const stylePrompt=writingPreferencePrompt(preferences[data.type as 'article'|'moment']);
  const config=runtimeConfig();const base=config.irisBaseUrl||'http://127.0.0.1:8000';
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(180000)]);
  async function upstream(path:string,body:Record<string,unknown>|FormData){
    const headers:Record<string,string>={};if(config.irisApiToken)headers.Authorization=`Bearer ${config.irisApiToken}`;
    const multipart=body instanceof FormData;if(!multipart)headers['Content-Type']='application/json';
    let response:Response;
    try{response=await fetch(new URL(`/api/${path}`,base),{method:'POST',headers,body:multipart?body:JSON.stringify(body),signal,cache:'no-store',redirect:'error'});}
    catch{throw new ApiError(signal.aborted?408:503,signal.aborted?'整理已停止或超时，素材仍保留，可以重试。':'暂时连接不上 Iris，请确认服务已启动。');}
    if(!response.ok){await response.body?.cancel();throw new ApiError(response.status===404?503:response.status>=500?503:502,response.status===404?'当前 Iris 服务没有开放所需接口，请检查已运行的版本。':'Iris 暂时无法处理这份素材或完成整理，请重试。');}
    return response;
  }
  const session=await (await upstream('sessions',{name:`博客${data.type==='article'?'文章':'日常'} · ${data.message.slice(0,24)}`})).json();
  if(typeof session.id!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/.test(session.id)))throw new ApiError(502,'Iris 未返回有效的写作会话。');
  const attachmentIds:string[]=[];
  for(const asset of materials){
    const form=new FormData();form.append('file',new File([await store.readAsset(asset.id)],asset.name,{type:irisMaterialMime(asset)!}));
    const uploaded=await (await upstream(`sessions/${encodeURIComponent(session.id)}/attachments`,form)).json();
    const attachment=uploaded.attachment;
    if(typeof attachment?.id!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/.test(attachment.id)))throw new ApiError(502,'Iris 未接收到素材，请重试。');
    if(attachment.extraction_status==='failed'&&!asset.mime.startsWith('image/'))throw new ApiError(502,`Iris 无法读取「${asset.name}」，请改用文字或可读取的文档。`);
    attachmentIds.push(attachment.id);
  }
  const prompt=sourceDraft&&protectedPhotos?irisRevisionPrompt(data.message,sourceDraft,protectedPhotos):irisBlogPrompt(inlinePhotos?.body??data.message,data.type as 'article'|'moment',images.length,fromChat?data.sourceReply as string:undefined)+(inlinePhotos?'\n正文中的 {IRIS_IMAGE_数字} 是用户插入的配图位置。必须每个原样保留一次、顺序不变，保留与前后段落的对应关系；不要集中挪到文末。不要生成其他图片标记。':'');
  const stream=await upstream('chat/stream',{session_id:session.id,message:stylePrompt+'\n\n'+prompt,attachment_ids:attachmentIds,use_knowledge:false,toolsets:fromChat||sourceDraft?[]:['safe']});
  if(!stream.body)throw new ApiError(502,'Iris 没有返回整理内容。');
  let output='';let completed=false;
  try{
    for await(const event of readIrisEvents(stream.body)){
      // Iris can narrate before reading an attachment. Only the final model turn is the draft.
      if(event.type==='tool_started')output='';
      if(event.type==='text_delta')output+=irisTextDelta(event);
      if(event.type==='message_completed'){completed=true;if(!output){const message=event.data.message as {content?:string}|undefined;output=String(event.data.content??message?.content??'');}}
      if(event.type==='error'||event.type==='tool_approval_requested')throw new Error('Iris 尚未完成整理');
      if(output.length>65000)throw new Error('整理内容过长');
    }
    if(!completed)throw new Error('整理未完成');
    const content=parseIrisBlogContent(output,data.type as 'article'|'moment',inlinePhotos?[]:images);
    if(inlinePhotos){content.body=restoreRevisionPhotos(content.body,inlinePhotos);content.images=images;content.assetId=images[0]?.assetId||null;}
    if(sourceDraft&&protectedPhotos)return json({revision:{title:content.title,body:restoreRevisionPhotos(content.body,protectedPhotos),category:content.category,tags:content.tags,summary:content.article?.summary||''}});
    const now=new Date().toISOString();
    return json({candidate:{...content,id:randomUUID(),createdAt:now,updatedAt:now}});
  }catch(error){
    throw new ApiError(signal.aborted?408:502,signal.aborted?'整理已停止或超时，素材仍保留，可以重试。':`Iris 的整理结果还不能生成预览，请重试或补充要求。${error instanceof Error?' '+error.message:''}`);
  }
}
