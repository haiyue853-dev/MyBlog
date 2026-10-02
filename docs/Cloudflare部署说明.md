# 完整小屋部署到 Cloudflare

这个包包含网页和后端，支持原密码登录、生活/收藏编辑、头像裁剪、文件上传和私人资料柜。Iris 没有部署，之后再接入。

**完整包需要通过 Workers 部署，不能直接拖进 Cloudflare Drop。** Drop 只接收静态网页；Cloudflare 免费的后端服务叫 Workers。

## 本次发布状态（2026-10-02）

- 已按用户选择部署到当前登录账号，并将应用名缩短为 `home`。当前网站地址：[打开小屋](https://home.yuehaiworld.workers.dev/)。Cloudflare API 已确认账号子域名为 `yuehaiworld`，免费入口启用；此前的旧账号子域名和长应用名地址已经变化。账号和原密码校验值、1 条记录、1 个头像附件已经迁移。Cloudflare 控制面确认版本 `c259ef19-885e-490d-95f8-48f43c616d21` 已承接 100% 流量。
- 已读取云端 D1 确认账号/记录/文件数量，并从 R2 下载头像与原件比对 SHA-256 完全一致；R2 的 `r2.dev` 公共访问仍关闭。
- 当前网络直连 `workers.dev` 的 DNS 结果异常，连接超时或重置；电脑原有系统代理已经启用。此前直连检查未使用该代理。本轮通过现有代理请求当前有效网址，主页及 API 返回 200，实际云端登录、HttpOnly/Secure Cookie、私人记录创建/编辑、跨来源写入拒绝、64 B 与 20 MiB 文件上传/下载、退出后私人授权撤销均通过；私人文件匿名读取返回 401，迁移 SQL 与配置文件公开访问返回 404。专用验收记录/文件和登录会话已清理，D1 恢复到账号/记录/文件各 1、会话 0。没有改动系统 DNS、代理规则、关闭 TLS 校验或升级付费套餐。
- 免费子域名已自动分配，无需领取。进入 Cloudflare 控制台 **Workers & Pages → home → Domains** 查看；账号子域名在 **Workers & Pages → Your subdomain → Change** 修改。免费地址格式是 `应用名.账号子域名.workers.dev`，无法完全省略应用名。修改地址不会保证当前网络可访问。用户已选择先保留免费地址，暂不绑定独立域名。[官方子域名说明](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- 本包保存当前账号下的实际资源编号与续跑状态。原账号的空 D1 未删除；旧配置备份留在本机 `.test-data/cloudflare-original-account-config.json`，不包含在本包内。

## 开始部署

1. 注册或登录 Cloudflare。进入“Storage & databases → R2”，开通 R2，阅读其结算页面；可能需要提供付款方式。保持 Workers Free，无需主动升级付费套餐。
2. 将 ZIP 解压到本机的一个文件夹。不要只在压缩软件里打开文件，也不要把整个包上传到公开仓库。
3. 电脑安装 Node.js 22.16 或更新版本，安装时保留 npm。项目所在电脑已有 Node，可以直接继续。
4. 双击包内 `deploy.cmd`，或在该文件夹打开终端运行 `node deploy.mjs`。首次运行会下载固定版本 Wrangler，并打开浏览器让你登录、授权 Cloudflare；多个账号时选择自己的部署账号。
5. 脚本创建 D1 和私有 R2、导入当前账号/内容/文件，最后发布并显示 `workers.dev` 地址。打开该地址，用原来的密码登录。

部署脚本不会升级 Workers 套餐，不会开放 R2 公共访问，不会在网页中暴露迁移 SQL。重跑会沿用该文件夹里的配置与进度；发现已有站主时保留云端数据。**之后更新代码也应保留这个已部署文件夹的配置和 `.cloudflare-state.json`，不要当成新站重新创建。**

## 费用和域名

截至 2026-10-02，官方免费额度：

- Workers：后端每天 100,000 次请求，每请求 10 ms CPU；静态资源请求免费。免费档超限可能拒绝请求。付费 Workers 最低 5 美元/月，本脚本不切换套餐。
- D1：每天读取 500 万行、写入 10 万行；账户总存储 5 GB，免费单个数据库最大 500 MB。小屋的文字与元数据放在 D1。
- R2 Standard：每月 10 GB-month 存储、100 万次 A 类操作、1,000 万次 B 类操作免费，出口流量免费；超过免费用量会收费，额度与账号里的其他项目共享。此版本限制资料柜原件总计 8 GiB，单文件仍为 20 MiB；操作次数和账号其他用量仍需查看账单。
- 网站获得免费的 `workers.dev` 子域名，独立的 `.com` 等域名仍需另行购买。默认域名的大陆访问质量请实际测试。

来源：[Drop](https://www.cloudflare.com/drop/)、[Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/)、[D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)、[D1 限制](https://developers.cloudflare.com/d1/platform/limits/)、[R2 定价](https://developers.cloudflare.com/r2/pricing/)、[R2 开通](https://developers.cloudflare.com/r2/get-started/)。

## 数据与登录

`public/` 是唯一发布为网页资源的目录。`private-import/` 是私有迁移资料，包括记录、账号校验值和文件原件，只由部署脚本导入 D1/R2。不要把整个包分享给别人；旧设备的会话不迁移，云端首次要重新登录。

密码仍使用原有 scrypt 参数，浏览器计算后通过 HTTPS 发送登录密钥，服务器保存的是该密钥的 SHA-256 校验值；数据库里的值不能直接用来登录。密钥不写入本地存储。不要降低密码强度来适应 CPU 限制。

本地 Workers 运行时验证不能替代真实云端额度验收。发布后检查：登录、头像裁剪保存、记录编辑、公开/私密切换、文件上传下载、退出后私人文件不可读；尤其试一次较大文件上传，并在 Workers 日志查看是否出现 CPU 超限（1102）。免费档不能保证所有上传大小和设备访问都稳定。发生超限时先保留错误提示，再决定调整上传流程或选套餐。

**备份：** 本机原始 `data/` 保留不变。云端开始产生新内容后，需另行导出 D1 并下载私有 R2 原件；这个初始 ZIP 不包含未来的云端内容。D1 免费 Time Travel 可回溯 7 天，不能替代文件原件备份。
