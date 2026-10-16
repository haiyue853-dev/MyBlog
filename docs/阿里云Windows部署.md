# 阿里云 Windows：博客与 Iris 一起部署

日期：2026-10-06。用户已有 Windows 服务器，ICP 备案仍在进行中。本教程先准备运行环境与内部服务，备案通过后再开放公网网站。

## 两个项目在哪里

本机博客为 `D:\MyBlog`，Iris 源码为 `D:\agent\Iris-agent`。博客没有内嵌 Iris 源码，只调用 Iris API。服务器推荐布局如下；没有 D 盘时统一换成 C 盘，并同步环境文件里的路径。

```text
D:\BlogStack\
  MyBlog\                 博客代码、deploy/windows 部署文件和博客 data
  Iris-agent\             独立 Iris 源码（不需要本机 .env、data 或 .venv）
  iris-runtime\           准备脚本复制的必要 Iris 代码、独立云配置、.venv 和 data
  tools\                  caddy.exe、WinSW 2.x 可执行文件
  services\               三个服务包装器、stack.json、滚动日志
  caddy-data\             HTTPS 证书等持久状态
```

公开访问链路为“浏览器 → Caddy HTTPS → 博客 → Iris”。博客只监听 `127.0.0.1:3000`，Iris 只监听 `127.0.0.1:8000`。访客阅读公开内容；站主登录后才可编辑、管理文件或使用 Iris。没有公众 Iris 账号注册入口。

## 1. 上传项目与安装运行时

通过自己的远程桌面或私有文件传输上传两个项目。博客不要带 `node_modules`、`.next`、本地环境文件、outputs 和测试数据；Iris 不要带 `.venv`、`.env`、data、logs、node_modules 与 web-react 构建产物。服务需要的 Python 包以独立项目的 `requirements.txt` 为准。

服务器安装面向所有用户的 Node.js 24、Python 3.11 或以上（以当前 Iris 依赖能安装为准）。使用 Windows x64 版本。不要依赖只安装在管理员个人用户目录下的运行时，因为服务采用 LocalService 账号。

