# 访客署名与文章评论实现计划

**目标：** 访客只填昵称即可署名，在公开文章与观后感下留言；浏览器记住昵称，站主与留言本人可删除评论。

**架构：** 复用 HttpOnly world-visitor 随机身份，服务端保存昵称与评论，名字不授予站主权限。评论昵称按发表时保存，改昵称不改历史。默认提交后公开显示；私密／草稿文章仅站主读已有留言，关闭访客发表入口。Node 与 D1 使用相同 schema 与写入条件，完整数据库备份自然包含新增表。

**技术栈：** Next.js 16、React、TypeScript、SQLite／D1、现有 CSS、Modal 与 Lucide；不添加依赖。

- [x] 写并运行失败测试：仅昵称持久化、无站主权限、公开文章留言与重启保留、站主标记不可冒充、隐藏草稿／私密／收藏／日常、同源与内容校验、留言删除归属、发表限频、分页与删文关联。
- [x] 新建 comments-schema 与 visitor/comments API；在 Store、CloudStore、runtime、Node／Worker 路由与 D1 构建迁移中接入。
- [x] 新建昵称署名表单／访客状态与文章评论组件；昵称只在评论区填写或修改，评论保持主题、纯文本、失败保留输入，站主与本人可删除。
- [x] 全套测试、类型检查与正式构建；隔离数据实测昵称／评论刷新、改名、删除、桌面和手机，分页及权限由 API／D1 测试验证，保存截图。

**文件职责：** src/lib/comments-schema.ts 管理表与安全插入 SQL；src/lib/api/visitor.ts、comments.ts 校验与访问；src/components/visitor-signature.tsx 署名和昵称状态；article-comments.tsx 留言表单和列表；src/app/visitor-comments.css 主题布局；tests/visitor-comments.test.ts 与 cloudflare.test.ts 验证数据库和访问。

**约定：** 昵称 1–24 字，评论 1–2000 字，列表每页 20 条；新浏览器可以重新署名，浏览器身份不构成实名账号。保留原内容和工作区；不提交、推送或部署。

## 验收记录

- 新增测试先确认 7 项失败，再实现并通过；最终 `npm test` 共 142 项、0 失败，日志 `outputs/visitor-comments-tests.log`。类型检查与 Next 正式构建通过。
- 真实本地 workerd/D1 测试覆盖昵称持久化、公开文章留言、伪造归属删除 403、文章撤回后访客 404、站主删除成功。构建与首次导出同时携带新增表，后续更新沿用幂等结构创建。
- 独立数据目录 `outputs/backup-qa/data`、端口 3002：署名仅填昵称；留言成功并刷新保留；改名后旧署名不变，本人仍可删除；站主回复有专属标记且能删除访客留言。HTML 样式文本按普通文字显示，无注入标签。用户进一步要求只在评论时署名，已移除头部入口，阅读页面不会要求填写。
- 1280×900 和 390×844 评论区实测，手机无横向溢出；浏览器错误日志为空。截图 `outputs/visitor-comments-desktop.png` 与 `outputs/visitor-comments-mobile.png` 为合成测试数据。
- 正式本地 3000 开发服务已重启，新增空表自动创建，未在正式数据中写入验收昵称或留言。
- 最终移除头部署名后重新通过类型检查、142 项测试与正式构建；首页实测无署名按钮或弹窗，文章首次评论直接填写昵称与留言并成功提交，刷新记住昵称。追加截图 `outputs/visitor-comments-first-comment.png`。
