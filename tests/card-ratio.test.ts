import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cardAspect} from '../src/lib/types';

// 卡片比例是收藏馆瀑布流的地基：算错了，每张卡的高度就错，整面墙的平衡跟着一起错。
// 这里锁住四个分支：手动覆盖 > 原图尺寸 > 兜底 2:3，以及自动档的上下限。
// 断言的字符串要和浏览器 `getComputedStyle(...).aspectRatio` 报出来的完全一致 ——
// 浏览器端的验收脚本正是拿这些值去比对的。

test('手动指定的形状优先于原图尺寸', () => {
  // 横图却指定竖版：应当按竖版裁，而不是听原图的
  assert.equal(cardAspect({cardRatio: 'portrait', imageWidth: 450, imageHeight: 300}), '0.6667');
  // 竖图却指定横版
  assert.equal(cardAspect({cardRatio: 'landscape', imageWidth: 300, imageHeight: 450}), '1.5');
});

test('三个手动形状各自的比例', () => {
  assert.equal(cardAspect({cardRatio: 'portrait'}), '0.6667');
  assert.equal(cardAspect({cardRatio: 'landscape'}), '1.5');
  assert.equal(cardAspect({cardRatio: 'square'}), '1');
});

test('跟随原图时用上传时量到的尺寸', () => {
  assert.equal(cardAspect({cardRatio: 'auto', imageWidth: 300, imageHeight: 450}), '0.6667');
  assert.equal(cardAspect({cardRatio: 'auto', imageWidth: 450, imageHeight: 300}), '1.5');
  assert.equal(cardAspect({cardRatio: 'auto', imageWidth: 320, imageHeight: 320}), '1');
  assert.equal(cardAspect({cardRatio: 'auto', imageWidth: 1200, imageHeight: 1500}), '0.8');
});

test('原图尺寸缺失时退回 2:3', () => {
  assert.equal(cardAspect({}), '0.6667');
  assert.equal(cardAspect({cardRatio: 'auto'}), '0.6667');
  // 只有一半、是 0、是负数、或者根本不是数字，都算「没量到」
  assert.equal(cardAspect({imageWidth: 300}), '0.6667');
  assert.equal(cardAspect({imageHeight: 450}), '0.6667');
  assert.equal(cardAspect({imageWidth: 0, imageHeight: 450}), '0.6667');
  assert.equal(cardAspect({imageWidth: -300, imageHeight: 450}), '0.6667');
  assert.equal(cardAspect({imageWidth: Number.NaN, imageHeight: 450}), '0.6667');
});

test('自动档把极端长图夹在 1:2 ~ 2:1 之间', () => {
  // 超宽全景：3.2 会被夹到 2，否则那一列会被一张扁卡拉成面条
  assert.equal(cardAspect({imageWidth: 640, imageHeight: 200}), '2');
  // 极端窄长：0.1 会被夹到 0.5
  assert.equal(cardAspect({imageWidth: 100, imageHeight: 1000}), '0.5');
  // 正好压在边界上的不夹
  assert.equal(cardAspect({imageWidth: 520, imageHeight: 260}), '2');
  assert.equal(cardAspect({imageWidth: 260, imageHeight: 520}), '0.5');
  // 常见的 2:3、3:2、4:5、16:9 都落在区间内，不该被动
  assert.equal(cardAspect({imageWidth: 1500, imageHeight: 2000}), '0.75');
  assert.equal(cardAspect({imageWidth: 1920, imageHeight: 1080}), '1.7778');
});

test('返回的字符串是浏览器认得的数值', () => {
  for (const value of [cardAspect({}), cardAspect({cardRatio: 'landscape'}), cardAspect({imageWidth: 1200, imageHeight: 1500})]) {
    assert.ok(Number.isFinite(Number(value)), `${value} 应当是个数值`);
    assert.match(value, /^\d+(\.\d+)?$/, `${value} 不该带单位或多余符号`);
  }
});
