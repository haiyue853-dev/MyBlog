import {getRuntimeStore} from '../runtime';
import {ApiError,isOwner,json,readJson,requireOrigin,requireOwner,text} from '../http';
import {TRAVEL_CITIES,type TravelPlace} from '../travel';

export async function travelApi(request:Request){
  const store=getRuntimeStore();
  if(request.method==='GET'){
    const owner=await isOwner(request);const visible=new Set((await store.listItems(owner)).filter(item=>item.kind==='moment').map(item=>item.id));
    return json({places:(await store.getTravelPlaces()).map(place=>({...place,itemId:place.itemId&&visible.has(place.itemId)?place.itemId:null}))});
  }
  await requireOwner(request);requireOrigin(request);
  if(request.method!=='PUT')throw new ApiError(405,'不支持这个操作。');
  const data=await readJson(request);
  if(!Array.isArray(data.places)||data.places.length>400)throw new ApiError(400,'地点格式不正确，最多记录 400 个地点。');
  const cities=new Set(TRAVEL_CITIES.map(city=>city.id));const used=new Set<string>();
  const places:TravelPlace[]=[];
  for(const value of data.places){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(400,'地点格式不正确。');
    const cityId=value.cityId;
    if(typeof cityId!=='string'||!cities.has(cityId)||used.has(cityId))throw new ApiError(400,'请选择有效且不重复的城市。');
    used.add(cityId);
    if(!['visited','home','wish'].includes(value.status))throw new ApiError(400,'请选择地点状态。');
    const note=text(value.note,'地点手记',300);const date=value.date;
    if(typeof date!=='string'||date!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date))throw new ApiError(400,'请选择正确的日期。');
    const itemId=value.itemId===null||value.itemId===''?null:value.itemId;
    if(itemId!==null){
      if(typeof itemId!=='string'||!/^[a-f0-9-]{36}$/.test(itemId)||(await store.getItem(itemId,true))?.kind!=='moment')throw new ApiError(400,'请关联一条有效的旅行记录。');
    }
    places.push({cityId,status:value.status,note,date,itemId});
  }
  return json({places:await store.saveTravelPlaces(places)});
}
