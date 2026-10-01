import {getStore} from '../store';
import {ApiError,json,readJson,requireOrigin,requireOwner,text,validId} from '../http';

export async function profileApi(request:Request){const store=getStore();if(request.method==='GET')return json({profile:store.getProfile()});requireOwner(request);requireOrigin(request);if(request.method!=='PUT')throw new ApiError(405,'不支持这个操作。');
  const data=await readJson(request);const avatarId=data.avatarId?validId(String(data.avatarId)):null;
  if(avatarId&&!store.getAsset(avatarId)?.mime.startsWith('image/'))throw new ApiError(400,'头像需要是已上传的图片。');
  if(typeof data.accent!=='string'||!/^#[a-f0-9]{6}$/i.test(data.accent))throw new ApiError(400,'请选择正确的主题颜色。');
  const profile={name:text(data.name,'小屋名称',50,true),bio:text(data.bio,'个人介绍',300),subtitle:text(data.subtitle,'首页简介',100),avatarId,accent:data.accent};return json({profile:store.saveProfile(profile)});
}
