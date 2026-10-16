'use client';
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {Minus,Plus,RotateCcw} from 'lucide-react';
import {TRAVEL_CITIES,TRAVEL_PROVINCES,TRAVEL_MAP_SIZE,TRAVEL_STATUS,type TravelPlace} from '@/lib/travel';
import {NATIONAL_VIEW,MAX_MAP_SCALE,fitViewport,zoomViewport,panViewport,pinchViewport,nearestMarker,type MapPoint,type MapViewport} from '@/lib/travel-viewport';
import {ThemeSelect} from './theme-select';

const citiesById=new Map(TRAVEL_CITIES.map(city=>[city.id,city]));
const regionsById=new Map(TRAVEL_PROVINCES.map(region=>[region.id,region]));
const center={x:TRAVEL_MAP_SIZE.width/2,y:TRAVEL_MAP_SIZE.height/2};
type Gesture={view:MapViewport;points:MapPoint[];moved:boolean};

export function TravelMapCanvas({places,selected,province,onCityChange,onProvinceChange,onHover}:{places:TravelPlace[];selected:string;province:string;onCityChange:(id:string)=>void;onProvinceChange:(id:string)=>void;onHover:(name:string)=>void}){
  const svg=useRef<SVGSVGElement>(null);
  const [view,setView]=useState<MapViewport>(NATIONAL_VIEW);const viewRef=useRef(view);
  const [unitPerPixel,setUnitPerPixel]=useState(1);const [dragging,setDragging]=useState(false);
  const pointers=useRef(new Map<number,MapPoint>());const gesture=useRef<Gesture|null>(null);const suppressClick=useRef(false);
  const pressedRegion=useRef<{cityId?:string;provinceId?:string}|null>(null);
  const footprintByCity=new Map(places.map(place=>[place.cityId,place]));
  const litProvinces=new Set(places.filter(place=>place.status!=='wish').map(place=>citiesById.get(place.cityId)?.provinceId));
  const homeProvinces=new Set(places.filter(place=>place.status==='home').map(place=>citiesById.get(place.cityId)?.provinceId));
  const detailedCities=province?TRAVEL_CITIES.filter(city=>city.provinceId===province):view.scale>=3?TRAVEL_CITIES:[];
  const visiblePins=places.flatMap(place=>{const city=citiesById.get(place.cityId);return city&&(!province||city.provinceId===province)?[{...city,status:place.status}]:[];});
  function update(next:MapViewport){viewRef.current=next;setView(next);}
  function mapPoint(clientX:number,clientY:number):MapPoint|null{
    const matrix=svg.current?.getScreenCTM();if(!matrix)return null;
    const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());return {x:point.x,y:point.y};
  }
  useEffect(()=>{
    const region=regionsById.get(province);const next=region?fitViewport(region.bounds):NATIONAL_VIEW;
    viewRef.current=next;setView(next);
  },[province]);
  useEffect(()=>{
    const city=citiesById.get(selected);if(!province||city?.provinceId!==province)return;
    const camera=viewRef.current;const x=city.x*camera.scale+camera.x,y=city.y*camera.scale+camera.y;
    if(x<24||x>TRAVEL_MAP_SIZE.width-24||y<24||y>TRAVEL_MAP_SIZE.height-24)update(panViewport(camera,center.x-x,center.y-y));
  },[selected,province]);
  useEffect(()=>{
    const element=svg.current;if(!element)return;
    const resize=()=>{const matrix=element.getScreenCTM();if(matrix)setUnitPerPixel(1/Math.hypot(matrix.a,matrix.b));};
    resize();const observer=new ResizeObserver(resize);observer.observe(element);
    const wheel=(event:WheelEvent)=>{
      event.preventDefault();const anchor=mapPoint(event.clientX,event.clientY);if(!anchor)return;
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1);
      update(zoomViewport(viewRef.current,Math.exp(-delta*.0016),anchor));
    };
    element.addEventListener('wheel',wheel,{passive:false});
    return()=>{observer.disconnect();element.removeEventListener('wheel',wheel);};
  },[]);
  function reset(){update(NATIONAL_VIEW);onProvinceChange('');}
  function startGesture(){gesture.current={view:viewRef.current,points:[...pointers.current.values()],moved:false};}
  function pointerDown(event:ReactPointerEvent<SVGSVGElement>){
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const point=mapPoint(event.clientX,event.clientY);if(!point)return;
    if(pointers.current.size===0){
      suppressClick.current=false;
      const target=(event.target as Element).closest<SVGElement>('[data-city-id],[data-province-id]');
      pressedRegion.current=target?{cityId:target.dataset.cityId,provinceId:target.dataset.provinceId}:null;
    }
    pointers.current.set(event.pointerId,point);event.currentTarget.setPointerCapture(event.pointerId);startGesture();
  }
  function pointerMove(event:ReactPointerEvent<SVGSVGElement>){
    if(!pointers.current.has(event.pointerId))return;
    const point=mapPoint(event.clientX,event.clientY);if(!point)return;
    pointers.current.set(event.pointerId,point);
    const current=gesture.current;if(!current)return;
    const points=[...pointers.current.values()];
    if(points.length>=2&&current.points.length>=2){
      update(pinchViewport(current.view,[current.points[0],current.points[1]],[points[0],points[1]]));
      current.moved=true;
    }else if(points.length===1){
      const dx=points[0].x-current.points[0].x,dy=points[0].y-current.points[0].y;
      if(Math.hypot(dx,dy)>4*unitPerPixel)current.moved=true;
      if(current.moved)update(panViewport(current.view,dx,dy));
    }
    if(current.moved){suppressClick.current=true;setDragging(true);onHover('');}
  }
  function pointerEnd(event:ReactPointerEvent<SVGSVGElement>){
    if(!pointers.current.delete(event.pointerId))return;
    if(pointers.current.size)startGesture();else{gesture.current=null;setDragging(false);}
  }
  function activate(event:React.KeyboardEvent,callback:()=>void){if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();callback();}}
  const markerUnit=unitPerPixel/view.scale;
  return <>
    <div className="travel-map-controls">
      <ThemeSelect ariaLabel="地图省份" value={province} options={[{value:'',label:'全国地图'},...TRAVEL_PROVINCES.map(region=>({value:region.id,label:region.name}))]} onChange={onProvinceChange}/>
      <div className="travel-zoom-controls">
        <button type="button" aria-label="缩小地图" title="缩小地图" disabled={view.scale<=1} onClick={()=>update(zoomViewport(viewRef.current,1/1.4,center))}><Minus size={17}/></button>
        <output aria-label="地图缩放比例">{Math.round(view.scale*100)}%</output>
        <button type="button" aria-label="放大地图" title="放大地图" disabled={view.scale>=MAX_MAP_SCALE} onClick={()=>update(zoomViewport(viewRef.current,1.4,center))}><Plus size={17}/></button>
      </div>
      <button type="button" className="travel-map-reset" onClick={reset}><RotateCcw size={15}/>回全国</button>
    </div>
    <div className="travel-map-viewport">
      <svg ref={svg} className={`travel-map-svg ${dragging?'is-dragging':''}`} viewBox={`0 0 ${TRAVEL_MAP_SIZE.width} ${TRAVEL_MAP_SIZE.height}`} role="group" tabIndex={0} aria-label="中国旅行地图，可缩放和拖动" aria-describedby="travel-map-help"
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}
        onClickCapture={event=>{
          if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;return;}
          if(event.detail===0)return;
          const point=mapPoint(event.clientX,event.clientY);if(!point)return;
          const camera=viewRef.current;
          const nearest=nearestMarker(visiblePins,{x:(point.x-camera.x)/camera.scale,y:(point.y-camera.y)/camera.scale},18*unitPerPixel/camera.scale);
          if(nearest){event.stopPropagation();onCityChange(nearest.id);}
          else if(pressedRegion.current?.cityId){event.stopPropagation();onCityChange(pressedRegion.current.cityId);}
          else if(pressedRegion.current?.provinceId){event.stopPropagation();onProvinceChange(pressedRegion.current.provinceId);}
        }}
        onDoubleClick={event=>{event.preventDefault();const point=mapPoint(event.clientX,event.clientY);if(point)update(zoomViewport(viewRef.current,1.5,point));}}
        onKeyDown={event=>{
          if(event.target!==event.currentTarget)return;
          if(event.key==='+'||event.key==='='){event.preventDefault();update(zoomViewport(viewRef.current,1.4,center));}
          else if(event.key==='-'){event.preventDefault();update(zoomViewport(viewRef.current,1/1.4,center));}
          else if(event.key==='Home'||event.key==='0'){event.preventDefault();reset();}
          else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();update(panViewport(viewRef.current,event.key==='ArrowLeft'?60:event.key==='ArrowRight'?-60:0,event.key==='ArrowUp'?60:event.key==='ArrowDown'?-60:0));}
        }}>
        <g className={`travel-map-camera ${province?'is-focused':''}`} transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          <rect className="travel-sea-inset" x="830" y="437" width="104" height="169" rx="9" aria-hidden="true"/>
          <text className="travel-sea-label" x="882" y="600" textAnchor="middle" aria-hidden="true">南海诸岛</text>
          {TRAVEL_PROVINCES.map(region=><path key={region.id} data-province-id={region.id} d={region.path} className={`travel-province ${litProvinces.has(region.id)?'is-lit':''} ${homeProvinces.has(region.id)?'is-home':''} ${province===region.id?'is-selected':''}`} role="button" tabIndex={0} aria-label={`${region.name}${litProvinces.has(region.id)?'，已点亮':'，待点亮'}`} aria-pressed={province===region.id} onClick={()=>onProvinceChange(region.id)} onKeyDown={event=>activate(event,()=>onProvinceChange(region.id))} onMouseEnter={()=>onHover(region.name)} onMouseLeave={()=>onHover('')}><title>{region.name}</title></path>)}
          {detailedCities.filter(city=>city.bounds.x*view.scale+view.x<960&&(city.bounds.x+city.bounds.width)*view.scale+view.x>0&&city.bounds.y*view.scale+view.y<630&&(city.bounds.y+city.bounds.height)*view.scale+view.y>0).map(city=>{
            const footprint=footprintByCity.get(city.id);
            return <g key={city.id}>
              <path data-city-id={city.id} d={city.path} className={`travel-city ${footprint?.status||''} ${selected===city.id?'is-selected':''}`} role="button" tabIndex={0} aria-label={`${city.name}区域${footprint?'，'+TRAVEL_STATUS[footprint.status]:'，待点亮'}`} aria-pressed={selected===city.id} onClick={()=>onCityChange(city.id)} onKeyDown={event=>activate(event,()=>onCityChange(city.id))} onMouseEnter={()=>onHover(city.name)} onMouseLeave={()=>onHover('')}><title>{city.name}</title></path>
              {!footprint&&city.bounds.width*view.scale/unitPerPixel>30&&<g transform={`translate(${city.x} ${city.y}) scale(${markerUnit})`} aria-hidden="true"><text className="travel-city-label" textAnchor="middle">{city.name.replace(/市$/,'')}</text></g>}
            </g>;
          })}
          {visiblePins.map(city=><g key={city.id} data-city-id={city.id} transform={`translate(${city.x} ${city.y}) scale(${markerUnit})`} className={`travel-pin ${city.status} ${selected===city.id?'is-selected':''}`} role="button" tabIndex={0} aria-label={`${city.name}，${TRAVEL_STATUS[city.status]}`} aria-pressed={selected===city.id} onClick={()=>onCityChange(city.id)} onKeyDown={event=>activate(event,()=>onCityChange(city.id))} onMouseEnter={()=>onHover(city.name)} onMouseLeave={()=>onHover('')}>
            <title>{city.name} · {TRAVEL_STATUS[city.status]}</title><circle className="travel-pin-hit" r="14"/><circle className="travel-pin-halo" r="10"/><circle className="travel-pin-dot" r="4"/>{(province||selected===city.id||view.scale>=3)&&<text x="10" y="-9">{city.name.replace(/市$/,'')}</text>}
          </g>)}
        </g>
      </svg>
    </div>
    <p className="travel-map-help" id="travel-map-help">滚轮或双指缩放 · 拖动查看 · 点省份展开城市</p>
  </>;
}
