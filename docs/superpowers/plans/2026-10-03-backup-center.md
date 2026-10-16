# 备份中心实现计划

> 在当前会话使用 executing-plans 内联执行。用户已选定已展示的备份中心方案；沿用当前工作区，不创建提交或发布。

**目标：** 在布置小屋中生成并下载完整备份，能恢复到新的数据目录。

**架构：** Node 专用备份 API + tar/gzip 流式归档 + Store 级 API 请求协调。界面只依赖 JSON 元信息与认证下载链接；备份文件不放入 public。

**技术栈：** Next.js 16.3.8、React、TypeScript、Node SQLite / fs / stream / zlib、node:test。

## 文件职责
- src/lib/backup-access.ts：普通请求并发、备份请求排他、失败释放。
- src/lib/backup-archive.ts：生成标准 tar.gz；读取真实文件，不依赖系统压缩程序。
- src/lib/backups.ts：SQLite 快照、附件复制、元信息与恢复说明、备份历史。
- src/lib/api/backups.ts：站主/同源校验，历史、创建及流式下载。
- src/app/api/[...path]/route.ts：Node 路由与请求协调接入。
- src/lib/http.ts：会话续期保留下载流，避免读取整包。
- src/lib/backup-types.ts、src/components/backup-center.tsx、src/app/backup-center.css：元信息类型和登录后备份界面。
- src/components/owner.tsx、src/app/globals.css：插入入口与引入样式。
- tests/backup-center.test.ts：真实恢复、权限、流式下载、互斥及失败用例。

## 任务 1：备份数据与协调
- [x] 新建测试：创建照片与多图记录、站主、设置；备份并用 tar 解压，通过新 Store 比较完整记录、密码验证和文件字节。初始断言 createBackup 导出存在，验证红灯。
- [x] 新建协调测试：普通请求同时启动，排他请求等待已开始请求完成，后续写入等到排他结束；排他失败也释放。
- [x] 实现 withBackupAccess(store, exclusive, action)、createBackup(store)、listBackups(store) 以及 tar.gz 流式写入。快照使用 await backup(store.db, snapshotPath)。复制已登记附件，缺文件失败；成功后发布压缩包和 metadata，失败回收临时文件。
- [x] 运行 `npx tsx --test tests/backup-center.test.ts`，恢复、协调与失败用例通过。

## 任务 2：接口
- [x] 增加未登录 GET/POST/下载为 401、跨站 POST 为 403、非法/缺失 id 为 404、合法下载字节可解压的测试，确认红灯。
- [x] 实现 backupsApi(request,path,store)；下载使用 Readable.toWeb 流，Content-Disposition 指定 filename、Content-Length 与 private/no-store。
- [x] 路由在请求范围内使用协调门，只有 POST /backups 排他；会话续期构造新 Response 时直接传 response.body。
- [x] 增加会话续期下载不预读流的回归测试；运行新测试和既有认证/API 测试。

## 任务 3：界面
- [x] 添加备份中心，挂载加载历史；按钮使用运行中状态与 ref 防止重复提交；生成成功插入新历史，失败反馈可重试。
- [x] 显示时间、大小、收藏/日记/附件数量，使用已认证 GET 下载链接；添加账号及私密资料保管提示和恢复说明入口说明。
- [x] 引入独立 CSS，手机端按钮与历史列表适配。Cloudflare 不支持该 Node API 时隐藏入口，不调整其服务。

## 任务 4：验收
- [x] 运行 `npm run typecheck`、`npm test`、`npm run build`，全部通过。
- [x] 使用独立测试数据与浏览器，实际创建、下载、刷新历史，检查手机布局与页面错误，保存截图。恢复数据比对在临时目录进行，不覆盖真实资料。
- [x] 更新 README 和计划结果。保留用户服务器和内容；结束临时测试服务。

## 结果
- 全套 106 项测试通过，类型检查及正式构建通过；日志 outputs/backup-center-tests.log。
- 实际下载 tar.gz 并解压，恢复 3 条测试记录、6 个附件及原账号，全部附件字节与来源一致。
- 浏览器验收：生成、下载、刷新历史、手机宽度 390px、无页面错误；截图 outputs/backup-qa/backup-center-desktop.png 与 backup-center-mobile.png。
- 独立审查发现同级备份目录在现有 Docker 中不可写且不持久化，改为 DATA_DIR/backups；只搬迁持久化目录的回归测试先失败后通过。现有挂载和权限即可使用。
- 修复会话续期预读整个下载流的问题，保持流式传输。
- 使用独立测试数据；真实收藏、标签、照片不改动；未提交、推送或部署。
