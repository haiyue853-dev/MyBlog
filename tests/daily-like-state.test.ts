import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyDailyLike,mergeDailyLikes} from '../src/lib/daily-like-state';

test('late yesterday responses cannot disable a card already loaded for today',()=>{
  const current={card:{count:3,liked:false}};
  assert.deepEqual(applyDailyLike(current,'2026-10-03','2026-10-02','card',{count:3,liked:true}),current);
  assert.deepEqual(applyDailyLike(current,'2026-10-03','2026-10-03','card',{count:4,liked:true}),{card:{count:4,liked:true}});
});

test('older same-day reads do not erase a just-completed vote or lower its count',()=>{
  assert.deepEqual(mergeDailyLikes({card:{count:4,liked:true}},'2026-10-03','2026-10-03',{card:{count:3,liked:false}}),{card:{count:4,liked:true}});
});

test('a new day clears yesterday flags on the other cards before applying a vote',()=>{
  const current={card:{count:3,liked:true},other:{count:2,liked:true}};
  assert.deepEqual(applyDailyLike(current,'2026-10-02','2026-10-03','card',{count:4,liked:true}),{card:{count:4,liked:true},other:{count:2,liked:false}});
});
