import {test} from 'node:test';
import assert from 'node:assert/strict';

const security = await import('../src/lib/security').catch(() => null);
test('password hash never stores plaintext and rejects the wrong password', () => {
  assert.ok(security, 'security core is not implemented');
  const encoded = security.hashPassword('a-safe-test-password');
  assert.ok(!encoded.includes('a-safe-test-password'));
  assert.equal(security.verifyPassword('a-safe-test-password', encoded), true);
  assert.equal(security.verifyPassword('wrong-password', encoded), false);
  assert.equal(security.verifyPassword('wrong-password', 'corrupt'), false);
});
test('cross-origin and missing-origin mutations are rejected', () => {
  assert.ok(security, 'security core is not implemented');
  assert.equal(security.isSameOrigin('https://bad.example', 'https://home.example/api/items'), false);
  assert.equal(security.isSameOrigin(null, 'https://home.example/api/items'), false);
  assert.equal(security.isSameOrigin('https://home.example', 'https://home.example/api/items'), true);
  assert.equal(security.isSameOrigin('https://home.example', 'http://internal:3000/api/items', 'https://home.example'), true);
});
test('external links only allow http or https', () => {
  assert.ok(security, 'security core is not implemented');
  assert.equal(security.safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(security.safeExternalUrl('file:///D:/private'), null);
  assert.equal(security.safeExternalUrl('https://example.com'), 'https://example.com/');
});
test('unreferenced private assets require the owner', () => {
  assert.ok(security, 'security core is not implemented');
  assert.equal(security.canReadAsset(false, false), false);
  assert.equal(security.canReadAsset(false, true), true);
  assert.equal(security.canReadAsset(true, false), true);
});
test('uploaded active content cannot be served as an inline image', () => {
  assert.ok(security, 'security core is not implemented');
  assert.equal(security.imageMime(Buffer.from('<svg onload="alert(1)">')), null);
  assert.equal(security.imageMime(Buffer.from('<html>')), null);
  assert.equal(security.imageMime(Buffer.from([137,80,78,71,13,10,26,10])), 'image/png');
});
