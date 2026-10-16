# 正文插图实现计划

**目标：** 按已批准的方案，从文章已上传照片中选择正文插图，在光标位置插入，支持说明、普通／通栏宽度、预览与点击放大；封面独立设置。

**方案：** 复用附件、Markdown 正文、主题菜单和 Modal，以图片 Markdown 保存说明与宽度，自动跟随已有草稿及备份。正文只加载当前文章已附加的本地图片，沿用附件公开权限。底部图库从真实渲染的正文排除已用照片，无需数据库迁移或新依赖。

- [x] 先写回归：插入不丢文字，说明转义，普通／通栏，附件范围，代码框不误渲染。
- [x] 新建图片格式工具与 ArticleImage 显示／放大组件，RecordBody 只在传入附件时显示配图。
- [x] TextEditor 插图选图、说明、宽度与预览；Editor 传入当前照片，ArticleReader 传入附件并过滤重复图库。
- [x] 类型检查、完整测试、构建；隔离浏览器验证插入、草稿重开、保存／刷新、独立封面、两种宽度、放大／Escape、手机显示与目录定位。

保留既有头部、图库与照片公开权限，正式数据不写测试内容，不提交或部署。

## 验收证据

- 新增 5 项回归，先 4 失败／1 通过，再全部通过；全套 161 项测试、类型检查与生产构建通过。日志：outputs/article-images-red.log、article-images-tests.log、article-images-build.log。
- 隔离 3002 使用合成照片验证段落间插入不丢前后文字，预览普通宽度 560px／通栏 973px；阅读页普通 560px／通栏 706px（右侧有目录）。封面保持原样，底部图库只剩未插入的一张照片。
- 保留草稿并重开、保存后刷新均保留说明与宽度；放大预览的 Escape 只关闭图片，底层编辑继续保留。退出站主后，访客可查看与放大公开图片，无登录 cookie 的图片请求为 200。
- 390px 手机选图和阅读没有横向溢出，目录与共享头部继续正常；浏览器错误为空。截图：outputs/article-image-picker.png、article-images-reader-desktop.png、article-image-picker-mobile.png、article-image-lightbox-mobile.png、article-images-reader-mobile.png。
- 测试文章按 outputs/article-images-fixture-before.json 逐字节恢复，测试账号退出、独立服务停止、临时页面关闭；正式数据未修改，3000 根页面 HTTP 200。
