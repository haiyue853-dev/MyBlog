# Iris 聊天附件实现计划

**目标：** 博客内普通聊天接受拖入附件，确认发送后上传到当前Iris会话，保留错误重试状态。
**架构：** 纯附件验证／上传函数 + 受保护上传代理 + 独立输入区组件，Iris负责会话与发送状态；原Iris实现只读取接口契约。
**技术栈：** React、Next.js、TypeScript、FormData、Node测试。

- [x] tests/iris-chat-files.test.ts 测试代理身份Origin、multipart内容、格式／大小／会话路径／返回状态和10个附件ID；测试待选文件合并、失败／重试同会话复用、SSR附件入口。先运行观察失败。
- [x] src/lib/iris-chat-files.ts定义10份／20MB、支持格式、待选File及元数据、上传与重试复用；src/lib/api/iris.ts加入仅POST附件转发与attachment_ids校验，保留工具组。运行相关测试。
- [x] src/components/iris-chat-composer.tsx负责拖放与点击、文件名大小、移除及busy状态；iris.tsx负责队列、发送锁、当前会话上传、成功清空失败保留；iris-chat-message.tsx展示附件名。样式使用现有主题。验证纯拖放处理与typecheck。
- [x] 隔离网页验收文件选择、移除、只选附件发送、失败保留、复用重试与切换会话；真实专用Iris8003上传虚构TXT并回答，不写正式博客。
- [x] 有界审查、npm test、npm run typecheck、npm run build、截图与状态文档更新；关闭临时服务，保留正式服务和未提交工作区。
