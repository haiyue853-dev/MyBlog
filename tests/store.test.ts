import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const persistence = await import('../src/lib/store').catch(() => null);
test('private records remain hidden; published edits and deletion persist after restart', () => {
  assert.ok(persistence, 'persistent store is not implemented');
  const dir = mkdtempSync(join(tmpdir(), 'little-world-'));
  try {
    const store = new persistence.Store(dir);
    const item = store.saveItem({kind:'moment',title:'private',body:'secret',visibility:'private',tags:[],category:'生活',url:'',assetId:null});
    assert.equal(store.listItems(false).length, 0);
    assert.equal(store.getItem(item.id, false), null);
    store.saveItem({...item,visibility:'public'});
    assert.equal(store.listItems(false)[0].body, 'secret');
    store.close();
    const reopened = new persistence.Store(dir);
    assert.equal(reopened.listItems(false).length, 1);
    reopened.deleteItem(item.id);
    assert.equal(reopened.listItems(true).length, 0);
    reopened.close();
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('public image permission is removed when its referencing item is made private', () => {
  assert.ok(persistence, 'persistent store is not implemented');
  const dir = mkdtempSync(join(tmpdir(), 'little-world-'));
  try {
    const store=new persistence.Store(dir);
    const asset=store.addAsset({name:'photo.png',mime:'image/png',size:8,category:'图片'});
    assert.equal(store.isPublicAsset(asset.id),false);
    const item=store.saveItem({kind:'collection',title:'photo',body:'',visibility:'public',tags:[],category:'写真',url:'',assetId:asset.id});
    assert.equal(store.isPublicAsset(asset.id),true);
    store.saveItem({...item,visibility:'private'});
    assert.equal(store.isPublicAsset(asset.id),false);
    assert.equal(store.assetInUse(asset.id),true);
    store.deleteItem(item.id);
    assert.equal(store.assetInUse(asset.id),false);
    store.close();
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('sessions expire and resetting owner credentials revokes existing sessions', () => {
  assert.ok(persistence, 'persistent store is not implemented');
  const dir=mkdtempSync(join(tmpdir(),'little-world-'));
  try {
    const store=new persistence.Store(dir);
    store.setOwner('站主','hash');
    store.createSession('expired',Date.now()-1);
    store.createSession('valid',Date.now()+60000);
    assert.equal(store.hasSession('expired'),false);
    assert.equal(store.hasSession('valid'),true);
    store.setOwner('站主','new-hash');
    assert.equal(store.hasSession('valid'),false);
    store.close();
  } finally {rmSync(dir,{recursive:true,force:true});}
});
