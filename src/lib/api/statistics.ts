import {ApiError,json,readJson,requireOrigin} from '../http';
import {getRuntimeStore} from '../runtime';
import {loginClient} from '../security';
import {visitorHash,visitorToken} from '../visitor';
import {beijingDay} from './likes';

const PUBLIC_VIEWS=['home','life','collection','about','stats'];
export async function statisticsApi(request:Request){
  const store=getRuntimeStore();const day=beijingDay();
  if(request.method==='GET')return json({stats:await store.getStatistics(day)});
  if(request.method!=='POST')throw new ApiError(405,'不支持这个操作。');
  requireOrigin(request);
  const token=visitorToken(request);if(!token)throw new ApiError(400,'请刷新页面后再试。');
  const data=await readJson(request,1024);
  if(!PUBLIC_VIEWS.includes(String(data.view))||typeof data.eventId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.eventId))throw new ApiError(400,'访问记录格式不正确。');
  if(!await store.takeStatisticsAttempt(loginClient(request)))throw new ApiError(429,'访问得太快了，请稍后再试。');
  const recorded=await store.recordVisit(data.eventId,visitorHash(token),day);
  return json({recorded,stats:await store.getStatistics(day)});
}
