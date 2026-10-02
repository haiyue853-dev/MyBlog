// Only additive, replayable schema changes; shared by local SQLite and D1 packaging.
export const LIKES_SCHEMA=[
  'CREATE TABLE IF NOT EXISTS item_like_counts(item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,count INTEGER NOT NULL DEFAULT 0);',
  'CREATE TABLE IF NOT EXISTS item_like_visits(item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,visitor TEXT NOT NULL,day TEXT NOT NULL,PRIMARY KEY(item_id,visitor));',
  'CREATE TRIGGER IF NOT EXISTS item_like_insert AFTER INSERT ON item_like_visits BEGIN INSERT INTO item_like_counts(item_id,count) VALUES(NEW.item_id,1) ON CONFLICT(item_id) DO UPDATE SET count=count+1; END;',
  'CREATE TRIGGER IF NOT EXISTS item_like_update AFTER UPDATE OF day ON item_like_visits WHEN NEW.day>OLD.day BEGIN UPDATE item_like_counts SET count=count+1 WHERE item_id=NEW.item_id; END;',
].join('\n');
export const DAILY_LIKE_SQL="INSERT INTO item_like_visits(item_id,visitor,day) SELECT id,?,? FROM items WHERE id=? AND (? OR visibility='public') ON CONFLICT(item_id,visitor) DO UPDATE SET day=excluded.day WHERE item_like_visits.day<excluded.day RETURNING item_id";
export function likeStateSql(size:number){return `SELECT items.id,COALESCE(c.count,0) AS count,COALESCE(v.day>=?,0) AS liked FROM items LEFT JOIN item_like_counts c ON c.item_id=items.id LEFT JOIN item_like_visits v ON v.item_id=items.id AND v.visitor=? WHERE items.id IN (${Array(size).fill('?').join(',')}) AND (? OR items.visibility='public')`;}
