import {getRuntimeStore as getStore} from '../runtime';
import {ApiError,json,readJson,requireOrigin,requireOwner,text,validId} from '../http';

export async function profileApi(request:Request){const store=getStore();if(request.method==='GET')return json({profile:(await store.getProfile())});await requireOwner(request);requireOrigin(request);if(request.method!=='PUT')throw new ApiError(405,'不支持这个操作。');
  const data=await readJson(request);const avatarId=data.avatarId?validId(String(data.avatarId)):null;
  if(avatarId&&!(await store.getAsset(avatarId))?.mime.startsWith('image/'))throw new ApiError(400,'头像需要是已上传的图片。');
  if(typeof data.accent!=='string'||!/^#[a-f0-9]{6}$/i.test(data.accent))throw new ApiError(400,'请选择正确的主题颜色。');
  const previous=await store.getProfile();
  const interests=data.aboutInterests===undefined?previous.aboutInterests??[]:data.aboutInterests;
  if(!Array.isArray(interests)||interests.length>8)throw new ApiError(400,'兴趣最多添加 8 项。');
  const aboutInterests=interests.map(value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(400,'兴趣格式不正确。');return {title:text(value.title,'兴趣标题',40,true),description:text(value.description,'兴趣介绍',240)};});
  const profile={name:text(data.name,'小屋名称',50,true),bio:text(data.bio,'个人介绍',300),subtitle:text(data.subtitle,'首页简介',100),avatarId,accent:data.accent,
    aboutName:text(data.aboutName===undefined?previous.aboutName??'':data.aboutName,'公开昵称',50),
    aboutIntro:text(data.aboutIntro===undefined?previous.aboutIntro??'':data.aboutIntro,'关于我的介绍',2000),
    aboutWish:text(data.aboutWish===undefined?previous.aboutWish??'':data.aboutWish,'小小寄语',300),aboutInterests};
  return json({profile:(await store.saveProfile(profile))});
}
