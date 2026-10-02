import {test} from 'node:test';
import assert from 'node:assert/strict';

const cropModule=await import('../src/lib/avatar-crop').catch(()=>null);
function crop(width:number,height:number,zoom:number,center={x:.5,y:.5}){
  assert.ok(cropModule,'avatar crop geometry is missing');
  return cropModule.avatarCrop(width,height,zoom,center);
}

test('initial avatar crop fills the circle without stretching landscape or portrait photos',()=>{
  assert.deepEqual(crop(1200,800,1),{x:200,y:0,size:800});
  assert.deepEqual(crop(800,1200,1),{x:0,y:200,size:800});
});

test('dragging to any edge cannot expose empty pixels in the saved avatar',()=>{
  for(const [width,height] of [[1200,800],[800,1200],[100,100]]){
    for(const zoom of [1,2,4])for(const center of [{x:-2,y:-2},{x:3,y:3},{x:0,y:1},{x:.9,y:.1}]){
      const rect=crop(width,height,zoom,center);
      assert.ok(rect.x>=0&&rect.y>=0);
      assert.ok(rect.x+rect.size<=width&&rect.y+rect.size<=height);
      assert.equal(rect.size,Math.min(width,height)/zoom);
    }
  }
});

test('zoom keeps the selected subject in the center when space permits',()=>{
  const before=crop(1200,800,2,{x:.6,y:.4});
  const after=crop(1200,800,4,{x:.6,y:.4});
  assert.equal(before.x+before.size/2,after.x+after.size/2);
  assert.equal(before.y+before.size/2,after.y+after.size/2);
});

test('zooming back out clamps the crop to the photo instead of leaving blank borders',()=>{
  assert.deepEqual(crop(1200,800,1,{x:1,y:1}),{x:400,y:0,size:800});
});
