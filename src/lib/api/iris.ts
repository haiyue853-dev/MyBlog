import {getRuntimeStore as getStore,runtimeConfig} from '../runtime';
import {ApiError,json,readJson,requireOrigin,requireOwner,validId} from '../http';
import {allowedIrisPath,attachmentDisposition,sourceFileName} from '../iris-stream';

export async function irisApi(request:Request,path:string[]){await requireOwner(request);if(request.method!=='GET')requireOrigin(request);
  let endpoint=path.slice(1);let body:Record<string,unknown>|undefined;
  if(endpoint.join('/')==='import'&&request.method==='POST'){
    const data=await readJson(request);const store=getStore();const asset=(await store.getAsset(validId(String(data.assetId))));if(!asset)throw new ApiError(404,'文件不存在。');
    if(!/\.(pdf|txt|md|docx|xlsx|xls|pptx|csv|html|htm|json)$/i.test(asset.name))throw new ApiError(400,'目前可导入 PDF、文本、Markdown 和 Office 文件。');
    const collectionId=typeof data.collectionId==='string'?data.collectionId:'collection-general';if(!/^[A-Za-z0-9_-]{1,50}$/.test(collectionId))throw new ApiError(400,'请选择一个知识库。');
    body={title:asset.name,original_name:asset.name,content_base64:(await store.readAsset(asset.id)).toString('base64'),collection_id:collectionId};endpoint=['knowledge','upload'];
  }else{
    if(!allowedIrisPath(endpoint))throw new ApiError(404,'没有找到这项内容。');
    const isChat=endpoint.join('/')==='chat/stream';const createSession=endpoint.join('/')==='sessions';
    if(request.method!=='GET'&&!(request.method==='POST'&&(isChat||createSession)))throw new ApiError(405,'不支持这个操作。');
    if(request.method==='POST'){const data=await readJson(request);if(isChat){
      if(typeof data.session_id!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/.test(data.session_id))||typeof data.message!=='string'||!data.message.trim()||data.message.length>10000)throw new ApiError(400,'请输入不超过 10000 字的问题。');
      body={session_id:data.session_id,message:data.message,use_knowledge:data.use_knowledge===true,knowledge_collection_id:typeof data.knowledge_collection_id==='string'?data.knowledge_collection_id:null,toolsets:['safe','knowledge']};
    }else body={name:typeof data.name==='string'?data.name.slice(0,100):'小屋对话'};}
  }
  const config=runtimeConfig();const base=config.irisBaseUrl||'http://127.0.0.1:8000';const target=new URL(`/api/${endpoint.map(encodeURIComponent).join('/')}`,base);
  const search=new URL(request.url).searchParams;for(const name of ['q','query','collection_id','limit']){const value=search.get(name);if(value)target.searchParams.set(name,value);}
  const upstreamHeaders:Record<string,string>={'Content-Type':'application/json'};if(config.irisApiToken)upstreamHeaders.Authorization=`Bearer ${config.irisApiToken}`;
  let response:Response;try{response=await fetch(target,{method:request.method,headers:upstreamHeaders,body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([request.signal,AbortSignal.timeout(endpoint[0]==='health'?5000:180000)]),cache:'no-store',redirect:'error'});}catch{throw new ApiError(503,'暂时连接不上 Iris。资料柜仍可正常使用，请确认 Iris 服务已启动。');}
  if(!response.ok){const raw=await response.text();let message='Iris 暂时没有完成这次操作。';try{const parsed=JSON.parse(raw);message=typeof parsed.detail==='string'?parsed.detail:parsed.detail?.message||parsed.error?.message||message;}catch{}return json({error:message},response.status);}
  const source=endpoint[0]==='knowledge'&&endpoint[2]==='source';
  const headers:Record<string,string>={'Content-Type':source?'application/octet-stream':response.headers.get('content-type')||'application/json','Cache-Control':'no-store','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'};
  if(source)headers['Content-Disposition']=attachmentDisposition(sourceFileName(response.headers.get('content-disposition')));
  return new Response(response.body,{status:response.status,headers});
}
