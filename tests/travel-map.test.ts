import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Store} from '../src/lib/store';
import {withRuntime} from '../src/lib/runtime';
import {handleErrors,newToken} from '../src/lib/http';
import {HouseTools} from '../src/components/house-tools';
import {Space} from '../src/components/space';
import {DEFAULT_PROFILE} from '../src/lib/types';
import {readSpaceRoute} from '../src/lib/space-route';
import {travelApi} from '../src/lib/api/travel';
import {travelSummary,TRAVEL_CITIES,TRAVEL_PROVINCES} from '../src/lib/travel';
import {createBackup,backupArchivePath} from '../src/lib/backups';

function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'world-travel-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);
  const record=store.saveItem({kind:'moment',title:'福州旅行',body:'福州',visibility:'public',tags:['福州'],category:'旅游',assetId:null,url:''});
  async function call(method='GET',places?:unknown,owner=true,origin='http://localhost:3000'){
    const request=new Request('http://localhost:3000/api/travel',{method,headers:{host:'localhost:3000',origin,cookie:owner?`world-session=${token}`:''},body:places===undefined?undefined:JSON.stringify({places})});
    return withRuntime(store,{},()=>handleErrors(()=>travelApi(request)));
  }
  return {store,directory,record,call,close(){store.close();rmSync(directory,{recursive:true,force:true});}};
}
test('retired travel maps keep their code and data without a live navigation entry',()=>{
  assert.equal(readSpaceRoute(new URL('http://localhost:3000/?view=travel'))?.view,'home');
  assert.doesNotMatch(renderToStaticMarkup(createElement(HouseTools,{view:'travel',owner:false,onNavigate:()=>{}})),/旅行足迹/);
  const html=renderToStaticMarkup(createElement(Space,{initialItems:[],initialProfile:DEFAULT_PROFILE,initialOwner:false,configured:true,initialView:'travel'}));
  assert.doesNotMatch(html,/aria-label="旅行足迹"/);
});
test('travel geography covers provinces and distinguishes the two cities named Fuzhou',()=>{
  assert.equal(TRAVEL_PROVINCES.length,34);
  for(const province of TRAVEL_PROVINCES){assert.ok(province.path.length>20);assert.ok(province.bounds.width>0&&province.bounds.height>0);}
  assert.equal(TRAVEL_CITIES.find(city=>city.id==='350100')?.name,'福州市');
  assert.equal(TRAVEL_CITIES.find(city=>city.id==='361000')?.name,'抚州市');
  for(const city of TRAVEL_CITIES){assert.ok(TRAVEL_PROVINCES.some(province=>province.id===city.provinceId));assert.ok(city.path.length>20&&city.bounds.width>0&&city.bounds.height>0);assert.ok(Number.isFinite(city.x)&&Number.isFinite(city.y));assert.ok(city.x>=0&&city.x<=960&&city.y>=0&&city.y<=630);}
  const sansha=TRAVEL_CITIES.find(city=>city.id==='460300')!;assert.ok(sansha.x>=830&&sansha.x<=934&&sansha.y>=437&&sansha.y<=606);
});
test('travel totals light only visited and hometown provinces, keeping wishes separate',()=>{
  const summary=travelSummary([{cityId:'350100',status:'visited',note:'',date:'',itemId:null},{cityId:'350200',status:'home',note:'',date:'',itemId:null},{cityId:'110000',status:'wish',note:'',date:'',itemId:null}]);
  assert.equal(summary.visited,2);assert.equal(summary.provinces,1);assert.equal(summary.wishes,1);
  assert.deepEqual(summary.litProvinceIds,['350000']);
});
test('travel editing requires owner and matching origin, while visitors can view footprints',async()=>{
  const f=fixture();try{
    assert.deepEqual(await (await f.call('GET',undefined,false)).json(),{places:[]});
    const places=[{cityId:'350100',status:'visited',note:' 一阵海风 ',date:'2026-04-04',itemId:f.record.id}];
    assert.equal((await f.call('PUT',places,false)).status,401);assert.equal((await f.call('PUT',places,true,'https://evil.test')).status,403);
    assert.equal((await f.call('PUT',places)).status,200);
    assert.equal((await (await f.call('GET',undefined,false)).json()).places[0].note,'一阵海风');
    assert.equal((await f.call('POST',places)).status,405);
  }finally{f.close();}
});
test('travel validates dates, cities, duplicates, status and record links without changing saved data',async()=>{
  const f=fixture();try{
    const place={cityId:'350100',status:'visited',note:'福州',date:'2026-04-04',itemId:f.record.id};
    await f.call('PUT',[place]);
    for(const places of [[{...place,cityId:'000000'}],[place,place],[{...place,status:'other'}],[{...place,date:'2026-02-30'}],[{...place,note:'x'.repeat(301)}],[{...place,itemId:newToken()}]])assert.equal((await f.call('PUT',places)).status,400);
    const collection=f.store.saveItem({...f.record,id:undefined,kind:'collection',title:'小卡'});
    assert.equal((await f.call('PUT',[{...place,itemId:collection.id}])).status,400);
    assert.deepEqual(f.store.getTravelPlaces(),[place]);
  }finally{f.close();}
});
test('a private, draft or trashed linked record is never disclosed to visitors',async()=>{
  const f=fixture();try{
    await f.call('PUT',[{cityId:'350100',status:'visited',note:'',date:'',itemId:f.record.id}]);
    for(const input of [{...f.record,visibility:'private' as const},{...f.record,status:'draft' as const}]){
      f.store.saveItem(input);assert.equal((await (await f.call('GET',undefined,false)).json()).places[0].itemId,null);
      assert.equal((await (await f.call()).json()).places[0].itemId,f.record.id);
    }
    f.store.trashItem(f.record.id);assert.equal((await (await f.call()).json()).places[0].itemId,null);
  }finally{f.close();}
});
test('travel footprints persist after restart and are included in a restorable backup',async()=>{
  const f=fixture();try{
    const places=[{cityId:'350100',status:'home' as const,note:'归来的地方',date:'2026-04-04',itemId:f.record.id}];
    f.store.saveTravelPlaces(places);const reopened=new Store(f.directory);assert.deepEqual(reopened.getTravelPlaces(),places);reopened.close();
    const saved=await createBackup(f.store);const destination=join(f.directory,'restored');mkdirSync(destination);execFileSync('tar',['-xzf',backupArchivePath(f.store,saved.id),'-C',destination]);
    const restored=new Store(destination);try{assert.deepEqual(restored.getTravelPlaces(),places);}finally{restored.close();}
  }finally{f.close();}
});
