import {AsyncLocalStorage} from 'node:async_hooks';
import type {Store} from './store';

type Methods='listItems'|'getItem'|'saveItem'|'deleteItem'|'getLikes'|'addDailyLike'|'takeLikeAttempt'|'recordVisit'|'getStatistics'|'takeStatisticsAttempt'|'addAsset'|'getAsset'|'listAssets'|'deleteAsset'|'isPublicAsset'|'assetInUse'|'getProfile'|'saveProfile'|'getOwner'|'setOwner'|'updateOwnerPassword'|'createSession'|'hasSession'|'sessionExpires'|'extendSession'|'deleteSession'|'loginBlocked'|'recordLoginFailure'|'clearLoginFailures'|'takeLoginAttempt'|'reserveLoginVerification'|'readAsset'|'writeAsset'|'removeAsset';
export type SiteStore={ [K in Methods]:(...args:Parameters<Store[K]>)=>ReturnType<Store[K]>|Promise<Awaited<ReturnType<Store[K]>>> };
export interface SiteConfig {appUrl?:string;disableWebSetup?:boolean;trustProxy?:boolean;clientIpHeader?:string;irisBaseUrl?:string;irisApiToken?:string;verifyPassword?:(password:string,encoded:string)=>Promise<boolean>;}
const requests=new AsyncLocalStorage<{store:SiteStore;config:SiteConfig}>();
export function withRuntime<T>(store:SiteStore,config:SiteConfig,action:()=>T):T{return requests.run({store,config},action);}
export function getRuntimeStore(){const value=requests.getStore();if(!value)throw new Error('API request storage is not configured');return value.store;}
export function runtimeConfig():SiteConfig{return requests.getStore()?.config??nodeConfig();}
export function nodeConfig():SiteConfig{return {appUrl:process.env.APP_URL,disableWebSetup:process.env.DISABLE_WEB_SETUP==='1',trustProxy:process.env.TRUST_PROXY==='1',irisBaseUrl:process.env.IRIS_BASE_URL,irisApiToken:process.env.IRIS_API_TOKEN};}
