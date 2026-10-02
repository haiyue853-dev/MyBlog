import type {SiteStatistics} from './types';

export const STATISTICS_SCHEMA=[
  'CREATE TABLE IF NOT EXISTS site_stats_totals(id INTEGER PRIMARY KEY CHECK(id=1),views INTEGER NOT NULL DEFAULT 0,visitors INTEGER NOT NULL DEFAULT 0,since_day TEXT NOT NULL);',
  "INSERT OR IGNORE INTO site_stats_totals(id,since_day) VALUES(1,strftime('%Y-%m-%d','now','+8 hours'));",
  'CREATE TABLE IF NOT EXISTS site_stats_visitors(visitor TEXT PRIMARY KEY);',
  'CREATE TABLE IF NOT EXISTS site_stats_daily_visitors(day TEXT NOT NULL,visitor TEXT NOT NULL,PRIMARY KEY(day,visitor));',
  'CREATE TABLE IF NOT EXISTS site_stats_days(day TEXT PRIMARY KEY,views INTEGER NOT NULL DEFAULT 0,visitors INTEGER NOT NULL DEFAULT 0);',
  'CREATE TABLE IF NOT EXISTS site_stats_events(id TEXT PRIMARY KEY,visitor TEXT NOT NULL,day TEXT NOT NULL);',
  'CREATE INDEX IF NOT EXISTS site_stats_events_day ON site_stats_events(day);',
  'CREATE TRIGGER IF NOT EXISTS site_stats_visit AFTER INSERT ON site_stats_events BEGIN INSERT OR IGNORE INTO site_stats_visitors(visitor) VALUES(NEW.visitor); UPDATE site_stats_totals SET views=views+1,visitors=visitors+changes() WHERE id=1; INSERT OR IGNORE INTO site_stats_daily_visitors(day,visitor) VALUES(NEW.day,NEW.visitor); INSERT INTO site_stats_days(day,views,visitors) VALUES(NEW.day,1,changes()) ON CONFLICT(day) DO UPDATE SET views=views+1,visitors=visitors+excluded.visitors; END;',
].join('\n');
export const RECORD_VISIT_SQL='INSERT INTO site_stats_events(id,visitor,day) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id';
export const STATISTICS_SUMMARY_SQL=`SELECT t.views AS totalViews,t.visitors AS totalVisitors,t.since_day AS sinceDay,
  COALESCE(d.views,0) AS todayViews,COALESCE(d.visitors,0) AS todayVisitors,
  (SELECT COUNT(*) FROM items WHERE visibility='public' AND kind='moment') AS moments,
  (SELECT COUNT(*) FROM items WHERE visibility='public' AND kind='collection') AS collections,
  (SELECT COUNT(DISTINCT json_extract(data,'$.category')) FROM items WHERE visibility='public' AND trim(COALESCE(json_extract(data,'$.category'),''))!='') AS categories,
  (SELECT COUNT(DISTINCT j.value) FROM items i,json_each(i.data,'$.tags') j WHERE i.visibility='public' AND trim(j.value)!='') AS tags,
  COALESCE((SELECT SUM(c.count) FROM item_like_counts c JOIN items i ON c.item_id=i.id WHERE i.visibility='public'),0) AS likes
  FROM site_stats_totals t LEFT JOIN site_stats_days d ON d.day=? WHERE t.id=1`;
export const STATISTICS_HISTORY_SQL='SELECT day,views,visitors FROM site_stats_days WHERE day>=? AND day<=? ORDER BY day';
export function shiftDay(day:string,amount:number){return new Date(Date.parse(day+'T00:00:00Z')+amount*86400000).toISOString().slice(0,10);}
export function statisticsResult(row:Record<string,unknown>,history:{day:string;views:number;visitors:number}[],day:string):SiteStatistics{
  return {day,sinceDay:String(row.sinceDay),totalViews:Number(row.totalViews),totalVisitors:Number(row.totalVisitors),todayViews:Number(row.todayViews),todayVisitors:Number(row.todayVisitors),
    content:{moments:Number(row.moments),collections:Number(row.collections),categories:Number(row.categories),tags:Number(row.tags),likes:Number(row.likes)},history};
}
