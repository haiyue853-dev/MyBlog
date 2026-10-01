import {test} from 'node:test';
import assert from 'node:assert/strict';
const motion=await import('../src/lib/motion').catch(()=>null);

test('system reduced motion sets the default when no site choice has been made',()=>{
  assert.ok(motion,'motion preference resolver is missing');
  assert.equal(motion.resolveMotion(null,true),false);
  assert.equal(motion.resolveMotion(null,false),true);
});
test('explicitly enabling site effects overrides the system animation preference',()=>{
  assert.ok(motion,'motion preference resolver is missing');
  assert.equal(motion.resolveMotion('on',true),true);
});
test('explicitly disabling site effects remains disabled in either system mode',()=>{
  assert.ok(motion,'motion preference resolver is missing');
  assert.equal(motion.resolveMotion('off',false),false);
  assert.equal(motion.resolveMotion('off',true),false);
});
