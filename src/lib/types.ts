export type ItemKind = 'moment' | 'collection';
export type Visibility = 'public' | 'private';
export interface ItemInput {id?:string;kind:ItemKind;title:string;body:string;tags:string[];category:string;url:string;assetId:string|null;visibility:Visibility;}
export interface Item extends ItemInput {id:string;createdAt:string;updatedAt:string;}
export interface Asset {id:string;name:string;mime:string;size:number;category:string;createdAt:string;}
export interface Profile {name:string;bio:string;subtitle:string;avatarId:string|null;accent:string;}
export interface IrisEvent {type:string;data:Record<string,unknown>;}
export const DEFAULT_PROFILE:Profile={name:"Hai's Little World",bio:'收集喜欢的音乐，记录平凡但可爱的日常。',subtitle:'音乐、日常，以及属于我的小小世界。',avatarId:null,accent:'#d27b98'};