从 [Caddy 官方下载页](https://caddyserver.com/download) 获取 Windows amd64 的 `caddy.exe`；从 [WinSW 官方发布页](https://github.com/winsw/winsw/releases) 获取 **2.x** 的 `WinSW-x64.exe`，放到 tools。服务文件使用 2.x 配置，不能直接假定 3.x 兼容。Windows 服务运行方式参考 [Caddy 官方说明](https://caddyserver.com/docs/running#windows-service) 和 [WinSW 2.x 配置](https://github.com/winsw/winsw/blob/v2/doc/xmlConfigFile.md)。

在服务器 PowerShell 执行：

```powershell
cd D:\BlogStack\MyBlog
npm ci
npm run build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy\windows\Prepare-Iris.ps1 -IrisSource D:\BlogStack\Iris-agent -IrisRuntime D:\BlogStack\iris-runtime
py -3 -m venv D:\BlogStack\iris-runtime\.venv
& D:\BlogStack\iris-runtime\.venv\Scripts\python.exe -m pip install -r D:\BlogStack\iris-runtime\requirements.txt
```

准备脚本只向空目录复制必要的 Python 代码和独立云配置，拒绝与源码目录相互包含的目标；不改本机 Iris，也不复制其私密环境或历史数据。Python 虚拟环境必须在服务器新建，不能从本机搬运。

## 2. 迁移博客数据，填写私有配置

本机使用已有备份中心导出完整备份，将数据库和附件恢复到服务器 `MyBlog\data`。复制数据库时必须停止写入，不能只复制正在使用的 SQLite 文件。保留原站主账号；生产启动脚本检查账号存在并关闭网页初始化，不能让访客抢建账号。

在服务器创建环境文件，然后用记事本编辑：

```powershell
Copy-Item deploy\windows\blog.env.example .env.windows
Copy-Item deploy\windows\iris.env.example D:\BlogStack\iris-runtime\.env
notepad .env.windows
notepad D:\BlogStack\iris-runtime\.env
```

博客文件填写真实域名、对应的 HTTPS `APP_URL`、数据目录和证书目录；**备案进行中保持 `PUBLIC_SITE_READY=0`**。Iris 文件填写模型 API 密钥、兼容接口地址和模型名称。不要把密钥发到聊天、公开仓库或截图里。环境文件使用每行 `KEY=值`，不加引号、不写行尾注释。

云端 Iris 数据从空目录开始，与本机独立。首次启动会生成模型配置档案并保存在 `iris-runtime\data\settings_profiles.json`；之后改 `.env` 不一定覆盖该档案里的模型设置。若只为换云端密钥或模型，停 Iris 服务后备份并重命名这个档案，启动时会从新环境创建默认档案，已有会话与知识库仍保留。

默认云配置关闭 GPT-SoVITS、QQ／企业微信网关、浏览器回退和本地 Ollama 模型流水线，保留文本聊天、附件读取与关键词知识库。API 调用模型不要求服务器安装 GPU 模型。图片可作为博客配图；需要 Iris 理解图片时，配置真正支持视觉的模型，并在云端 `agent.yaml` 设置 `llm.supports_vision: true`。联网搜索仍需服务器网络可用。

不要直接复制本机整个 Iris data：里面可能有密钥档案、自动任务、消息网关和指向本机模型的运行配置。需要历史数据时另做选择性迁移和验收。博客备份不包含独立 Iris 数据。

## 3. 生成 Windows 服务文件

```powershell
cd D:\BlogStack\MyBlog
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy\windows\New-ServiceFiles.ps1 -IrisRuntime D:\BlogStack\iris-runtime -WinSWExe D:\BlogStack\tools\WinSW-x64.exe -CaddyExe D:\BlogStack\tools\caddy.exe -ServicesDir D:\BlogStack\services
```

脚本记录绝对运行时路径，生成 blog、iris、caddy 三个 WinSW 包装器和 XML。它不安装或启动服务，也不改防火墙。服务以 LocalService 运行，设置开机自启、失败重启和滚动日志。

服务账号需要读写私有数据、日志和证书目录。管理员 PowerShell 中为专用 BlogStack 目录赋权，同时限制普通用户；先确认这确实是自己的专用目录，不要对整块磁盘操作。以下假定目录为 D:\BlogStack、继承的非管理员权限都应移除：

```powershell
icacls D:\BlogStack /inheritance:r
icacls D:\BlogStack /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' '*S-1-5-19:(OI)(CI)M'
```

检查 `.env.windows`、Iris `.env` 及 data 下的密钥档案没有显式授予其他账号权限。子目录已有独立 ACL 时需逐项检查。三个服务共享此专用 LocalService 权限，服务器管理员仍具有管理权；网站登录限制不能隔离被盗的服务器管理员账号。

安装并启动两个内部服务：

```powershell
cd D:\BlogStack\services
.\IrisBlog-iris.exe install
.\IrisBlog-blog.exe install
.\IrisBlog-iris.exe start
.\IrisBlog-blog.exe start
Invoke-RestMethod http://127.0.0.1:8000/api/health
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in @(3000,8000) } | Select-Object LocalAddress,LocalPort
```

两项地址必须为 `127.0.0.1`。普通 `python server.py` 可能监听所有地址，云端使用提供的启动脚本。备案期间不安装／启动 Caddy 公网服务，不开放网站端口；内部服务可通过远程桌面检查健康与日志，完整 HTTPS 登录与发布流程等备案通过后验收。

## 4. 备案通过后开放网站

确认备案结果及网站信息，将真实域名解析到该服务器。修改 `.env.windows` 为 `PUBLIC_SITE_READY=1`。阿里云安全组和 Windows 防火墙只按需开放公网 TCP 80/443；3000、8000、2019 保持内部使用。RDP 3389 限制到自己的管理来源。检查已有 IIS 等是否占用 80/443；有其他站点时先规划入口，不直接停止别人的服务。参考 [阿里云安全组说明](https://www.alibabacloud.com/help/zh/ecs/user-guide/start-using-security-groups)。

管理员 PowerShell：

```powershell
cd D:\BlogStack\services
.\IrisBlog-caddy.exe install
.\IrisBlog-caddy.exe start
Get-Service IrisBlog-*
```

Caddy 申请并维护证书；需要域名解析正确、80/443 可达。公网开关为 0 时启动脚本会拒绝运行 Caddy。启动成功后，打开自己的 HTTPS 域名，验证：匿名不能调用编辑、文件管理、备份和 Iris；登录后能上传素材、整理、预览、确认发布；退出后私人接口失效；服务器重启后服务和已保存内容恢复。

## 更新、停止与备份

更新前生成并下载博客备份，同时私下备份 `iris-runtime\data`、两个环境文件、云端 `agent.yaml`、services 配置和 `caddy-data`。Iris 备份停服务后再复制；两边数据不能互相替代。

```powershell
cd D:\BlogStack\services
.\IrisBlog-blog.exe stop
.\IrisBlog-iris.exe stop
```

博客更新只替换代码，保留 data 与 `.env.windows`，重新 `npm ci` 和 `npm run build`。Iris 更新在停服后将新版 `server.py`、`requirements.txt`、`iris_agent` 包放到运行目录并安装依赖，保留云端配置、`.env` 和 data；使用新目录替换代码包时先检查目标绝对路径，勿删除数据。首次准备脚本拒绝覆盖非空目录，不能当更新命令强制运行。服务包装器路径不变时无需重复安装。

```powershell
cd D:\BlogStack\services
.\IrisBlog-iris.exe start
.\IrisBlog-blog.exe start
```

查看 services 中各服务的滚动日志，以及 `iris-runtime\logs\iris.log`。诊断时只提供脱敏错误；密钥档案、环境文件和完整私人资料不公开。

## 本地验收与服务器验收

本地已在隔离目录使用 Windows PowerShell 5.1 准备运行目录，启动复制后的真实 Iris API，并用本地模拟模型验证附件读取、JSON 流式结果和重启后会话保留。没有改独立 Iris 源码或正式数据。服务 XML 已生成解析；未在本机注册 Windows 服务，未连接阿里云、申请公网证书或调用真实计费模型。实际服务账号权限、证书及公网防火墙按以上步骤在服务器验收。
