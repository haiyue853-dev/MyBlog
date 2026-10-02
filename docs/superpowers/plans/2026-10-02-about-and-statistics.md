# 关于我与小屋统计实现计划

使用当前工作区顺序实现，保留已有未提交代码与本地照片，不提交或推送仓库。方案见 specs/2026-10-02-about-and-statistics-design.md。

目标：参考给定页面，加入可编辑公开介绍与使用真实数据的统计模块。

- [ ] 写 tests/statistics.test.ts，验证 API 存在、匿名浏览和访客计数、事件重放/并发去重、跨日、仅公开内容统计、来源/格式拒绝、重启持久化；运行 npx tsx --test tests/statistics.test.ts，确认未实现路由404。
- [ ] src/lib/statistics-schema.ts 定义幂等统计表/触发器/SQL；src/lib/visitor.ts 共享现有匿名Cookie处理。Node Store、CloudStore、SiteStore 接入读写/限流；src/lib/api/statistics.ts 和 Node/Worker 路由接入。build-cloudflare.ts 合并统计schema。
- [ ] 先给 profile API 写保存/权限/向后兼容测试并观察失败，再在 types.ts / api/profile.ts / owner.tsx 加关于我字段及编辑。
- [ ] 创建 about.tsx、site-statistics.tsx、use-site-statistics.ts；在 space.tsx 添加公开导航/路由、宽版布局、侧栏统计及原有切页动画。Next首屏和Cloudflare浏览器入口接受新增 view。
- [ ] cloudflare.test.ts 使用真实 workerd/D1 验证并发访客与事件去重、私密内容不参与；cloudflare-update.test.ts 检查新schema且原绑定不变。
- [ ] typecheck、全量npm test、Next build、update:cloudflare（准备）、Wrangler deploy dry-run；本地浏览器验收关于我/统计/导航/返回/手机/编辑保存，无私密统计泄漏、无控制台错误。
- [ ] 读取实际改动并做一次必要审查，更新状态文档、教程与实施记录，提供可审阅的本地页面和截图。未获得本次成品发布授权时不执行 --deploy。
