# 聊天回答完整拟稿实现计划

**目标：** Iris 拟好标题、正文、摘要、分类和标签后才展示博客预览。

**架构：** 复用已有 prepare API，新增受限 sourceReply 输入和定向整理提示；客户端异步调用后复用 Editor。

**技术栈：** Next.js、TypeScript、React、node:test。

- [x] `tests/iris-chat-blog.test.ts` 改为通过 mocked HTTP 验证二次整理请求和完整字段，覆盖异常、取消和 50000 字边界；`tests/iris-blog.test.ts` 验证 sourceReply、空工具组、限制、权限与无记录写入。先执行相关测试看到旧实现失败。
- [x] `src/lib/iris-chat-blog.ts` 改为 `prepareIrisChatBlogDraft(content,type,signal?)`，调用 prepare 并返回服务端候选；不从第一行生成标题。
- [x] `src/lib/api/iris-blog.ts` 验证 sourceReply 并传入提示，聊天拟稿时 toolsets=[]；`src/lib/iris-blog.ts` 定义完整拟稿、清理过程说明和事实边界提示。
- [x] `src/components/iris-chat-blog-publisher.tsx` 改为异步整理，防重入、进度、停止、保留错误与原候选；成功打开预览。
- [x] 运行全套测试、typecheck/build；真实模型隔离二次拟稿和浏览器进度/取消/预览/显式发布验证；更新文档和账本，不修改原 Iris 或正式博客记录，不 commit、不部署。
