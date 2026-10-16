import geography from './travel-geography.json';

export type TravelStatus='visited'|'home'|'wish';
export interface TravelPlace {cityId:string;status:TravelStatus;note:string;date:string;itemId:string|null;}
export const TRAVEL_PROVINCES=geography.provinces;
export const TRAVEL_CITIES=geography.cities;
export const TRAVEL_MAP_SIZE={width:geography.width,height:geography.height};
export const TRAVEL_STATUS={visited:'去过',home:'家乡',wish:'想去'} as const;
export function travelSummary(places:TravelPlace[]){
  const visited=places.filter(place=>place.status!=='wish');
  const litProvinceIds=[...new Set(visited.map(place=>TRAVEL_CITIES.find(city=>city.id===place.cityId)?.provinceId).filter((id):id is string=>!!id))];
  return {visited:visited.length,provinces:litProvinceIds.length,wishes:places.length-visited.length,litProvinceIds};
}
