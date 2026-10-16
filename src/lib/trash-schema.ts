import type {TrashEntry} from './types';

export const TRASH_SCHEMA=`
CREATE TABLE IF NOT EXISTS item_trash(item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,deleted_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS item_trash_date ON item_trash(deleted_at DESC,item_id DESC);
`;
export const TRASH_PAGE_SIZE=20;
export const TRASH_LIST='SELECT i.data,t.deleted_at FROM item_trash t JOIN items i ON i.id=t.item_id ORDER BY t.deleted_at DESC,t.item_id DESC LIMIT ? OFFSET ?';
export const TRASH_ONE='SELECT i.data,t.deleted_at FROM item_trash t JOIN items i ON i.id=t.item_id WHERE t.item_id=?';
export const MOVE_TO_TRASH='INSERT INTO item_trash(item_id,deleted_at) SELECT id,? FROM items WHERE id=? ON CONFLICT(item_id) DO NOTHING';
export const RESTORE_ITEM='DELETE FROM item_trash WHERE item_id=?';
export const PURGE_ITEM='DELETE FROM items WHERE id=? AND EXISTS(SELECT 1 FROM item_trash t WHERE t.item_id=items.id)';
export function trashRow(row:Record<string,unknown>):TrashEntry{return {item:JSON.parse(String(row.data)),deletedAt:String(row.deleted_at)};}
