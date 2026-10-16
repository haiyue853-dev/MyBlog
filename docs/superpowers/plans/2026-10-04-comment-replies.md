# 站主回复留言实现计划

**目标：** 从留言管理直接回复，并在原留言下公开显示；支持修改、确认删除和持久化。

**架构：** 新增 comment_replies 关联表，复用现有 comments API 增加 PUT／DELETE replies 子路径。共享客户端组件提供纯文字回复和行内表单。

**技术栈：** Next.js 16.3、React、SQLite／D1、现有主题 CSS；无新增依赖。

- [x] 在 `tests/comment-replies.test.ts` 编写并运行失败回归：权限、CRUD、署名时间保留、私密隔离、计数和分页不变、关联删除及重启保存。
- [x] 修改 `src/lib/comments-schema.ts`、`types.ts`、`store.ts`、`runtime.ts` 与 `cloudflare/store.ts`：批量读回复与受关联约束的写删方法。
- [x] 修改 `src/lib/api/comments.ts` 及两端分发，将回复加入公开／管理列表；`PUT comments/<item>/<comment>/reply` 校验 body 并标已读，DELETE 只删回复。
- [x] 修改 `scripts/export-cloudflare.ts` 与 `tests/cloudflare.test.ts`：迁移保存回复，验证 D1 权限、显示和删除。
- [x] 创建 `src/components/comment-reply.tsx` 及主题 CSS；在 `comment-manager.tsx` 和 `article-comments.tsx` 接入。保存失败保留输入，删除及放弃修改均确认。
- [x] 运行 `npm test`、`npm run build`，随后 `npm run typecheck`。在独立验收环境验证回复、编辑、取消、删除确认、访客展示和窄屏。恢复验收记录，保留正式服务。

用户已授权在当前任务执行。采用内联实现；保留当前工作区已有改动，不提交或部署。

## 完成验证

- 四项新增接口回归先失败后通过，另增加完整 tar.gz 备份恢复回归。全套 178 项测试通过；生产构建及随后类型检查通过。D1 集成验证回复迁移、访客写删拒绝、公开显示、修改保留首次时间及关联清理。
- 隔离浏览器实测管理列表回复、自动已读、修改、刷新持久化、未保存确认及继续／放弃、删除确认与取消、原留言关联删除提醒、文章内嵌套展示、私密文章回复和访客无编辑／删除按钮。
- 人为让验收会话失效，保存返回 401，输入保留；重新登录后可正常重试。最终验收标签未出现浏览器错误。
- 390px 手机访客展示和管理回复编辑实测，文档 scrollWidth 与 clientWidth 均为 378，无横向溢出，编辑输入和按钮正常。
- 截图：`outputs/comment-reply-management.png`、`outputs/comment-reply-article.png`、`outputs/comment-reply-guest.png`、`outputs/comment-reply-delete.png`、`outputs/comment-reply-mobile-guest.png`、`outputs/comment-reply-mobile-editor.png`。日志：`outputs/replies-tests.log`、`outputs/replies-build.log`。
- 验收留言、回复与已读状态清理后与原快照比对一致；退出测试账号、关闭临时页面及 3002 服务，正式 3000 已重启使用新数据库表；正式记录和附件未改写，未提交或部署。
