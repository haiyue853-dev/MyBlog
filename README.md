# My little world · 我的个人小屋

草莓奶油色的个人空间：公开生活碎片与 K-pop 收藏，登录后的私人资料柜，以及 Iris 助手。无访客注册、无示例个人记录。

## 本地运行

需要 Node.js >=22.13（推荐 Node 24 LTS）。

```powershell
cd D:\MyBlog
npm install
npm run setup-owner
npm run dev
```

打开 http://127.0.0.1:3000 。初始化命令会在本地询问密码，不把密码写到配置或日志里；已有账号可以重设密码并撤销所有会话。点击右上角锁图标登录。

登录后可新增/编辑/删除生活和收藏，默认仅自己可见；“布置小屋”可以设置名称、介绍、主题色和头像。记录配图会随公开记录一起公开，头像保存后公开。普通上传文件不自动公开。取消记录公开会同时取消对应图片的公开访问；已被访客保存的图片无法收回。

## Iris

连接当前电脑的 `D:\agent\Iris-agent`：先按 Iris 自己的启动方式启动 API（默认端口 8000）。本网站不自动启动或修改 Iris。

如需调整配置，复制 `.env.example` 为 `.env.local`。网页、脚本均使用同一个 `DATA_DIR`；默认是项目的 `data/`。

```dotenv
APP_URL=http://127.0.0.1:3000
DATA_DIR=./data
IRIS_BASE_URL=http://127.0.0.1:8000
IRIS_API_TOKEN=
```

Iris 支持会话、NDJSON 流式回答、知识库选择和原文下载。资料柜的文件与 Iris 索引是独立的数据：点击文件旁的箭头，选择知识库并确认，才会向 Iris 导入副本。删除资料柜原件不会删除 Iris 副本。Iris 离线不影响资料柜。对话工具限制在 safe / knowledge 集合，复杂的权限确认请用 Iris 原界面。

## 云部署

提供单实例 Docker Compose + Caddy。需要 Linux 云服务器、Docker Compose、已解析到服务器的域名，以及 80/443 端口。首次上线前在本地完成站主账号初始化，防止云上出现可被他人抢注的初始化入口。

1. 在本地初始化站主，把项目和 `data/` 迁移到服务器（依赖和 `.next/` 不必迁移）。`data/` 包含私人文件和账号，不提交到 Git。
2. 创建 `.env`：

```dotenv
SITE_DOMAIN=你的域名
IRIS_BASE_URL=http://host.docker.internal:8000
IRIS_API_TOKEN=
```

3. 确认 `data/` 可被容器中的 node 用户读写。官方 node 镜像的用户 UID 为 1000；例如服务器上使用 `sudo chown -R 1000:1000 data`。
4. 执行 `docker compose up -d --build`，用 HTTPS 域名访问。数据库和文件持久化在服务器 `./data/`。

Iris 在同台服务器上运行时，需允许来自 Docker 网桥的连接，并通过防火墙限制 8000 端口；不要将其直接公开到互联网。使用 Compose 服务运行 Iris 时，可以把 `IRIS_BASE_URL` 改成相应内网地址。Iris 如果仍在家中电脑，需要服务器与电脑之间的私有网络，且电脑必须开机。部署 IIS/Windows 桌面工具等本地能力之前，需要另行检查其云端兼容性。

SQLite 适用于这个单站主、单实例项目。不要给多个应用实例共享同一数据目录。站点通过后端检查权限，文件不放在 public 目录中。

## 备份与恢复

为保证数据库和附件属于同一时刻，备份期间先停止网站写入：本地退出 `npm run dev`，云端运行 `docker compose stop web`。在有 Node 环境的项目目录执行：

```powershell
npm run backup -- D:\MyBlog-backups\2026-10-01
```

备份路径必须位于 `data/` 外，且目标目录尚不存在、父目录已存在。脚本使用 SQLite 在线备份 API 输出一致的数据库，再复制附件；账号和密码哈希也在备份里。

恢复时停止网站，将备份中的 `world.sqlite` 和 `files/` 放入一个新的数据目录，设置 `DATA_DIR` 指向它。不要把新的数据库覆盖到仍有旧 `world.sqlite-wal` / `world.sqlite-shm` 的目录。确认可登录、资料完整后，再启用网站。

可以用服务器定时任务在停止写入的维护窗口执行备份，将副本放到另一台设备或私有对象存储。本项目没有自动创建云账号或上传私人资料。

## 验证

```powershell
npm test
npm run typecheck
npm run build
```

测试覆盖跨站写入、密码、会话、私密条目与文件、公开撤回、删除关联、SQLite 重启、Iris 代理与实际 content 流式协议。Iris 代理测试使用本地模拟服务，不调用模型或计费接口。Node 22 的内置 SQLite 会输出实验性 API 提示；Node 24 是推荐部署运行时。
