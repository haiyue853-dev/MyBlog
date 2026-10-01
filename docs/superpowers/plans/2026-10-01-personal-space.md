# K-pop 个人空间实现计划

> 面向 AI 代理的工作者：使用 executing-plans 在当前会话逐任务实现；步骤用复选框追踪。

**目标：** 把已确认的原型交付为能保存个人资料、生活和收藏、接入 Iris，并可自托管的网站。

**架构：** Next.js App Router 提供网页与同源 API；Node 内置 SQLite 持久化元数据，私有目录保存文件。站主登录后由服务端访问 Iris，公开内容与私人资料由服务器验证权限。

**技术栈：** Next.js 16、React 19、TypeScript、node:sqlite、Lucide、react-markdown、Node test + tsx。

**规格：** docs/superpowers/specs/2026-10-01-personal-space-design.md

## 文件职责

- `src/lib/store.ts`：SQLite、条目、文件、设置和会话持久化。
- `src/lib/security.ts`：密码、会话、文件可见性、输入验证和跨站校验。
- `src/lib/http.ts`：限量请求体与 API 错误处理。
- `src/lib/iris.ts`：受限 Iris 路由与 NDJSON 事件解析。
- `src/app/api/**/route.ts`：验证身份后执行具体操作。
- `src/components/space.tsx`：公开空间和导航。
- `src/components/{owner,files,iris,editor}.tsx`：私人管理、资料和助手。
- `src/app/globals.css`：已确认的配色、响应式布局、动效。
- `scripts/owner.ts`、`scripts/backup.ts`：本地账号初始化与备份。
- `Dockerfile`、`compose.yaml`、`Caddyfile`、`README.md`：部署与使用。

## 任务 1：基础与安全核心

- [ ] 写测试，验证错误密码、过期会话、跨站写入、危险链接和私密文件的拒绝行为。
- [ ] 运行 `npm test`，确认未实现接口导致断言失败。
- [ ] 实现接口：`hashPassword(password)`、`verifyPassword(password, encoded)`、`isSameOrigin(origin, requestUrl, configuredOrigin?)`、`safeExternalUrl(url)`、`canReadAsset(owner, publiclyReferenced)`。
- [ ] 运行 `npm test`，预期全部核心测试通过。

```ts
assert.equal(isSameOrigin('https://other.example', 'https://my.example/api/items'), false);
assert.equal(safeExternalUrl('javascript:alert(1)'), null);
assert.equal(canReadAsset(false, false), false);
```

## 任务 2：持久化与 API

- [ ] 写独立临时数据库测试：私密条目不可公开读取；更新、删除与重开数据库；文件公开引用随条目撤回取消。
- [ ] 写真实 HTTP 权限验证脚本：未登录的文件列表、上传、写入、Iris 请求都返回 401。
- [ ] 实现条目/文件/设置/站主账号持久化；随机会话 Cookie 与 POST/PUT/DELETE Origin 校验。
- [ ] 运行 `npm test`，预期持久化测试全部通过。

```ts
const item = store.saveItem({kind:'moment', title:'private', body:'secret', visibility:'private'});
assert.equal(store.listItems(false).some(x => x.id === item.id), false);
store.saveItem({...item, visibility:'public'});
assert.equal(store.listItems(false).length, 1);
```

## 任务 3：公开与私人界面

- [ ] 实现公开主页、生活、收藏与空状态，支持真实图片与安全外链。
- [ ] 实现登录、默认私密编辑器、筛选、文件上传/下载、站主资料和头像设置。
- [ ] 用浏览器检查新增/修改/删除、登录与登出、公开/私密切换；在 360px 检查无横向溢出。
- [ ] 运行 `npm run typecheck`，预期退出 0；不为纯样式编写重复实现的测试。

## 任务 4：Iris 接口

- [ ] 写 NDJSON 分块测试：多行、跨块 UTF-8、错误事件与末尾无换行事件。
- [ ] 对照本地 Iris schemas 实现会话、流式对话、知识库查询、显式导入文件。
- [ ] 测试离线的 503 提示，并用本地模拟 upstream 验证请求与流式协议，不声称真实模型已验证。
- [ ] 运行 `npm test` 与 `npm run typecheck`，预期通过。

## 任务 5：部署、验证、交付

- [ ] 添加单实例 Docker 配置、HTTPS 入口、持久化目录、备份与恢复说明。
- [ ] 运行 `npm test`、`npm run typecheck`、`npm run build`，预期均退出 0。
- [ ] 使用独立测试数据做真实 API 与浏览器验收；开发预览使用空的正式数据目录。
- [ ] 做一次完整代码审查，修复影响权限或数据持久化的问题并验证。
- [ ] 打开本地网站预览，交付运行方式和明确的 Iris / 云端验证边界。
