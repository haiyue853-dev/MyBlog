import {ApiError,json,readBody} from '../http';
import {runtimeConfig} from '../runtime';
import {validateChatFile,MAX_CHAT_FILE_SIZE} from '../iris-chat-files';
import {imageMime} from '../security';

export async function readIrisChatImage(request:Request,sessionId:string,id:string){
  if(![sessionId,id].every(value=>/^[A-Za-z0-9_-]{1,100}$/.test(value)))throw new ApiError(400,'图片所属对话或编号不正确。');
  if(request.method!=='GET')throw new ApiError(405,'请通过图片预览查看附件。');
  const config=runtimeConfig();const headers:Record<string,string>={};if(config.irisApiToken)headers.Authorization=`Bearer ${config.irisApiToken}`;
  let response:Response;try{response=await fetch(new URL(`/api/sessions/${encodeURIComponent(sessionId)}/attachments/${encodeURIComponent(id)}/download`,config.irisBaseUrl||'http://127.0.0.1:8000'),{headers,signal:AbortSignal.any([request.signal,AbortSignal.timeout(60000)]),redirect:'error',cache:'no-store'});}catch{throw new ApiError(503,'暂时无法读取聊天图片，请重试。');}
  if(!response.ok){await response.body?.cancel();throw new ApiError(response.status===404?404:502,response.status===404?'聊天图片不存在。':'暂时无法读取聊天图片，请重试。');}
  const bytes=await readBody({headers:response.headers,body:response.body} as Request,MAX_CHAT_FILE_SIZE);
  const mime=imageMime(Buffer.from(bytes));if(!mime||!['image/png','image/jpeg','image/webp'].includes(mime))throw new ApiError(400,'这份附件不是支持预览的图片。');
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}

// irisApi has already checked the owner and origin before calling this upload.
export async function uploadIrisChatFile(request:Request,sessionId:string){
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(sessionId))throw new ApiError(400,'请选择有效的 Iris 对话。');
  if(request.method!=='POST')throw new ApiError(405,'请通过附件按钮上传文件。');
  const bytes=await readBody(request,MAX_CHAT_FILE_SIZE+64*1024);
  let form:FormData;try{form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')||''},body:bytes}).formData();}catch{throw new ApiError(400,'附件上传格式不正确。');}
  const file=form.get('file');if(!(file instanceof File)||form.getAll('file').length!==1)throw new ApiError(400,'请每次上传一个附件。');
  if(file.size>MAX_CHAT_FILE_SIZE)throw new ApiError(413,'附件超过 20 MB，请缩小后再上传。');
  try{validateChatFile(file);}catch(error){throw new ApiError(400,error instanceof Error?error.message:'附件格式不正确。');}
  const outbound=new FormData();outbound.append('file',file);
  const config=runtimeConfig();const headers:Record<string,string>={};if(config.irisApiToken)headers.Authorization=`Bearer ${config.irisApiToken}`;
  let response:Response;
  try{response=await fetch(new URL(`/api/sessions/${encodeURIComponent(sessionId)}/attachments`,config.irisBaseUrl||'http://127.0.0.1:8000'),{method:'POST',headers,body:outbound,signal:AbortSignal.any([request.signal,AbortSignal.timeout(180000)]),redirect:'error',cache:'no-store'});}
  catch{throw new ApiError(503,'附件上传未完成，文件仍保留，可以重试。');}
  if(!response.ok){await response.body?.cancel();throw new ApiError(response.status===404?404:response.status===413?413:502,response.status===404?'Iris 对话不存在，请重新选择。':response.status===413?'Iris 的附件大小限制更小，请缩小文件后重试。':'Iris 暂时无法接收附件，请重试。');}
  let result:Record<string,unknown>;try{result=await response.json();}catch{throw new ApiError(502,'Iris 未返回有效的附件，请重试。');}
  const attachment=result.attachment as import('../iris-chat-files').IrisChatAttachment;
  if(!attachment||typeof attachment.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(attachment.id)||typeof attachment.original_name!=='string')throw new ApiError(502,'Iris 未返回有效的附件，请重试。');
  return json({attachment},201);
}
