import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {StatsSummary,formatSiteUptime} from '../src/components/site-statistics';
import type {SiteStatistics} from '../src/lib/types';

const stats:SiteStatistics={day:'2026-10-16',sinceDay:'2026-10-01',todayViews:7,todayVisitors:3,totalVisitors:531,totalViews:45998,content:{moments:12,collections:2,categories:4,tags:5,likes:8,articles:9,words:31483},history:[]};
test('sidebar card includes uptime, visit totals and a two-column article summary',()=>{
 const html=renderToStaticMarkup(createElement(StatsSummary,{stats,onOpen:()=>{}}));
 for(const label of ['站点统计','已运行','今日访问','总访客','总访问','文章字数','文章数量','分类','标签'])assert.ok(html.includes(label));
 for(const value of ['45,998','31,483','531'])assert.ok(html.includes(value));
 assert.match(html,/sidebar-stats-content/);assert.match(html,/翻开统计手账/);
 const empty=renderToStaticMarkup(createElement(StatsSummary,{stats:null,onOpen:()=>{}}));assert.doesNotMatch(empty,/NaN|undefined/);
});
test('uptime uses the persisted Beijing start day rather than the browser session',()=>{
 const start=Date.parse('2026-10-01T00:00:00+08:00');
 assert.equal(formatSiteUptime('2026-10-01',start+319*86400000+10*3600000+56*60000+2000),'319 天 10 时 56 分 2 秒');
 assert.equal(formatSiteUptime('2026-10-01',start-1000),'0 天 0 时 0 分 0 秒');
 assert.equal(formatSiteUptime('invalid',start),'—');
});
