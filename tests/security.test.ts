import {test} from 'node:test';
import assert from 'node:assert/strict';

const security = await import('../src/lib/security').catch(() => null);
test('client address trusts only the explicit proxy header when configured',()=>{
  assert.ok(security);
  const saved=process.env.TRUST_PROXY;
  const request=new Request('https://home.example/api/auth/login',{headers:{'x-little-world-client-ip':'192.0.2.1','x-forwarded-for':'192.0.2.2'}});
  try{
    delete process.env.TRUST_PROXY;assert.equal(security.loginClient(request),'local');
    process.env.TRUST_PROXY='1';assert.equal(security.loginClient(request),'192.0.2.1');
    assert.equal(security.loginClient(new Request(request.url,{headers:{'x-forwarded-for':'192.0.2.2'}})),'local');
    assert.equal(security.loginClient(new Request(request.url,{headers:{'x-little-world-client-ip':'192.0.2.1, 192.0.2.2'}})),'local');
    assert.equal(security.loginClient(new Request(request.url,{headers:{'x-little-world-client-ip':'2001:db8::1'}})),'2001:db8::1');
  }finally{if(saved===undefined)delete process.env.TRUST_PROXY;else process.env.TRUST_PROXY=saved;}
});
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
test('password hashing uses cost-aware format and still verifies legacy hashes', async () => {
  assert.ok(security, 'security core is not implemented');
  const {scryptSync}=await import('node:crypto');
  const salt='b'.repeat(32);
  const legacy=scryptSync('secret',salt,64).toString('hex');
  const legacyEncoded=`scrypt:${salt}:${legacy}`;
  assert.equal(security.verifyPassword('secret',legacyEncoded), true);
  assert.equal(security.verifyPassword('wrong',legacyEncoded), false);
  assert.equal(security.scryptCostOf(legacyEncoded), 16384, 'legacy cost falls back to 2^14');
  const newEncoded=security.hashPassword('secret');
  assert.equal(security.verifyPassword('secret',newEncoded), true);
  assert.equal(security.verifyPassword('wrong',newEncoded), false);
  assert.equal(security.scryptCostOf(newEncoded), 32768, 'new cost is 2^15');
  assert.equal(security.parseScryptEncoded('garbage'), null);
});
test('password migration to Cloudflare keeps the cost-aware cloud format', async () => {
  assert.ok(security, 'security core is not implemented');
  const {scryptSync,createHash}=await import('node:crypto');
  const {migratePassword}=await import('../scripts/export-cloudflare');
  const salt='c'.repeat(32);
  const legacy=scryptSync('pw',salt,64).toString('hex');
  const cloudOld=migratePassword(`scrypt:${salt}:${legacy}`);
  assert.match(cloudOld,/^scrypt-client-sha256-v1:\d+:[a-f0-9]{32}:[a-f0-9]{64}$/);
  assert.equal(cloudOld.split(':')[3], createHash('sha256').update(Buffer.from(legacy,'hex')).digest('hex'));
  const cloudNew=migratePassword(security.hashPassword('pw'));
  assert.match(cloudNew,/^scrypt-client-sha256-v1:32768:/, 'new local hash migrates at 2^15');
});
test('login locks after 5 failures in 15 minutes and clears on success', async () => {
  const {mkdtempSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {Store}=await import('../src/lib/store');
  const dir=mkdtempSync(join(tmpdir(),'little-world-lock-'));
  const store=new Store(dir);
  const client='203.0.113.7';
  for(let i=0;i<4;i++)assert.equal(store.reserveLoginVerification(client), true, `attempt ${i+1} should pass`);
  assert.equal(store.reserveLoginVerification(client), false, '5th failure trips the block');
  assert.equal(store.loginBlocked(client), true);
  store.clearLoginFailures(client);
  assert.equal(store.loginBlocked(client), false, 'clearing resets the lockout');
  assert.equal(store.reserveLoginVerification(client), true, 'can try again after clearing');
});
