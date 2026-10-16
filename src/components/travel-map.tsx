'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {MapPinned,Plus,Pencil,Trash2,ArrowRight,Heart,Plane,CalendarDays,BookOpen,LoaderCircle} from 'lucide-react';
import {TRAVEL_CITIES,TRAVEL_PROVINCES,TRAVEL_STATUS,travelSummary,type TravelPlace,type TravelStatus} from '@/lib/travel';
import {api,errorMessage,fileUrl} from '@/lib/client';
import {itemImages} from '@/lib/item-images';
import type {Item} from '@/lib/types';
import {ThemeSelect} from './theme-select';
import {Modal} from './modal';
import {TravelMapCanvas} from './travel-map-canvas';

const cityById=new Map(TRAVEL_CITIES.map(city=>[city.id,city]));
const provinceById=new Map(TRAVEL_PROVINCES.map(province=>[province.id,province]));
const emptyPlace=(cityId:string):TravelPlace=>({cityId,status:'visited',note:'',date:'',itemId:null});

export function TravelMap({owner,items,onOpen,articlePages=true}:{owner:boolean;items:Item[];articlePages?:boolean;onOpen:(item:Item)=>void}){
  const [places,setPlaces]=useState<TravelPlace[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [selected,setSelected]=useState('');const [province,setProvince]=useState('');const [hover,setHover]=useState('');
  const [editing,setEditing]=useState<{place:TravelPlace;original:string|null}|null>(null);const [removing,setRemoving]=useState<TravelPlace|null>(null);const [busy,setBusy]=useState(false);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');api<{places:TravelPlace[]}>('travel',{signal:controller.signal}).then(data=>{setPlaces(data.places);setSelected(data.places[0]?.cityId||'');}).catch(error=>{if(!controller.signal.aborted)setError(errorMessage(error));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[owner]);
  const summary=travelSummary(places);const active=places.find(place=>place.cityId===selected);const activeCity=cityById.get(selected);
  const linked=active?.itemId?items.find(item=>item.id===active.itemId):undefined;const photo=linked?itemImages(linked)[0]?.assetId:undefined;
  const filtered=province?places.filter(place=>cityById.get(place.cityId)?.provinceId===province):places;
  function choose(cityId:string){setHover('');setSelected(cityId);setProvince(cityById.get(cityId)?.provinceId||'');}
  function selectProvince(id:string){setHover('');setProvince(id);if(id&&cityById.get(selected)?.provinceId!==id){const first=places.find(place=>cityById.get(place.cityId)?.provinceId===id);setSelected(first?.cityId||'');}}
  function add(cityId?:string){const available=(cityId?cityById.get(cityId):undefined)||TRAVEL_CITIES.find(city=>city.provinceId===(province||'350000')&&!places.some(place=>place.cityId===city.id))||TRAVEL_CITIES.find(city=>!places.some(place=>place.cityId===city.id));if(available)setEditing({place:emptyPlace(available.id),original:null});}
  async function save(next:TravelPlace[]){setBusy(true);setError('');try{const data=await api<{places:TravelPlace[]}>('travel',{method:'PUT',body:JSON.stringify({places:next})});setPlaces(data.places);return true;}catch(error){setError(errorMessage(error));return false;}finally{setBusy(false);}}
  return <section className="travel-page">
    <div className="travel-intro"><div><p className="travel-eyebrow">PLACES I KEEP</p><h1><MapPinned size={29}/>旅行足迹<span className="heading-dot">.</span></h1><p>把去过的地方点亮，把路上的小事留下。</p></div>{owner&&<button className="button primary" disabled={loading||busy||places.length>=TRAVEL_CITIES.length} onClick={()=>add()}><Plus size={17}/>添加地点</button>}</div>
    <div className="travel-totals" aria-live="polite"><span><strong>{summary.visited}</strong> 个地点留下足迹</span><span><strong>{summary.provinces}</strong> 个省份已点亮</span><span><strong>{summary.wishes}</strong> 个地方想去</span></div>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="travel-layout">
      <section className="travel-map-paper paper" aria-label="中国旅行地图"><div className="travel-map-heading"><h2>慢慢走，慢慢点亮</h2><span aria-live="polite">{hover||provinceById.get(province)?.name||'点一个地方，翻翻那段旅程'}</span></div>
        <TravelMapCanvas places={places} selected={selected} province={province} onCityChange={choose} onProvinceChange={selectProvince} onHover={setHover}/>
        <div className="travel-map-legend"><span><i className="visited"/>去过</span><span><i className="home"/>家乡</span><span><i className="wish"/>想去</span><span><i/>待点亮</span></div>
        <p className="travel-map-source">地图数据：<a href="https://github.com/BarbarossaWang/cn-atlas" target="_blank" rel="noreferrer">cn-atlas</a></p>
      </section>
      <aside className="travel-place-paper paper" aria-label="地点手账">
        {loading?<div className="travel-placeholder" role="status"><LoaderCircle size={23}/>正在展开旅行地图…</div>:active&&activeCity?<>
          {photo&&<img className="travel-place-photo" src={fileUrl(photo,true)} alt={`${activeCity.name}的旅行照片`}/>}
          <div className="travel-place-content"><span className={`travel-status ${active.status}`}>{TRAVEL_STATUS[active.status]}</span><p className="travel-region">{provinceById.get(activeCity.provinceId)?.name}</p><h2>{activeCity.name}</h2>{active.date&&<p className="travel-date"><CalendarDays size={14}/>{active.date.replaceAll('-','/')}</p>}<p className="travel-note">{active.note||(active.status==='wish'?'期待有一天，在这里留下新的故事。':'一段旅程，在这里留了下来。')}</p>
            {linked&&(linked.article&&articlePages?<a className="travel-record-link" href={`/posts/${linked.id}`}><BookOpen size={16}/><span>{linked.title}</span><ArrowRight size={16}/></a>:<button className="travel-record-link" onClick={()=>onOpen(linked)}><BookOpen size={16}/><span>看看旅行记录{itemImages(linked).length>0?` · ${itemImages(linked).length} 张照片`:''}</span><ArrowRight size={16}/></button>)}
            {owner&&<div className="travel-place-actions"><button className="text-button" disabled={busy} onClick={()=>setEditing({place:active,original:active.cityId})}><Pencil size={14}/>编辑地点</button><button className="text-button" disabled={busy} onClick={()=>setRemoving(active)}><Trash2 size={14}/>移除足迹</button></div>}
          </div>
        </>:<div className="travel-placeholder"><Plane size={30}/><h2>{activeCity?.name||(province?provinceById.get(province)?.name:'下一站，慢慢出发')}</h2><p>{province?'这里还没有留下足迹。':'点击地图上的圆点，看看去过的地方。'}</p>{owner&&<button className="text-button" onClick={()=>add(activeCity?.id)}><Plus size={15}/>在这里添加地点</button>}</div>}
      </aside>
    </div>
    <section className="travel-journal"><div className="travel-journal-heading"><h2><Heart size={20}/>路上的手账</h2>{province&&<button className="text-button" onClick={()=>setProvince('')}>查看全部地点</button>}</div>{filtered.length>0?<div className="travel-journal-list">{filtered.map(place=>{const city=cityById.get(place.cityId);return city&&<button key={city.id} className={`paper travel-journal-card ${selected===city.id?'is-selected':''}`} onClick={()=>choose(city.id)}><div><span className={`travel-status ${place.status}`}>{TRAVEL_STATUS[place.status]}</span><h3>{city.name}<ArrowRight size={17}/></h3><p>{place.note||(place.date?place.date.replaceAll('-','/'):'等一个属于这里的故事。')}</p></div><small>{provinceById.get(city.provinceId)?.name}</small></button>;})}</div>:<p className="travel-empty">{loading?'正在收好路上的足迹…':'地图上的空白，留给以后的旅程。'}</p>}</section>
    {owner&&editing&&<TravelEditor value={editing.place} existing={places.filter(place=>place.cityId!==editing.original).map(place=>place.cityId)} items={items} busy={busy} saveError={error} onClose={()=>{if(!busy)setEditing(null);}} onSave={async place=>{const next=editing.original?places.map(old=>old.cityId===editing.original?place:old):[...places,place];if(await save(next)){setSelected(place.cityId);setProvince('');setEditing(null);}}}/>}
    {owner&&removing&&<Modal title="移除这枚旅行足迹？" closeOnBackdrop={!busy} onClose={()=>{if(!busy)setRemoving(null);}}><p>移除 {cityById.get(removing.cityId)?.name} 后，地图上的标记也会消失。关联的文章和照片会保留。</p>{error&&<p role="alert" className="error">{error}</p>}<div className="travel-form-actions"><button className="button secondary" disabled={busy} onClick={()=>setRemoving(null)}>再想想</button><button className="button primary" disabled={busy} onClick={async()=>{if(await save(places.filter(place=>place.cityId!==removing.cityId))){setSelected('');setRemoving(null);}}}>{busy?'正在移除…':'确认移除'}</button></div></Modal>}
  </section>;
}

function TravelEditor({value,existing,items,busy,saveError,onClose,onSave}:{value:TravelPlace;existing:string[];items:Item[];busy:boolean;saveError:string;onClose:()=>void;onSave:(place:TravelPlace)=>Promise<void>}){
  const [place,setPlace]=useState(value);const [province,setProvince]=useState(cityById.get(value.cityId)?.provinceId||'350000');const [discard,setDiscard]=useState(false);const [error,setError]=useState('');
  const cities=TRAVEL_CITIES.filter(city=>city.provinceId===province&&!existing.includes(city.id));const dirty=JSON.stringify(place)!==JSON.stringify(value);
  function close(){if(busy)return;if(dirty)setDiscard(true);else onClose();}
  async function submit(event:FormEvent){event.preventDefault();if(!place.cityId){setError('请先选择城市。');return;}setError('');try{await onSave(place);}catch(error){setError(errorMessage(error));}}
  return <><Modal title="收好一枚旅行足迹" onClose={close} closeOnBackdrop={!busy}><form className="travel-form" onSubmit={submit}><p className="muted">地点、日期和手记会公开展示；关联记录按原本的可见范围展示。</p><div className="travel-form-grid"><label>省份<ThemeSelect ariaLabel="旅行省份" value={province} options={TRAVEL_PROVINCES.map(region=>({value:region.id,label:region.name}))} disabled={busy} onChange={id=>{setProvince(id);setPlace(old=>({...old,cityId:TRAVEL_CITIES.find(city=>city.provinceId===id&&!existing.includes(city.id))?.id||''}));}}/></label><label>城市<ThemeSelect ariaLabel="旅行城市" value={place.cityId} options={cities.length?cities.map(city=>({value:city.id,label:city.name})):[{value:'',label:'该省的地点已全部收好'}]} disabled={busy||!cities.length} onChange={cityId=>setPlace(old=>({...old,cityId}))}/></label><label>这是什么地方<ThemeSelect ariaLabel="地点状态" value={place.status} options={Object.entries(TRAVEL_STATUS).map(([value,label])=>({value,label}))} disabled={busy} onChange={status=>setPlace(old=>({...old,status:status as TravelStatus}))}/></label><label>日期（可留空）<input type="date" aria-label="旅行日期" value={place.date} disabled={busy} onChange={event=>setPlace(old=>({...old,date:event.target.value}))}/></label></div><label>地点手记<textarea maxLength={300} rows={3} placeholder="留下一点当时的心情，或对下一站的期待…" value={place.note} disabled={busy} onChange={event=>setPlace(old=>({...old,note:event.target.value}))}/></label><label>关联旅行记录<ThemeSelect ariaLabel="关联旅行记录" value={place.itemId||''} options={[{value:'',label:'暂不关联'},...items.filter(item=>item.kind==='moment').map(item=>({value:item.id,label:`${item.title}${item.visibility==='private'?'（仅自己）':item.status==='draft'?'（草稿）':''}`}))]} disabled={busy} onChange={itemId=>setPlace(old=>({...old,itemId:itemId||null}))}/></label>{(error||saveError)&&<p className="error" role="alert">{error||saveError}</p>}<div className="travel-form-actions"><button type="button" className="button secondary" disabled={busy} onClick={close}>取消</button><button className="button primary" disabled={busy||!place.cityId}>{busy?'正在保存…':'保存地点'}</button></div></form></Modal>{discard&&<Modal title="这枚足迹还没保存" onClose={()=>setDiscard(false)}><p>关闭后，这次修改不会保留。</p><div className="travel-form-actions"><button className="button secondary" onClick={()=>setDiscard(false)}>继续编辑</button><button className="button primary" onClick={onClose}>放弃修改</button></div></Modal>}</>;
}
