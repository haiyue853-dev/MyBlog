# 聊天图片与博客配图实现计划

**目标：** 聊天图片可预览放大，显式勾选后带入博客候选，确认后才发布。
**架构：** 独立图片组件管理本地URL和受保护远程URL；图片GET代理按真实字节限制；聊天源快照和选图面板；拟稿成功后下载／压缩上传所选图片，并合入候选。

- [x] tests/iris-chat-photos.test.ts新增失败测试：图片代理的权限／字节／限额／编号；相关请求映射、选图与缓存、正文／日常候选、图片入口。
- [x] src/lib/iris-chat-files.ts和src/lib/api/iris-chat-files.ts增加图片分类、地址、GET代理；iris.ts路由；独立iris-chat-image组件在待发送／消息中预览。
- [x] src/lib/iris-chat-blog.ts选择图导入与候选合并；uploadPhoto可取消；iris-chat-blog-publisher选图与缓存；iris.tsx发送后写实际编号并把最近用户图片传给回答转换。
- [x] 隔离网页验收缩略图／放大／显式选择、停止与失败保留、大小调整与明确发布；正式博客不写测试文章。
- [x] 有界只读审查、全套test／typecheck／build、截图及文档更新，关闭临时服务，保留原服务和工作区。
