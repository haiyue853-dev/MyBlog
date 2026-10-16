import {activeItemSql,publicItemSql} from './content-state';
import type {StoredComment,ManagedComment,Item,CommentReply} from './types';
import {publicationStatus} from './content-state';
export const COMMENTS_SCHEMA=`
CREATE TABLE IF NOT EXISTS visitor_profiles(visitor TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS article_comments(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,visitor TEXT NOT NULL,name TEXT NOT NULL,body TEXT NOT NULL,owner INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS article_comments_item_date ON article_comments(item_id,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS comment_reads(comment_id TEXT PRIMARY KEY REFERENCES article_comments(id) ON DELETE CASCADE,read_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS comment_replies(comment_id TEXT PRIMARY KEY REFERENCES article_comments(id) ON DELETE CASCADE,name TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
`;
export const COMMENT_FIELDS='id,item_id AS itemId,visitor,name,body,owner,created_at AS createdAt';
export const COMMENT_INSERT=`INSERT INTO article_comments(id,item_id,visitor,name,body,owner,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM items WHERE id=? AND kind='moment' AND json_type(data,'$.article')='object' AND ${publicItemSql()}) RETURNING ${COMMENT_FIELDS}`;
export const COMMENT_ATTEMPT="INSERT INTO auth_limits(key,count,started) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN started>? THEN count+1 ELSE 1 END,started=CASE WHEN started>? THEN started ELSE excluded.started END RETURNING count";
export const COMMENT_PAGE_SIZE=20;
export function commentRow(row:Record<string,unknown>):StoredComment{return {...row,owner:!!row.owner} as unknown as StoredComment;}
const MANAGED_FROM=`FROM article_comments c JOIN items i ON i.id=c.item_id LEFT JOIN comment_reads r ON r.comment_id=c.id WHERE i.kind='moment' AND json_type(i.data,'$.article')='object' AND ${activeItemSql('i')}`;
const UNREAD='c.owner=0 AND r.comment_id IS NULL';
export function managedCommentsSql(unreadOnly:boolean){return `SELECT c.id,c.item_id AS itemId,c.name,c.body,c.owner,c.created_at AS createdAt,CASE WHEN ${UNREAD} THEN 1 ELSE 0 END AS unread,i.data AS itemData ${MANAGED_FROM}${unreadOnly?` AND ${UNREAD}`:''} ORDER BY c.created_at DESC,c.id DESC LIMIT ? OFFSET ?`;}
export const MANAGED_COMMENT_COUNTS=`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN ${UNREAD} THEN 1 ELSE 0 END),0) AS unread ${MANAGED_FROM}`;
export const COMMENT_POSITION='SELECT COUNT(newer.id) AS preceding FROM article_comments target LEFT JOIN article_comments newer ON newer.item_id=target.item_id AND (newer.created_at>target.created_at OR (newer.created_at=target.created_at AND newer.id>target.id)) WHERE target.item_id=? AND target.id=? GROUP BY target.id';
export const MARK_COMMENT_READ='INSERT INTO comment_reads(comment_id,read_at) SELECT id,? FROM article_comments WHERE item_id=? AND id=? ON CONFLICT(comment_id) DO UPDATE SET read_at=excluded.read_at';
export const MARK_COMMENT_UNREAD='DELETE FROM comment_reads WHERE comment_id IN (SELECT id FROM article_comments WHERE item_id=? AND id=?)';
export function managedCommentRow(row:Record<string,unknown>):ManagedComment{
  const item=JSON.parse(String(row.itemData)) as Item;
  return {id:String(row.id),itemId:String(row.itemId),name:String(row.name),body:String(row.body),owner:!!row.owner,createdAt:String(row.createdAt),unread:!!row.unread,reply:null,item:{id:item.id,title:item.title,type:item.writingType==='review'?'review':'article',visibility:item.visibility,status:publicationStatus(item)}};
}
export const REPLY_FIELDS='comment_id AS commentId,name,body,created_at AS createdAt,updated_at AS updatedAt';
export function repliesSql(count:number){return `SELECT ${REPLY_FIELDS} FROM comment_replies WHERE comment_id IN (${Array(count).fill('?').join(',')})`;}
export const SAVE_REPLY=`INSERT INTO comment_replies(comment_id,name,body,created_at,updated_at) SELECT id,?,?,?,? FROM article_comments WHERE item_id=? AND id=? ON CONFLICT(comment_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at RETURNING ${REPLY_FIELDS}`;
export const DELETE_REPLY='DELETE FROM comment_replies WHERE comment_id IN (SELECT id FROM article_comments WHERE item_id=? AND id=?)';
export function replyRow(row:Record<string,unknown>):CommentReply{return row as unknown as CommentReply;}
