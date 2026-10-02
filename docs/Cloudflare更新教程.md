# 已部署的小屋：后续更新怎么上传

网站：https://home.yuehaiworld.workers.dev/ 。项目在 `D:\MyBlog`，已部署包在 `D:\MyBlog\outputs\MyBlog-Cloudflare-Full-20261002`。

**这是以后更新现有网站的教程，不是首次部署。无需把整个项目文件夹打包，也不用拖 ZIP 到 Cloudflare Drop。** 小屋有登录、数据库和文件上传，更新由本机 Wrangler 上传到已有 Worker。

以后修改代码并在本地看好后，在项目目录依次执行以下命令；任一步报错就先解决，不继续发布：

```powershell
cd D:\MyBlog
npm run typecheck
npm test
npm run update:cloudflare -- --deploy
```

最后一条命令会自动编译网页和后端、为既有 D1 创建缺失的表和触发器，再上传到应用 `home`。发布后仍然访问上面的同一网址，线上账号、密码、已有收藏和文件都会保留。

## 改代码：先本地看，再发布

打开 PowerShell，运行：

```powershell
cd D:\MyBlog
npm run dev
```

打开 http://127.0.0.1:3000/ 查看，修改源代码后开发页面会自动更新。若 3000 已有正式预览在运行，需要先在它的终端按 Ctrl+C；不要同时占用同一个端口。看完在终端按 Ctrl+C 停止开发服务。

确认代码效果后，先检查：

```powershell
npm run typecheck
npm test
```

然后发布：

```powershell
npm run update:cloudflare -- --deploy
```

这个命令重新编译当前代码，更新既有部署包里的网页、Worker 和建表 SQL，再调用 Wrangler 执行幂等建表并发布。末尾显示网址和版本编号即表示发布成功。打开线上网址并刷新查看；看到旧样式时可以按 Ctrl+F5。

如果只想编译、不上传，运行 `npm run update:cloudflare`。如部署包搬到了别的位置，可运行 `npm run update:cloudflare -- "新部署包目录" --deploy`。

## 登录与账号

Wrangler 授权过期时，在项目终端运行 `npx wrangler login`，浏览器登录原 Cloudflare 账号并点击 Allow。云端部署账号要与部署包的 `account_id` 一致。

更新命令保留应用名 `home`、账号、D1/R2 绑定、`.cloudflare-state.json` 和私有迁移资料，不重建网站、不导入本地数据库、不修改密码或云端内容。不要用新生成的初始化包替换已部署目录的配置。

## 改内容：与改代码不同

- 在线上登录后新增、编辑收藏，保存时就写进云端，无需重新发布。
- 在本地新增收藏，只写本机数据库；发布代码不会自动上传这些记录和图片。确认本地效果后，需要单独同步这批新增内容。
- 2026-10-02，已按本人要求把这批 172 张人物收藏单独同步到线上（Jennie 117、Jisoo 36、Karina 10、ROSÉ 9）；3 张 HEIC 使用 JPEG 副本，原素材不变。本次只增加对应记录和附件，原账号、头像、设置与已有登录会话保留。以后再在本地加照片，仍需单独同步；代码发布不会自动上传新内容。不要把整个本地数据库覆盖到云端。
- 此次每日点赞所需的新表和触发器已包含在更新命令中。以后涉及其他新字段或数据格式变动时，需要先准备相应迁移，不能仅凭重新编译就假定数据库已兼容。

## 是否要手动打包

不需要。`npm run update:cloudflare -- --deploy` 会从当前源码生成网页资源和 Worker，通过已授权的 Cloudflare 账号直接上传。你保留项目及已有部署目录即可；不要重新运行首次部署的 `deploy.cmd`，也不要用 `export:cloudflare` 把本地数据库重新导入线上。只有要迁移到另一台电脑时才需要另行准备文件和授权。

## 网络和备份

本机直连 `workers.dev` 曾解析异常；通过已启用的代理实际访问成功。浏览器打不开时，先确认使用当前网址和既有代理。更新命令不修改电脑的 DNS 或代理规则。

### 手机打不开线上网址

2026-10-02 已核对 Cloudflare API：`home.yuehaiworld.workers.dev` 的公开入口开启；本机直连超时，既有代理访问 HTTPS 返回 200。用户确认手机关闭加速器时 Wi-Fi、移动数据都打不开，开启加速器可访问。下一步可尝试自有域名，但不能保证改善；用户目前决定先不处理。电脑的本机代理不会自动应用到手机。

1. 手机用系统浏览器打开完整地址 `https://home.yuehaiworld.workers.dev/`；分别切换 Wi-Fi 和移动数据试一次，确认是否仅某条网络失败。
2. 如手机已有加速器，开启连接；软件支持“全局模式”时可临时用它测试，避免分流规则将该网址走直连。正常打开后，再按软件规则将 `home.yuehaiworld.workers.dev` 或 `workers.dev` 指向代理。具体菜单取决于手机系统和软件。
3. 若希望手机不开加速器也能访问，下一步可准备自有域名并绑定已有 Worker；绑定后仍需分别测试手机 Wi-Fi 和移动数据，不能保证所有网络可达。

自定义域名设置：先把自己的域名接入 Cloudflare 并使站点状态 Active，再到 **Workers & Pages → home → Settings → Domains & Routes → Add → Custom Domain** 输入域名。Cloudflare 会创建对应 DNS 记录和证书；同时把部署包 `wrangler.jsonc` 的 `routes` 保存为该域名的 `custom_domain: true`，供以后更新沿用。没有域名时不能随意填写他人的域名。详见 [Cloudflare 官方设置步骤](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

当前只做访问诊断和说明，没有购买域名、变更域名绑定或手机网络设置。

`data/` 是本机内容，云端 D1/R2 是另一份内容。重要线上内容需单独导出 D1 并下载 R2 文件；本机初始 ZIP 不包含之后新增的云端记录。不要分享含 `private-import/` 的完整部署包。

本次上传前的云端备份保存在 `D:\MyBlog\backups\cloudflare-before-photos-20261002`；含私人账号验证值和会话资料，保留在本机。172 张线上图片和每日点赞的验收结果见 `outputs/cloudflare-photos-live-check-20261002.json`，账号和原头像保留检查见 `outputs/cloudflare-photo-sync-20261002.json`。
