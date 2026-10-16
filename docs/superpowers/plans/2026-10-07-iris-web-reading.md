# Iris 公开网页读取实现计划

**目标：** 站主聊天可使用现有 research 工具读取网页，回答可进入现有博客预览，发布仍由站主确认。

**架构：** 修改博客固定的上游 toolsets ，保留素材面板 safe 限制；复用现有权限、网页抓取和流式接口，不改 Iris 源码。

**技术栈：** TypeScript、Next.js Route Handler、node:test、真实 Iris API。

- [x] 在 `tests/api.test.ts` 捕获上游聊天 JSON 并断言 research 已开放、客户端 coding/browser 等被忽略、缺省知识库 false。执行相关测试，确认旧实现不满足新预期。
- [x] 修改 `src/lib/api/iris.ts` 固定 toolsets；审查确认素材面板继续 safe，联网资料通过聊天回答转博客。只增加 research，不改变权限或发布流程。
- [x] 运行 `npm test`、`npm run typecheck`、`npm run build`；用 outputs 中隔离脚本经真实博客处理器调用真实 Iris，读取用户 GitHub URL并确认工具事件、回答完成与无博客记录。检查既有 Iris PageFetcher 的内网地址拒绝路径。
- [x] 更新状态、需求和账本，记录实际证据；保留后台服务，不 commit、不部署。
