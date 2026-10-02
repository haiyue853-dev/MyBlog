# 卡片每日点赞实现计划

目标：将浏览器里的喜欢标记替换成服务器保存的每日点赞和总数，兼容本地及 Cloudflare。

按现有架构在当前会话顺序完成，保留未提交改动，不发布云端。

- [x] 在 tests/likes.test.ts 写 API 测试，运行 `npx tsx --test tests/likes.test.ts`，确认原路由返回 404，未实现每日计数。
- [x] 在 src/lib/likes-schema.ts、src/lib/api/likes.ts、src/lib/store.ts 和 cloudflare/store.ts 实现每日日期、Cookie、原子累计及读写权限；更新 Node/Worker 路由与 SiteStore。
- [x] 在 tests/cloudflare.test.ts 使用真实 D1/workerd 验证两个访客及同访客16并发去重；本地测试验证 next-day、重启和私人范围。
- [x] 在 src/components/daily-likes.tsx 接入可见卡片批量状态，更新 CollectionWall/Space/CSS 心心和累计数，保留原主题。
- [x] 在 update-cloudflare.ts 加入更新包 schema.sql 及发布前幂等建表，扩展保留账号/内容测试；改写中文教程明确“后续更新，无需打包”。
- [x] 执行 `npm run typecheck`、`npm test`（66项通过）、`npm run build`、`npm run update:cloudflare` 和 Wrangler dry-run；重启 3000 本地服务，浏览器验证点击、刷新、筛选及446px窄屏布局。一次审查发现跨日旧响应问题，已回归修复。
- [x] 更新状态文档和实施记录，给出本地入口与更新命令；不执行 --deploy，不同步照片。

后续发布（2026-10-02）：用户要求上传已完成工作，已执行 --deploy 将每日点赞所需表、触发器和代码发布到现有 home。真实线上私密验收卡片中，同访客 8 并发仅累计一次、第二访客累计到 2、刷新后状态保留、匿名无法查看私人范围、跨来源写入 403。临时卡片和其点赞已级联删除，验收会话退出，原有用户会话保留。
