import type {DailyLike} from './types';

export function applyDailyLike(states:Record<string,DailyLike>,loadedDay:string,responseDay:string,id:string,like:DailyLike):Record<string,DailyLike>{
  return mergeDailyLikes(states,loadedDay,responseDay,{[id]:like});
}

export function mergeDailyLikes(states:Record<string,DailyLike>,loadedDay:string,responseDay:string,incoming:Record<string,DailyLike>):Record<string,DailyLike>{
  if(responseDay<loadedDay)return states;
  const sameDay=responseDay===loadedDay;
  const next=sameDay?{...states}:Object.fromEntries(Object.entries(states).map(([id,like])=>[id,{...like,liked:false}]));
  for(const [id,like] of Object.entries(incoming))next[id]={count:Math.max(next[id]?.count||0,like.count),liked:like.liked||(sameDay&&!!next[id]?.liked)};
  return next;
}
