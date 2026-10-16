# 我的写作偏好实现计划

**目标：** 私人持久化文章／日常写作偏好，服务端默认应用于拟稿与改稿，明确发布不变。
**架构：** 纯类型／校验／提示词模块，已有settings专用存储方法，iris/blog/preferences私有接口，Iris折叠表单；prepare统一读取对应偏好。

- [x] 新增 tests/iris-writing-preferences.test.ts 失败回归：默认、完整输入／限制、身份／Origin、持久化和失败不覆盖；扩展实际prepare测试覆盖素材／聊天／改稿及普通问答不变。
- [x] 实现 src/lib/iris-writing-preferences.ts；Node/Cloudflare Store专用读取／保存，runtime类型；api/iris-preferences.ts及iris路由，prepare提示注入，相关测试转绿。
- [x] 实现 src/components/iris-writing-preferences.tsx和主题样式，Iris页面接入；UI加载、编辑、保存与错误保留，仅保存后生效。
- [x] 隔离网页保存／刷新／对应类型分开，拟稿／改稿上游偏好验证，确认前0记录；保存截图。正式偏好不修改。
- [x] 有界审查，npm test、npm run typecheck、npm run build，更新状态及账本；关闭临时服务，保留本机服务，不commit/push/部署。

结果：300项测试、类型检查和构建通过。只读审查发现默认偏好包装误触原Iris面经分流，新增回归先失败，再修正固定措辞，复核通过。网页用本地模拟Iris验证请求，不把传参验证当作真实模型文风保证。证据见状态总结及implementation-ledger。
