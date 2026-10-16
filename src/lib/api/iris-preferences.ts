import {ApiError,json,readJson} from '../http';
import {getRuntimeStore} from '../runtime';
import {parseWritingPreferences} from '../iris-writing-preferences';

// irisApi checks the owner first; writes also require the same origin.
export async function irisPreferencesApi(request:Request){
 const store=getRuntimeStore();
 if(request.method==='GET')return json({preferences:await store.getIrisWritingPreferences()});
 if(request.method!=='PUT')throw new ApiError(405,'请通过保存按钮更新写作偏好。');
 const data=await readJson(request);let preferences;
 try{preferences=parseWritingPreferences(data);}catch(error){throw new ApiError(400,error instanceof Error?error.message:'写作偏好格式不正确。');}
 return json({preferences:await store.saveIrisWritingPreferences(preferences)});
}
