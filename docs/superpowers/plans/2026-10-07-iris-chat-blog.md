# Iris 聊天回答转博客实现计划

> 当前会话使用 executing-plans 内联实现，沿用已有用户授权，保留未提交工作区。

**目标：** 聊天回答可选择记录方式，预览后由站主确认发布。

**架构：** 纯函数生成本地候选，小组件选择类型并复用 Editor。现有写作面板和服务端权限保持原有接口。

**技术栈：** Next.js、React、TypeScript、node:test。

- [x] 测试：`tests/iris-chat-blog.test.ts` 验证正文保真、article/moment、拒绝空或过长内容和暂存隔离；`tests/iris-chat.test.ts` 验证入口只出现在完整 assistant 回复。先执行 `npx tsx --test tests/iris-chat*.test.ts` 看到缺失功能失败。
- [x] 实现：`src/lib/iris-chat-blog.ts` 导出 `createIrisChatBlogDraft(content,type)`，使用 UUID 和 ISO 日期生成 draft Item。原文不改写；标题前 40 字，正文最多 50000 字。`iris-blog-workspace.ts` 的读写增加可选 key，默认键不变。
- [x] 交互：`src/components/iris-chat-blog-publisher.tsx` 展示类型 Modal、Editor、重新预览和真实保存结果；独立 key 暂存候选。`iris-chat-message.tsx` 增加 `onPrepareBlog`，根据 role/content/error/waiting 限制按钮；`iris.tsx` 传回调及 onSaved。
- [x] 验证：`npm test`、`npm run typecheck`、`npm run build`；隔离测试数据库浏览器操作两种类型、预览不写入、确认发布和保存草稿、刷新候选恢复。证据写入 outputs，不碰正式博客数据。
- [x] 记录：更新需求、项目状态、实现账本，保留未提交改动，不自动 commit 或部署。
