# 正文图片预览与大小调整实现计划

**目标：** 用户通过图片预览卡片调整每处正文插图的大小和说明，不手改 Markdown。

**架构：** 使用 Markdown AST 的源位置定位插图；宽度保存在既有图片标题字段，兼容 normal/wide。TextEditor 复用插入弹窗，图片卡片独立组件。使用现有 Markdown 解析器包的显式依赖，不引入富文本框架。

**技术栈：** Next.js、React、TypeScript、mdast-util-from-markdown、node:test。

用户已确认设计，授权当前会话实现。现有未提交工作区包含完整编辑器与联调功能，继续在该工作区做有界修改，不创建不含现有功能的 checkout，不 commit、不部署。

- [x] 增加失败测试：百分比宽度往返与渲染；图片 AST 精确位置、重复插图独立修改、代码示例和未附加图片过滤、过期位置拒绝修改；编辑模式卡片。
- [x] `src/lib/article-images.ts` 增加 `articleImageWidth`、`articleImageOccurrences` 与 `updateArticleImage`，扩展 formatArticleImage 和宽度类型；RecordBody/ArticleImage 渲染安全百分比宽度。
- [x] 创建 `src/components/article-image-controls.tsx`：卡片及宽度预览组件。TextEditor 同窗插入/修改，实时预览、宽度滑块、说明，取消不调用 onChange。新增必要样式。
- [x] 运行相关测试和类型检查；修复失败后执行一次只读代码审查。
- [x] 全套测试与 build。隔离网页验证上传、25%/100%预览、已有图片修改、取消、保存后读取、390px无溢出；不修改正式内容。
- [x] 更新状态文档、实施账本、用户截图，关闭临时测试服务，确认正式博客与 Iris 本地服务健康。
