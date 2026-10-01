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
  assert.equal(security.isSameOrigin('https://bad.example', 'https://home.example'), false);
  assert.equal(security.isSameOrigin(null, 'https://home.example'), false);
  assert.equal(security.isSameOrigin('https://home.example', 'https://home.example'), true);
  assert.equal(security.isSameOrigin('not a url', 'https://home.example'), false);
});
// 这条是回归：Next 的 standalone server 会把 request.url 的 host 写成 localhost，所以
// 从 http://127.0.0.1:3000 进来时 Origin 与 request.url 天然不等 —— 曾经因此让那个地址下
// 的所有写操作全部 403（而那正是启动横幅让人打开的地址）。判定必须看 Host 头，不能看 request.url。
test('the origin check follows the Host header, not the localhost Next rewrites into request.url', () => {
  assert.ok(security, 'security core is not implemented');
  const saved = process.env.APP_URL;
  delete process.env.APP_URL;
  const request = new Request('http://localhost:3000/api/items', {headers: {host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000'}});
  // 先确认 Host 真的落进了 headers —— 浏览器里 Host 是 forbidden header name，
  // 万一将来 Node 也开始剥它，这条会先炸，而不是让下面的断言空转。
  assert.equal(request.headers.get('host'), '127.0.0.1:3000', 'Host header must be preserved for this test to mean anything');
  assert.equal(security.requestOrigin(request), 'http://127.0.0.1:3000');
  assert.equal(security.isSameOrigin(request.headers.get('origin'), security.requestOrigin(request)), true);
  // localhost 进来的同样要对。
  const viaLocalhost = new Request('http://localhost:3000/api/items', {headers: {host: 'localhost:3000', origin: 'http://localhost:3000'}});
  assert.equal(security.isSameOrigin(viaLocalhost.headers.get('origin'), security.requestOrigin(viaLocalhost)), true);
  // 真正的跨站还是得挡下来。
  const alien = new Request('http://localhost:3000/api/items', {headers: {host: '127.0.0.1:3000', origin: 'http://evil.example'}});
  assert.equal(security.isSameOrigin(alien.headers.get('origin'), security.requestOrigin(alien)), false);
  // 端口不同也算不同源。
  const wrongPort = new Request('http://localhost:3000/api/items', {headers: {host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3101'}});
  assert.equal(security.isSameOrigin(wrongPort.headers.get('origin'), security.requestOrigin(wrongPort)), false);
  // 配了 APP_URL 就以它为准（部署时的权威地址）。
  process.env.APP_URL = 'https://home.example';
  assert.equal(security.requestOrigin(request), 'https://home.example');
  assert.equal(security.isSameOrigin('https://home.example', security.requestOrigin(request)), true);
  assert.equal(security.isSameOrigin('http://127.0.0.1:3000', security.requestOrigin(request)), false);
  if(saved===undefined)delete process.env.APP_URL;else process.env.APP_URL=saved;
});
test('an https request behind a proxy still gets a Secure cookie', () => {
  assert.ok(security, 'security core is not implemented');
  const saved = process.env.APP_URL;
  delete process.env.APP_URL;
  const proxied = new Request('http://localhost:3000/api/auth/login', {headers: {'x-forwarded-proto': 'https', 'x-forwarded-host': 'home.example'}});
  assert.equal(security.requestOrigin(proxied), 'https://home.example');
  assert.equal(security.isSecureRequest(proxied), true);
  const plain = new Request('http://localhost:3000/api/auth/login', {headers: {host: '127.0.0.1:3000'}});
  assert.equal(security.isSecureRequest(plain), false);
  if(saved===undefined)delete process.env.APP_URL;else process.env.APP_URL=saved;
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
