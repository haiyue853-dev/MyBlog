import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampViewport,zoomViewport,panViewport,pinchViewport,fitViewport,nearestMarker} from '../src/lib/travel-viewport';
import {TRAVEL_CITIES,TRAVEL_PROVINCES} from '../src/lib/travel';

test('zoom keeps the location under the cursor stationary',()=>{
  const view={scale:2,x:-300,y:-180};const anchor={x:420,y:310};
  const next=zoomViewport(view,1.5,anchor);
  assert.equal((anchor.x-next.x)/next.scale,(anchor.x-view.x)/view.scale);
  assert.equal((anchor.y-next.y)/next.scale,(anchor.y-view.y)/view.scale);
});
test('zoom and drag cannot lose the map outside the viewport',()=>{
  assert.deepEqual(clampViewport({scale:.1,x:400,y:-900}),{scale:1,x:0,y:0});
  const zoomed=zoomViewport({scale:1,x:0,y:0},100,{x:480,y:315});
  assert.equal(zoomed.scale,16);
  assert.deepEqual(panViewport(zoomed,99999,-99999),{scale:16,x:0,y:-9450});
  assert.deepEqual(zoomViewport(zoomed,.001,{x:480,y:315}),{scale:1,x:0,y:0});
});
test('province focus includes city boundaries and separates the Fujian footprints',()=>{
  const fujian=TRAVEL_PROVINCES.find(region=>region.id==='350000')!;
  const view=fitViewport(fujian.bounds);
  const cities=TRAVEL_CITIES.filter(city=>city.provinceId==='350000');
  assert.equal(cities.length,9);assert.ok(view.scale>4);
  for(const city of cities){
    assert.ok(city.path.length>20);
    assert.ok(city.x*view.scale+view.x>=0&&city.x*view.scale+view.x<=960);
    assert.ok(city.y*view.scale+view.y>=0&&city.y*view.scale+view.y<=630);
  }
  const quanzhou=cities.find(city=>city.id==='350500')!;const xiamen=cities.find(city=>city.id==='350200')!;
  assert.ok(Math.hypot(quanzhou.x-xiamen.x,quanzhou.y-xiamen.y)*view.scale>40);
});
test('overlapping marker hit areas choose the nearest city rather than SVG stacking order',()=>{
  const cities=TRAVEL_CITIES.filter(city=>['350100','350500','350200'].includes(city.id));
  const quanzhou=cities.find(city=>city.id==='350500')!;
  assert.equal(nearestMarker(cities,quanzhou,12)?.id,'350500');
  assert.equal(nearestMarker(cities,{x:0,y:0},12),undefined);
});
test('two fingers can zoom and move together without shifting the touched location',()=>{
  const view={scale:2,x:-400,y:-200};
  const next=pinchViewport(view,[{x:450,y:300},{x:550,y:300}],[{x:465,y:320},{x:615,y:320}]);
  assert.equal(next.scale,3);
  assert.equal((540-next.x)/next.scale,(500-view.x)/view.scale);
  assert.equal((320-next.y)/next.scale,(300-view.y)/view.scale);
});
