# Windows 博客与 Iris 部署实现计划

> 在当前会话内联执行，沿用用户“开始”的授权。只增加部署材料，不修改独立 Iris 仓库，不提交、推送或操作云服务器。

目标：将分离的博客和 Iris 准备为同一台 Windows 服务器上的三个后台服务。

- [x] 添加 deploy/windows/Prepare-Iris.ps1：先验证源、目标隔离与空目标，再复制必要源文件和独立云配置。
- [x] 添加云端 agent.yaml 与 start-iris.py：验证模型环境和配置文件，首次创建关闭本机模型流水线的 runtime.json，已有文件保持。
- [x] 添加环境样例、Run-Service.ps1、Caddyfile 和 New-ServiceFiles.ps1：三个进程、仅回环应用端口、WinSW LocalService、自启重启和滚动日志。生成文件不安装服务。
- [x] 在 outputs 保存隔离验收脚本和日志：观察缺文件、缺密钥、危险目录及非空目标被拒绝；准备后真实 Iris 健康/附件/重启持久化；解析脚本和 XML。
- [x] 写 docs/阿里云Windows部署.md 的上传、运行时、数据迁移、证书、防火墙、服务安装更新备份步骤；更新 README、状态和账本。

验证命令由 outputs 验收脚本执行。仅修改部署材料，不重复构建前端。安装 Windows 服务和访问云实例必须在用户服务器上进行。

用户追加要求严格限制所有编辑权限，因此必要范围增加 src/lib/api/files.ts 的写入前置授权与 tests/api.test.ts 的 92 次拒绝矩阵，并据此重新运行完整 247 项测试、类型检查与生产构建。最终 Python 4 项部署测试与隔离真实 Iris QA 通过；复审指出的 WinSW v2 账号字段已修复并验证。最新日志见 outputs/windows-iris-runtime-qa.log、outputs/windows-deployment-python.log；本地服务保留原 3000，测试 8000 已停止。
