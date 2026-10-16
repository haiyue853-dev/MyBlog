# Iris Blog Assistant Implementation Plan

> **For agentic workers:** Execute inline using the confirmed design and test-driven-development. Keep all writes in D:\MyBlog; preserve existing uncommitted work.

**Goal:** 在博客内发送素材给 Iris，预览、编辑并由站主确认发布。

**Architecture:** 博客增加生成接口，使用 Iris 现有会话、附件及流式聊天协议。生成仅返回校验后的候选内容；发布通过现有编辑器与 items API。

**Tech Stack:** Next.js 16.3.8、React 19.3、TypeScript、Node tests / tsx。

**Spec:** docs/superpowers/specs/2026-10-06-iris-blog-assistant-design.md

## Constraints and review focus

- 不修改独立 Iris 源码，不新增依赖，不部署或写入正式个人内容。
- 新接口要求站主和同源；模型结果无法选择发布状态、可见范围或文件身份。
- 格式错误、取消、上传失败和离线均不得发布；图片及文档在确认前保持私有。
- 生成预览和正式新文章各有独立草稿键，重试创建不会重复。
- 普通聊天与原编辑器不变，手机布局可用，保存后显示真实结果。

## Tasks

- [x] Task 1：tests/iris-blog.test.ts 先验证 Node 路由无副作用生成、附件、流式结果校验、拒绝与失败；src/lib/iris-blog.ts 校验内容，src/lib/api/iris-blog.ts 调用现有 Iris，iris.ts 增加 blog/prepare 分支。观察失败后实现并通过。
- [x] Task 2：组件回归先验证助手预览与 Editor 预填；src/components/iris-blog-assistant.tsx、iris-blog-preview.tsx 负责素材、取消、预览与保存反馈；Editor 支持助手初始数据与稳定创建编号；Iris 页面接入，Space 保存后刷新。观察失败后实现并通过。
- [x] Task 3：全套 npm test、typecheck、build；隔离数据的生成到确认保存验收；更新需求、状态与实现记录，报告实际链路边界。

复审修正：开放 safe/read_attachment，工具轮次开始时排除解释文字；新增 iris-blog-workspace.ts 恢复候选及编辑草稿入口；editor-save.ts 按稳定请求 ID 找回条目并更新当前确认内容，覆盖正文、公开范围、草稿与换封面的失败重试。

## 用户补充：生成后自动弹出预览

- [x] 在 tests/iris-blog-ui.test.ts 验证助手编辑器初始显示正文预览、可返回编辑，普通编辑器不受影响；先观察失败。
- [x] iris-blog-assistant.tsx 在成功且未取消的生成后打开 Editor；text-editor.tsx 增加可选 initialPreview，Editor 仅为助手启用。已有保存与权限逻辑保持。
- [x] 运行助手与权限相关测试、类型检查、构建；用隔离数据库浏览器验收自动弹窗、关闭重开、编辑、点击发布及草稿保存，更新状态记录。不写入正式博客内容，不修改 Iris 源码。

验证结果：18 项相关测试通过，类型检查和生产构建通过。隔离生产网页使用模拟 Iris，生成后自动打开窗口，关闭重开保留候选，正文预览／编辑切换，确认发布保存修改后的标题与正文，保存草稿不增加访客可见数量。证据 outputs/iris-popup-qa-20261006/result.jsonl、preview.png 与 outputs/iris-popup-{tests,typecheck,build}.log。
