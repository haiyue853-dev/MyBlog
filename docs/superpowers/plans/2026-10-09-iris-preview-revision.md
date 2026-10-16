# Iris 预览改稿实现计划

**目标：** 在当前预览内修改完整博客文字并保护照片，保留一次改稿前版本，确认后才保存。
**架构：** iris-blog-revision 处理输入、图片保护与文字合并；受保护 prepare 接口复用现有上游；IrisBlogRevision 通过 Editor 快照管理请求与恢复，候选编号保持。
**技术栈：** Next.js、React、TypeScript、Markdown AST、Node 测试。

- [x] 在 tests/iris-blog.test.ts 增加实际处理器测试：sourceDraft 权限／互斥／边界、原稿手动编辑字段进入提示、无工具和知识库、保护图片后恢复、遗漏图片拒绝且0记录。新增 tests/iris-blog-revision.test.ts 验证纯函数和文字合并，运行 `npx tsx --test tests/iris-blog-revision.test.ts tests/iris-blog.test.ts` 观察失败。
- [x] 实现 src/lib/iris-blog-revision.ts 与 src/lib/api/iris-blog.ts 分支，保持 sourceReply 和素材旧分支。运行上述相关测试观察通过。
- [x] 实现 src/components/iris-blog-revision.tsx；Editor 提供当前快照，忙碌时禁用保存／上传／关闭；新文字触发 TextEditor 预览。聊天和素材父组件同步候选，不重建编号。增加面板 SSR 入口验证。运行相关测试与 typecheck。
- [x] 用隔离数据和可控本地上游验证当前手动稿、图片、修改成功、停止、失败、恢复、关闭重开、明确发布不重复；真实8000验证虚构素材一次改稿。正式博客不写测试内容。
- [x] 运行 `npm test`、`npm run typecheck`、`npm run build`，完成有界审查，保存截图／结果并更新状态和账本；保留正式3000／8000服务，停止临时服务。不commit/push/部署。
