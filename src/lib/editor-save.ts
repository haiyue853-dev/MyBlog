import {api,ClientError} from './client';
import type {Item,ItemInput} from './types';

export async function saveEditorItem(input:ItemInput,existingId?:string,requestId?:string):Promise<Item>{
  if(!existingId&&requestId){
    try{const previous=await api<{item:Item}>(`items/${requestId}`);if(previous.item.kind!==input.kind)throw new Error('创建请求编号已用于其他记录。');existingId=previous.item.id;}
    catch(error){if(!(error instanceof ClientError&&error.status===404))throw error;}
  }
  const result=await api<{item:Item}>(`items${existingId?'/'+existingId:''}`,{method:existingId?'PUT':'POST',body:JSON.stringify({...input,clientRequestId:!existingId?requestId:undefined})});
  if(!existingId&&requestId&&!sameContent(result.item,input)){
    // A response may have been lost after creation. The idempotent POST returns that old record;
    // apply the content the owner is confirming now before claiming the current edit was saved.
    return (await api<{item:Item}>(`items/${result.item.id}`,{method:'PUT',body:JSON.stringify(input)})).item;
  }
  return result.item;
}
function sameContent(saved:ItemInput,input:ItemInput){
  return (['kind','title','body','category','tags','url','assetId','images','coverCrop','visibility','article','watch','writingType','pinned','status','cardRatio','imageWidth','imageHeight'] as const)
    .every(key=>JSON.stringify(saved[key]??null)===JSON.stringify(input[key]??null));
}
