# 文章分享卡片实现计划

> 当前会话逐任务实现，用户已批准功能；保留当前工作区，无提交或部署。

**目标：** 从公开文章底部复制链接，生成并下载主题分享图。

**架构：** ArticleShare 负责浮层、状态及公开校验；article-share-data 负责纯数据、链接与文字分行；share-poster 按需加载二维码与 Canvas 生成 PNG。

**技术栈：** React、Next.js、原生 Canvas、qrcode。

- [x] 先写并运行分享入口／公开范围及模型回归，确认功能缺失时失败。
- [x] 实现纯分享模型和排版帮助函数，增加 qrcode 与类型定义，完成 PNG 生成。
- [x] 实现底部浮层、复制与回退、预览／下载、关闭及取消；接入文章 footer 和主题 CSS。
- [x] 执行回归、生产构建及类型检查，隔离浏览器检查桌面／手机及原始 PNG 解码。
- [x] 清理测试数据与临时页面，更新功能说明，本地服务可直接刷新使用。

## 验收证据

- 5 项行为回归先失败后通过；全套 190 项通过（outputs/article-share-tests.log），生产构建通过（outputs/article-share-build.log），构建后类型检查通过。
- localhost:3002 独立数据环境验证有封面／无封面长标题、主题浮层、复制成功反馈、原生下载、Escape 返回焦点与点击外侧关闭。浮层改用 portal 与视口定位，桌面下缘可见，390×844 手机无横向溢出，共享头部保留。
- 实际下载两个 1080×1440 PNG，逐一解码二维码，均对应正确规范文章地址；原图见 outputs/article-share-poster.png 与 outputs/article-share-poster-long.png。桌面／手机截图见 outputs/article-share-desktop.png 与 outputs/article-share-mobile.png。
- 生成后撤回公开阻止下载并清除预览；文章更新后要求重新生成。浏览器错误为空。
- 两条测试文章删除后，与验收前原九条记录 JSON 比对完全一致。临时页面、视口与 3002 服务清理，正式 3000 已重启。未提交、推送或部署。
