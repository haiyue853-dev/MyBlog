import {MAX_VIDEO_SIZE} from './videos';
import type {Asset,VideoConfig} from './types';

export function uploadVideo(file:File,onProgress:(value:number)=>void):Promise<Asset>{
  if(file.size>MAX_VIDEO_SIZE)return Promise.reject(new Error('每个视频最多 100 MB。'));
  return new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();request.open('POST','/api/files?video=1');request.responseType='json';
    request.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
    request.onerror=()=>reject(new Error('视频上传中断，请再试一次。'));
    request.onload=()=>{if(request.status>=200&&request.status<300&&request.response?.file)resolve(request.response.file);else reject(new Error(request.response?.error||'视频上传失败，请再试一次。'));};
    const form=new FormData();form.set('file',file);form.set('category','视频作品');request.send(form);
  });
}
export function readVideoFile(file:File):Promise<{metadata:Omit<VideoConfig,'assetId'>;poster:File|null}>{
  return new Promise((resolve,reject)=>{
    const video=document.createElement('video');const source=URL.createObjectURL(file);let settled=false;
    function finish(error?:string,result?:{metadata:Omit<VideoConfig,'assetId'>;poster:File|null}){
      if(settled)return;settled=true;clearTimeout(timeout);video.onloadeddata=null;video.onerror=null;video.removeAttribute('src');video.load();URL.revokeObjectURL(source);
      if(error)reject(new Error(error));else resolve(result!);
    }
    const timeout=setTimeout(()=>finish('读取视频超时，请试试导出为 MP4（H.264）后上传。'),20000);
    video.preload='auto';video.muted=true;video.playsInline=true;
    video.onerror=()=>finish('这个视频暂时无法播放，请试试导出为 MP4（H.264）后上传。');
    video.onloadeddata=()=>{
      if(!Number.isFinite(video.duration)||video.duration<=0||!video.videoWidth||!video.videoHeight){finish('没有读到有效的视频时长或画面。');return;}
      const metadata={duration:video.duration,width:video.videoWidth,height:video.videoHeight};
      const canvas=document.createElement('canvas');const scale=Math.min(1,1280/Math.max(metadata.width,metadata.height));canvas.width=Math.max(1,Math.round(metadata.width*scale));canvas.height=Math.max(1,Math.round(metadata.height*scale));
      const context=canvas.getContext('2d');if(!context){finish(undefined,{metadata,poster:null});return;}
      context.drawImage(video,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob=>finish(undefined,{metadata,poster:blob?new File([blob],'视频封面.jpg',{type:'image/jpeg'}):null}),'image/jpeg',.85);
    };
    video.src=source;
  });
}
