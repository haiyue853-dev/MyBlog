import {irisTextDelta,readIrisEvents} from './iris-stream';

export async function readIrisReply(stream:ReadableStream<Uint8Array>,onText?:(text:string)=>void,onTool?:(status:string)=>void):Promise<string>{
  let answer='';let completed=false;
  for await(const event of readIrisEvents(stream)){
    if(event.type==='text_delta'){
      const delta=irisTextDelta(event);if(delta){answer+=delta;onText?.(answer);}
    }
    if(event.type==='tool_started')onTool?.(`正在使用 ${String(event.data.name||'工具')}…`);
    if(event.type==='tool_finished')onTool?.('');
    if(event.type==='error')throw new Error(String(event.data.message||'Iris 回答时遇到了问题。'));
    if(event.type==='tool_approval_requested')throw new Error('这次请求需要在 Iris 原界面确认工具权限。');
    if(event.type==='message_completed'){
      completed=true;
      const message=event.data.message as {content?:string}|undefined;
      const full=String(event.data.content??message?.content??'');
      if(!answer.trim()&&full){answer=full;onText?.(answer);}
    }
  }
  if(!completed)throw new Error('Iris 回答未完成，请重试。');
  if(!answer.trim())throw new Error('Iris 没有返回文字，请稍后再试。');
  return answer;
}
