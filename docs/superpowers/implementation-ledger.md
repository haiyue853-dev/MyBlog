# 执行记录 — plan: docs/superpowers/plans/2026-10-01-personal-space.md

## 2026-10-07 正文图片预览与大小调整

- 用户确认设计后实现图片卡片、插入／修改实时预览、25%～100%宽度滑块及说明修改。范围限定正文图片，保留 Markdown 文字编辑、旧normal/wide、权限与确认保存。
- `mdast-util-from-markdown` 已由当前 Markdown 渲染依赖安装，本次显式声明同一版本2.0.3，使用 AST 源位置识别每处图片，安全更新单一插入位置；排除代码与不属于当前文章的图片。
- 先观察4项新增测试失败再实现。独立只读审查发现重复引用定义last-wins与正文first-wins冲突，新增失败回归后改为递归收集、首次定义优先，补充引用块覆盖。
- 最终267项测试通过，typecheck/build成功。日志 outputs/article-image-controls-{all-tests,typecheck,build}.log；回归失败证据 outputs/article-image-controls-reference-red.log。
- 隔离浏览器实测上传和25%／100%预览确实改变尺寸；50%插入后调整55%及说明，取消原文保留；保存后数据库与文章55%一致。390px窗口滚动宽度不超出控件，正文插图没有重复进入“照片手记”。证据 outputs/article-image-controls-ui-qa-20261007/result.json、size-preview.png、mobile.png。
- 用户询问底部照片手记含义，已说明仅显示未放入正文且非封面的附加照片，本轮没有删除该功能。只保存隔离测试文章，不改正式数据库、原Iris源码或公网配置，不commit/push。关闭临时3002服务，保留正式本地服务。

## 2026-10-07 聊天回答完整拟稿

- 用户截图显示过程说明被当作标题、整条回答被搬进正文。按已授权目标，仅在博客侧加入 Iris 二次整理，拟定标题、正文、分类、标签和摘要，再进入原 Editor。
- 复用 prepare API，sourceReply 限制为 50000 字，不与附件混用；身份和来源校验保持。聊天拟稿不启用工具或知识库，不自动写入内容，不以原文生成备用标题。
- 客户端增加进度、停止和防重入；只在成功时替换候选，取消与失败保留原回答和之前预览。
- 先观察旧实现测试失败再实现；只读代码审查发现固定动作词误触上游面经模式，新增失败回归后改为“读取失败”。相关测试及全套 262 项通过，typecheck/build 成功。构建最初因临时 standalone 服务占用目录失败，停止该隔离服务后重跑成功。
- 真实 mimo-v2.5 生成文章及日常的完整字段，标题与正文不含示例过程说明，预览阶段隔离库 0 条记录。网页模拟上游验证字段、等待、取消、失败保留；确认发布后隔离库 1 篇文章。证据 outputs/iris-editorial-live-smoke.log、outputs/iris-editorial-ui-qa-20261007/result.jsonl 与 preview.png。
- 上游已知边界保留：原素材含面经词、收集动作和 URL 时仍可能触发 Iris 原分流；失败显示错误并保留候选。未修改原 Iris 源码；未更改正式博客记录、开公网、部署、commit 或 push。

- 用户已确认视觉设计并授权继续实现，不重复请求开发许可。
- Ruling: 空目录且无既有 Git 仓库，在 D:/MyBlog 建立功能分支；无共享分支需要隔离，不创建额外 worktree。
- Ruling: 在当前会话连续执行；Windows 环境直接记录任务和验证结果，不运行面向 bash 的任务记录脚本。
- 接口检查：站主账号→会话→条目/文件/Iris 授权；条目公开引用→文件读取权限；本地附件→显式 Iris 导入。私人文件不进入公开构建输出。

## 任务结果

1. 基础与安全核心完成。密码 scrypt、服务端会话、Origin 校验、安全外链、私密附件授权和栅格图片识别均有测试；先观察缺失接口的断言失败再实现。
2. SQLite 与同源 API 完成。条目可见性、重开数据库、撤回公开、关联附件删除保护、会话撤销、Iris 登录保护均通过测试。附件保存在数据目录，不进入静态 public。
3. 页面完成。公开首页、生活、收藏；登录后资料柜、默认私密编辑、资料筛选、头像和站点布置；响应式布局、唱片与漂浮动效、动效开关。没有创建假的个人内容。
4. Iris 接口完成。对照 D:/agent/Iris-agent 的接口与事件字段，支持会话、知识库选择、流式回答、原文下载和显式文件导入。模拟 upstream 验证协议，真实服务已读健康状态、会话和知识库；未发送模型问答或修改 Iris 资料。
5. 部署与交付完成。Docker Compose + Caddy、私有数据挂载、本地账号初始化、备份与恢复说明和 standalone 启动器已交付。Docker 未安装，云服务器部署和 HTTPS 签证书未实测。

## 一次最终审查及修复

- 完成一次独立只读代码审查，修复后没有开启重复审查循环。
- 手机端 Iris 侧栏隐藏导致“新对话”和历史入口消失：360px 浏览器断言先失败，修复为紧凑可滚动侧栏后通过，历史可见且新对话可点击。
- Node 最低版本改为 22.16，与 SQLite backup API 匹配；推荐部署 Node 24。
- 云恢复原先只写 DATA_DIR，而 Compose 挂载固定：增加 HOST_DATA_DIR 宿主路径配置，文档区分本地与容器恢复，并明确容器重建与目录权限。
- Ruling: 将默认备份命令无法创建父目录由 Minor 升为 Important，因为这会直接阻断文档承诺的默认备份；先新增失败测试，再创建父目录，目标目录仍独占创建，禁止覆盖旧备份。
- Minor deferred: Iris 原文下载使用统一文件名；导入后的后台索引状态没有轮询；极长文件名可能被 Iris 标题长度校验拒绝。当前界面会显示 upstream 错误，这些不阻断文件保存与已有知识库使用。

## 最终验证证据

- `npm test`：18/18 通过，含未登录上传拒绝、Iris 离线 503 与资料柜独立可用、账号/私密记录/附件备份后恢复且禁止覆盖。
- `npm run typecheck`：退出 0。
- `npm run build`：退出 0，优化构建成功；`npm run start -- --port 3000` 启动 standalone 成功，正式数据仍为空且站主未初始化。
- 浏览器使用独立 `.test-data/browser`：登录、生活新增/编辑、公开切换、收藏新增/删除、上传、登出后的私人条目不可见、动效关闭均验收。360px 检查页面内容宽度 345px，无水平溢出；Iris 新对话和历史入口可用。
- 恢复默认视口；打开 `http://127.0.0.1:3000`，确认正式首页没有测试条目；保存实际截图 `outputs/home-desktop.png`。测试服务 3101 已停止，正式预览 3000 保留运行。
- Node 22 内置 SQLite 有 ExperimentalWarning；未影响测试和构建。未验证用户实际密码初始化、真实模型生成或云端 Docker 运行，不作完成声明。
- 项目没有远程仓库或基础分支，保留本地 `feat/personal-space` 及工作目录，无合并/推送/清理动作。

## 后续：鼠标音符拖尾

- 用户明确要求参考站的鼠标音符效果，沿用已批准的柔粉暖色视觉；范围限于全页鼠标移动装饰。
- `CursorNotes` 独立组件，在鼠标旁生成 ♪ / ♫ / ♬，1.25 秒漂浮淡出并移除；每 65ms 最多一个、移动至少 12px、最多 18 个。装饰层不接收点击、不进入无障碍树。
- 复用站点动效开关。禁用、离开窗口、隐藏页面、卸载和媒体偏好变化时清空；触摸事件、无精细指针和减少动态效果模式不生成音符。没有新依赖和后台请求。
- 浏览器先断言原版移动后存在音符失败，再验证新版音符出现、自动清理、关闭后清空、刷新后保持关闭，以及导航点击正常；浏览器错误日志为空。截图保存在 `outputs/cursor-notes.png`；临时桌面视口已恢复。
- `npm run typecheck`、`npm run build` 均退出 0。装饰样式使用实际浏览器验证，没有添加镜像实现的样式单元测试。

## 后续：半透明悬浮导航

- 用户要求参考站的顶部透明材质、滚动跟随和 hover 效果；仅调整导航相关样式。
- 顶栏改为 sticky；三个导航胶囊使用 64% 不透明度的暖白、16px 背景模糊、细高光边框与柔和阴影，下方颜色随滚动透出。无 backdrop-filter 支持时采用更实的背景保证文字可读。
- 导航悬停有主题色高亮、微浮起和图标轻微摆动；动效关闭或减少动态效果时取消位移与旋转。调整滚动目标的顶端留白，桌面 120px、移动布局 170px。
- 浏览器原版 position=relative 的跟随断言失败；新版 sticky、64% 透明度和 blur(16px) 验证通过。实际悬停截图显示粉色高亮；滚动截图确认导航留在顶部并透出卡片背景，见 `outputs/glass-header-scroll.png`。
- 360px 实际浏览器检查导航、搜索及点击可用，无横向溢出；临时视口已恢复，网页保留给用户。`npm run build` 退出 0，含 TypeScript 检查；浏览器错误日志为空。

## 后续修复：普通浏览器音符与导航融合

- 排查确认旧音符代码和 CSS 均无条件禁止 reduced-motion，网站按钮仍可能显示“关闭动效”，两者状态冲突。读取 Windows MinAnimate=0，提示系统动画关闭；只能连接内置浏览器，未直接检查用户的外部浏览器媒体偏好，因此系统设置作为很可能的触发原因，不断言唯一原因。
- 动效默认值跟随系统，用户明确的 on/off 网站选择优先；CSS reduced-motion 约束仅在未主动开启时生效。鼠标事件不再额外受 any-pointer 媒体查询拒绝；localStorage 读写失败不会阻断网站开关。设置在系统偏好变化和其他同源窗口设置变化时同步。
- 3 项动效策略测试先失败再通过，覆盖系统默认、主动开启覆盖系统减少动画、主动关闭不被覆盖。全套 `npm test` 21/21，`npm run typecheck` 和 `npm run build` 退出 0。
- 导航下滑超过 48px 合并为共用磨砂背景，回顶部恢复三个胶囊，保留现有尺寸避免跳动。ScrollHeader 独立维护滚动状态，passive + requestAnimationFrame 处理，卸载清理。
- 浏览器原版缺少 data-joined 的断言失败；新版顶部=false、滚动=true，截图 `outputs/joined-header.png` 确认左中右连成一条。手机 360px 合并、导航点击与搜索可用、内容宽度 345px。
- 浏览器验证音符开启出现、关闭清空、刷新后关闭记忆保持，恢复开启后继续可用；错误日志为空。恢复原视口和主页，正式预览运行在 3000；未改动 Windows 系统设置。

## 后续修复：头部右边缘延展

- 用户确认音符已经可用，需按花朵按钮开启；本次保留动效偏好逻辑。音符降低为每 220ms、移动至少 28px 生成一个，同时最多 5 个；实际十次鼠标移动检查产生 4 个。
- 用户明确要求左侧块保持位置，由右边缘向右延展连上导航。删除整条背景的透明度与缩放切换，改为单一磨砂层，通过可插值的三个圆角路径裁剪；只扩展左侧路径，导航和工具的路径固定，避免多个模糊层交接时的亮度变化。
- 合并阈值为滚动超过 20px，连接和恢复均采用约 0.6 秒的缓动。ResizeObserver 按实际文字与布局尺寸计算轮廓，手机两行布局也能连接；关闭动效时直接切换。
- 优化构建退出 0，包含 TypeScript 检查。实际浏览器 1280px 截图确认右边缘逐步延展、最终连成一条，返回顶部 data-joined=false；360px 合并可用、导航可点击且无横向溢出，背景保持 rgba(255,250,244,0.64) 与 opacity=1。
- 截图 `outputs/header-right-during.png`、`outputs/header-right-expand.png`。已恢复原视口与主页，3000 正式预览继续运行；未部署到云端。

## 后续：索引进度提示与原文文件名

- 依据状态文档 4.3 的两个延后小项，先把 3000 正式预览重新拉起（此前进程已停止，`127.0.0.1:3000` 连接被拒绝），再补齐这两项。
- 环境核查：`npm test` 25/26，唯一失败是 `backup.test.ts` 的 `spawnSync ...node.exe EBUSY`。手工复现同一流程（造数据 → 跑 `scripts/backup.ts` → 读回校验）得到私密记录、公开计数 0、站主密码校验、附件内容全部正确，确认失败只发生在派生子进程这一步，`spawnSync` 在本机沙箱内外都返回 EBUSY，属环境限制，不是本轮改动引起，也不是备份功能缺陷。
- 原文文件名：`src/lib/iris-stream.ts` 增加 `sourceFileName` / `attachmentDisposition`。解析 `filename*`（UTF-8）优先、否则用 `filename`，percent 解码、剥离路径与控制字符、只有 `.`/`..` 或超长时回退 `iris-source`；输出对纯 ASCII 名称只写 `filename`，含非 ASCII 时补 `filename*=UTF-8''` 并保留 ASCII 兜底。`src/lib/api/iris.ts` 的 source 分支改用它，不再写死 `iris-source`。
- 索引进度：先读本地 Iris 侧 `iris_agent/api/knowledge_api.py` 与 `rag_service.py`，确认 `GET /api/knowledge/index-progress` 返回 `{items:[{document_id,stage,message}]}`，stage 取值为 queued/parsing/chunking/graph/embedding/completed/failed，且这些路径本来就在白名单内，因此没有放宽代理白名单，也没有新增接口。
- 新增 `src/lib/iris-status.ts`：阶段中文文案、`irisStageSettled` 终止判断、`status→stage` 归一（ready→completed）与按文档取进度（对上游返回值做类型防御）。
- 资料柜导入后取上传响应里的文档 id，先 800ms 后每 3 秒轮询 `iris/knowledge/index-progress`，在文件行显示阶段文案，完成/失败即停；连续 3 次请求失败或超过 48 次也停；卸载时清定时器，换文件重新导入会重新开始。文案用上游 message，失败时显示失败原因。
- Iris 页复用已有的资料列表接口（`status`/`error_message` 本来就在返回里），给每份资料加状态徽标；只要还有资料不是完成/失败，就每 3 秒刷新一次，最多 40 次，摘要行提示“有资料正在整理”。
- 先写测试再实现：3 个 `iris-status` 用例与 2 个文件名用例先失败，实现后通过；`tests/api.test.ts` 的上游 mock 增加带文件名、纯 ASCII、路径穿越三种响应头，断言代理后的 `Content-Disposition`。
- 验证：`npm test` 25/26（同上环境项）、`npm run typecheck` 退出 0、`npm run build` 退出 0。构建时先停掉占用 `.next/standalone` 的 3000 预览（`EBUSY: rmdir`），构建后重新启动。
- 真浏览器验收（CDP + 本机 Chromium，脚本 `.test-data/browser-check.mjs`，模拟上游 `.test-data/mock-iris.mjs` 走 8000，测试库 `.test-data/browser`、服务 3101）：界面登录成功 → 资料柜点“导入 Iris” → 文件行出现“等待建立索引”徽标（class `doc-status is-working`）→ 约 11 秒后变“索引已完成”（`is-ready`）；Iris 页摘要“Iris 知识库里的资料 · N 份”，每行标题加状态徽标；页面内同源请求读到 `attachment; filename="____.md"; filename*=UTF-8''%E6%B5%8B%E8%AF%95%E8%B5%84%E6%96%99.md`，即保留“测试资料.md”。截图 `outputs/files-import-progress.png`、`outputs/files-import-ready.png`、`outputs/iris-knowledge-status.png`。
- 验收用的模拟上游与 3101 测试服务已停止，端口已释放；正式预览回到 3000，正式库仍为站主 0、条目 0、附件 0，未被测试数据污染。
- 提交 `8379a49`。未做云端部署，未验证真实 Iris 的进度返回（本轮用的是按真实接口字段写的模拟上游）。

## 后续修复：输入框聚焦轮廓溢出圆角容器

- 用户指出生活碎片搜索框聚焦时“框样式有问题”。本机 Chromium 复现：全局 `input:focus-visible{outline:2px solid var(--space-accent);outline-offset:4px}` 画在 `.search-field` 内部那个无边框输入上，得到一个直角矩形，向上下右溢出圆角胶囊，左侧被放大镜图标压住。
- 同类问题共三处：生活碎片搜索、资料柜搜索（同属 `.search-field`），以及 Iris 聊天框 `.chat-input textarea`。资料柜“上传分类”是另一回事——它自带边框，聚焦时边框外再套一圈亮粉 outline，形成刺眼的双层环，与奶油柔粉配色不搭。
- 修法：文本框类控件（排除 checkbox/radio/file/color）聚焦改为 `outline:none` + 主题色边框 + `box-shadow:0 0 0 3px` 的柔和外环，贴合圆角；`.search-field` / `.chat-input` 内部的控件显式去掉外环，改由容器 `:focus-within` 高亮边框与外环。保留 `@media(forced-colors:active)` 下的实线 outline 作为高对比度模式兜底。`.search-field` / `.chat-input` 增加 0.2 秒的边框与阴影过渡，`motion-off` 下取消过渡。
- 浏览器验证（`.test-data/focus-check.mjs`，CDP + 本机 Chromium，走 3101 测试库）：五个位置聚焦后计算样式均为 `outline-style:none`，容器环生效；修复后截图 `outputs/focus-life-search.png`、`focus-files-search.png`、`focus-login-password.png`、`focus-files-category.png`、`focus-chat-input.png`（同名文件已被修复后的版本覆盖，修复前是向上下右溢出胶囊的直角矩形）；`outputs/files-normal.png` 确认未聚焦时外观未变。
- 样式改动只用真实浏览器验证，未添加镜像实现的样式单元测试，沿用此前对装饰性样式的处理方式。`npm run build` 退出 0；`npm test` 25/26（失败项仍是本轮之前就存在的 `backup.test.ts` 派生子进程环境问题）。3000 正式预览已用新构建重启并返回 200。

## 后续修复：名牌 hover 的底部缝隙

- 用户再次指出名牌 hover 时“下面还有缝隙”。本机 Chromium 复现并逐像素采样定位：名牌胶囊的填充（`.site-header::before` 磨砂层）与那圈高光边框（`.site-header::after`，实测 rect 与名牌盒子完全相同：top 28 / bottom 77 / left 44 / right 222）都在顶栏这一层，位置固定；而 `.brand:hover` 带着 `transform:translateY(-2px)`，着色跟着名牌一起上移，背景层留在原处。
- 竖向采样（4 倍放大，逐 CSS 像素）证据：hover 时名牌盒子 y=2–47 是均匀的粉色染色，y=49–50 出现两行没有染色的浅色（`253,245,238` / `254,252,249`），y=51 才回到页面底色——就是那条缝。临时禁掉位移后，y=2–47 染色，y=48 是和高光边框一致的边线，缝消失。
- 修法：名牌 hover 只保留配色变化，去掉 `translateY(-2px)`，`.brand` 的 transition 相应去掉 transform。导航和工具的高亮画在容器内部的按钮上，位移不会碰到外层胶囊边，浮起照旧，因此不动它们。CSS 里留了注释说明原因，避免以后又被加回来。
- 顺带确认合并顶栏（滚动后）状态下同样存在这条缝：`.site-header::after` 在合并时变为整组的外框（24 / 80 / 44 / 1218），名牌位移后底边露出的就是条形底色的浅色带；去掉位移后染色在合并顶栏里垂直居中，不再挂边。
- 复验：`outputs/brand-hover.png`（4 倍放大）上下边线对称、染色铺满；`brand-idle.png` 未聚焦外观未变；`brand-joined-hover.png` 合并状态正常。测量数值见该脚本输出，脚本为 `.test-data/brand-check.mjs`（真实鼠标事件 `Input.dispatchMouseEvent` 触发 `:hover`，`LW_BASE` 可指定端口）。
- 只改样式，未动逻辑；`npm run build` 退出 0，`npm test` 25/26（同上环境项）。提交 `6dfce16`。

## 后续：文案切换的过渡动效

- 用户要求“点一下更新那个文案……不要直接变”。核对后确认指的是主页那条小屋寄语：`space.tsx` 的 `sayings` 数组配 `daily-quote` 按钮，点一下换下一句，文字是直接替换的。第一轮改在了 Iris 连接状态芯片上，属于找错位置，本轮补上正确的目标，同类问题一并处理。
- 做法：文案变化时让承载文本的元素用 `key` 重新挂载，配合一次性 CSS 动画。`globals.css` 新增 `@keyframes label-swap`（`opacity 0 → 1`、`translateY(4px) → 0`，0.26s，`cubic-bezier(.2,.7,.2,1)`，`fill-mode: both`）与 `.label-swap`（`display:inline-block;min-width:0`）。只换文本节点，父级胶囊的背景和圆点动画不受影响。
- 应用位置三处：小屋寄语的 `<span>`（`key={sayings[sayIndex]}`）、Iris 连接状态芯片的文案（键为 connecting / online / offline）、索引进度徽标内部的文案（资料柜 `key={progress.message}`，Iris 列表 `key={stage}`）。
- 顺带给状态芯片加了按下反馈（`:active` 时 `scale(.96)`）与 `transform/background/color` 过渡，连接中（`online===null`）时 `RefreshCw` 图标复用已有的 `.spin` 转动。
- 关闭动效的路径：`.motion-off .label-swap{animation:none}`、`.motion-off .status-chip` 及其 `:active` 去掉过渡与缩放，另有 `@media(prefers-reduced-motion:reduce)` 下对 `.personal-space:not(.motion-on)` 的同类覆盖，与项目既有约定一致。
- 验收（`.test-data/label-swap-check.mjs`，CDP + 逐帧 `requestAnimationFrame` 采样计算样式的 opacity / transform）：
  - 寄语：点击前 `今天也有值得期待的小事。` → 点击后 `喜欢的音乐，会陪你走过平凡的一天。`，元素 `__mark` 探针在重挂载后消失（`remounted: true`），采样 55 帧中 8 帧 `opacity < 0.9`、最小 0，transform 依次为 `translateY(4 → 3.07 → 2.19 → 1.51)`，证明淡入上浮确实在跑而不是跳变。
  - 连接状态芯片：采样 61 帧，7 帧 `opacity < 0.9`、最小 0，transform 同样从 4 递减，`remounted: true`，文案 `已连接`。
  - 索引进度徽标：导入一份资料后采样 614 帧，33 帧 `opacity < 0.9`、最小 0，77 帧发生位移，最终落到 `索引已完成` 且徽标转为 `is-ready`。
  - 关闭动效时 `.label-swap` 的 `animation-name` 为 `none`、芯片 `transition-duration` 为 `0s`。
- 截图 `outputs/label-swap-saying.png`、`label-swap-chip.png`、`label-swap-status.png`（截图为动画结束后的稳定态，动效本身以上面的采样数据为准）。`npm run typecheck` 退出 0，`npm test` 25/26（失败项仍是 `backup.test.ts` 的本机派生子进程问题）。提交 `73e7188`。
- 复验提醒：3101 测试服务占用 `.next/standalone`，改代码后必须先停它再 `npm run build`，否则报 `EBUSY: rmdir`。

## 后续：顶部阅读进度条与回到顶部按钮

- 用户给出了参考站 `yaronluo.com`（Fuwari 主题的博客），要它的 TOP 按钮和顶部进度条。此前那张「TOP」截图在项目源码与渲染结果里都找不到出处，现在对上了：它属于参考站，不是本项目已有的东西。
- 参考实现是 Fuwari 的 `src/components/control/BackToTop.astro`（GitHub `saicaca/fuwari`）。要点：外层 div 只负责定位（祖先不能有 filter，否则 `fixed` 会失效），按钮本身 `position:fixed;bottom:10rem`，默认带 `.hide`（`transform:translateX(5rem)` + `opacity:0` + `pointer-events:none`），移除该 class 即从左滑入；`:active` 时 `scale(.9)`；点击 `window.scroll({top:0,behavior:'smooth'})`；只在 `lg` 以上显示。
- 本项目实现为 `src/components/scroll-tools.tsx`，一个组件同时管进度条和按钮，共用一次滚动监听：
  - 进度条 `.reading-progress`：`position:fixed;left:0;top:0;height:3px;width:100%`，`background:var(--space-accent)`，右端圆角；`transform:scaleX(ratio)` + `transform-origin:left center`；`opacity` 由 `data-active` 控制（比例≈0 时整条不显示）。只过渡 opacity，transform 直接跟随滚动、不做过渡，否则会拖尾。
  - 按钮 `.back-to-top`：`position:fixed;right:26px;bottom:30px`，52px 宽的圆角卡片，粉色 ↑ 与放大字距的 TOP，右上角一个 ✦ 星点（`top-star-twinkle` 缓慢明暗闪动）。默认 `opacity:0;visibility:hidden;translateY(12px) scale(.94)`，滚过阈值后加 `.is-visible`；用 `visibility` 而不是只靠 opacity，隐藏时不会被 Tab 聚焦（已实测）。
  - **跟随正在阅读的内容**：`readingSurface()` 优先取 `dialog[open]` 且可滚动者（本项目长文是在弹窗里读的），否则用整页；进度比例和「回到顶部」的目标取自同一个来源，所以打开长文时进度条跟着文章走、按钮把文章滚回开头。
  - 出现阈值：整页 520px、弹窗 180px。
  - 滚动监听用 `document.addEventListener('scroll',fn,{capture:true,passive:true})`——scroll 事件不冒泡，只有捕获阶段才能同时收到整页和弹窗内部的滚动。另加 `ResizeObserver(body)` 与 `MutationObserver(body)`，覆盖切换栏目、打开弹窗、图片撑高导致的内容高度变化。
  - 关闭动效：复用项目已有的 `.motion-off *{animation:none!important;transition:none!important}`，星点与过渡自动停止；回顶的 `behavior` 跟着 `motion` 开关走（`smooth` / `instant`）。
- 验收（`.test-data/scroll-tools-check.mjs`，CDP + 本机 Chromium，走 3101 测试库）：先用 API 造一篇长文（`POST /api/items`）以便页面真能滚。
  - 顶部：`scaleX(0)`、`opacity 0`、按钮 `hidden`。
  - 滚到 838 / 1675：`scaleX(0.5003)`（期望 0.5）、`data-active=true`、按钮 `is-visible`。
  - 滚到底：`scaleX(1)`。
  - 点击按钮：`scrollY` 归 0，按钮回到 `hidden`；此时 `focus()` 拿不到焦点。
  - 弹窗长文：撑高后 `dialogMax=4393`，滚到 2636（0.6）时进度条 `scaleX(0.6000)`、`source=dialog`，而整页 `scrollY` 仍是 0；点击按钮后文章 `scrollTop=0`。
  - 截图 `outputs/scroll-mid.png`（进度条与按钮同屏）、`scroll-bar.png`（顶部放大 5 倍，粉色条右端圆角正好停在 50% 处）、`scroll-button.png`（按钮放大 4 倍）、`scroll-article.png`、`scroll-top.png`、`scroll-back-to-top.png`。
- 又踩了一次的坑：`Page.captureScreenshot` 的 clip 用文档坐标，`position:fixed` 元素必须加 `window.scrollY` 才能截到，第一版截回来是空白。
- 只加前端表现，未动接口与数据；`npm run typecheck` 退出 0，`npm test` 25/26（失败项仍是 `backup.test.ts` 的本机派生子进程问题）。提交 `c11f4bf`。

## 后续：顶栏加大与加粗

- 用户说「头部 bar 可以做大一点字体加粗大一点」。顶栏、TOP 按钮、进度条三个候选里确认指的是**顶栏**（`My little world` + 主页/生活碎片/收藏小屋/资料柜/Iris + 右侧工具图标）。
- 改尺寸前先量了基线：桌面态品牌名 178.39×49（14px/600）、导航 497.27×56（按钮 80×40，13px/500，图标 17）、三个图标按钮 97→138（38×38），顶栏总高 104px。
- 桌面基础档（`>1100px`）的改动：
  - `.brand` `padding:9px 17px → 11px 19px`、`gap:10 → 11`、`border-radius:30 → 34`、**补上显式 `font-size:15px`**（原先继承 body 的 14px）、`font-weight:600 → 700`、`max-width:260 → 300px`。
  - `.brand-avatar` 与 `.brand-avatar img` 29 → 33px。
  - `.main-nav` `padding:7px 11px → 9px 13px`、`gap:4 → 5`、`border-radius:34 → 38`。
  - `.main-nav button` `padding:4px 15px → 9px 16px`、`gap:7 → 8`、`border-radius:22 → 24`、`font-size:13 → 14px`、`font-weight:500 → 600`。
  - `.header-tools` `padding:5px 8px → 7px 10px`、`gap:3 → 4`、`border-radius:30 → 34`。
  - `space.tsx` 图标同步：导航 `size 17 → 18`、名牌占位 `Music2 19 → 21`、`Flower2 19 → 20`、`Settings/LogOut/LockKeyhole 18 → 19`。
- **作用域收窄（关键）**：`.icon-button` 原本想直接全局 38 → 43px，但它同时用在资料柜行内操作（下载/导入/删除）和弹窗关闭按钮上，全局改会顺手改掉两处与本次需求无关的地方。改为保持 `.icon-button` 38px 不动，新增 `.site-header .header-tools .icon-button{height:43px;width:43px;min-height:43px}` 只作用于顶栏；触摸设备下再加一条 `.site-header .header-tools .icon-button{44px}` 以守住 44px 的点击目标（`.icon-button{width:42px}` 恢复原值）。
- 媒体查询逐档同步，避免小屏被撑爆：`≤1100px` 品牌 13px/230px/`9px 14px`、导航 `padding:8px`、导航按钮 `8px 12px`/13px；`≤640px` 品牌 13px/230px、头像回落到 29px、工具区 `4px 7px`；`≤380px` 品牌 12px/195px/`9px 12px`。`≤640px` 与 `≤380px` 的**导航按钮字号刻意不动**——量下来 640px 时导航宽度 604px 正好等于可用宽度 604px，再放大必然溢出。`@media(pointer:coarse)` 的 `.main-nav button{min-height:40px}` 提到 44px。
- 布局安全性：顶栏视觉胶囊由 `.site-header::before/::after` 用 `--header-clip-*` 渲染，`scroll-header.tsx` 的 `measure()` 在读三个胶囊的 rect，而它用 `ResizeObserver` 监听了 `.site-header/.brand/.main-nav/.header-tools`，所以尺寸一改会自动重算 path，**该文件无需改动**。`radius=n.top>b.top+5?27:h/2` 的换行判断也照旧成立（单行时 nav.top < brand.top，换行时 nav 落到第二行）。
- 验收（`.test-data/header-metrics.mjs`，CDP 在 14 个视口宽度上量真实盒子，并检查横向溢出 / 换行 / 品牌名被省略号截断）：改后桌面态品牌名 194.77（+9.2%）、导航 541.73（+8.9%）、导航按钮 86×42.5、工具区 159、图标按钮 43×43、顶栏总高 104 → 110.5px（+6.3%）。
  - 全部 14 个宽度（1600 → 360）`docOverflow=0`、`brandClipped=false`，即无横向滚动条、品牌名也没被截断。
  - 作用域检查：顶栏图标 43×43，而弹窗关闭按钮 37×37、资料柜行内按钮 38×38，两处都保持原值，证明收窄生效。
  - 截图 `outputs/header-{before,after}-1440.png`（含滚动后的合并胶囊态）、`-640.png`、`-380.png`；对比页 `outputs/header-compare.html`（整条顶栏 1:1 + 名牌/导航/工具区 2× 放大 + 小屏，改前改后并排）。
- 只改排版尺寸，未动接口、数据与交互逻辑；`npm run typecheck` 退出 0，`npm run build` 通过。


## 后续：名牌 hover 底部的亮缝

- 用户反馈「这个 hover 特效还是下面有空隙」并给了截图（320×95）。上一轮 `a49473f` 只是去掉了名牌 hover 的位移，缝还在。
- 先把截图交给像素探针（`.test-data/png-inspect.mjs`，Node 无内置 PNG 解码，所以把图片塞进浏览器用 canvas 读 `getImageData`）。沿胶囊中心列逐行读色，得到：顶部亮带 2 设备像素（`::after` 的 `inset 0 1px 0` 高光，符合设计），**底部亮带 8 设备像素**——明显不对称。
- 亮带的成分也算了：`0.64×(255,250,244) + 0.36×(252,245,235) ≈ (254,248,241)`，与实测的 `255,249,240` 吻合，**说明那条带是玻璃层 `.site-header::before` 露出来的**，即粉色填充没有盖到胶囊底部。
- 根因：粉色填充画在 `.brand` 自己的 `background` 上，用的是**元素实时盒子**；而玻璃层的 `clip-path` 和描边层 `::after` 的 `inset` 都来自 `scroll-header.tsx` 里 `measure()` 写下的 `--header-*`，用的是**测量快照**。两者在小数像素下取整不同，底部就会露出一条没被染色的缝。headless 在 DPR 1 / 1.25 / 1.5 / 2 四档都只量到 1~3 像素的对称亮带（复现不出用户的 8 像素），但机制是确凿的。
- 修法两层：
  - **让填充和描边变成同一个元素**。展开态下 `::after` 的盒子本来就等于名牌盒子，于是把 hover 底色交给它：
    `.site-header:not(.is-joined):has(.brand:hover)::after{background:color-mix(in srgb,var(--space-accent) 10%,transparent)}`，
    同时 `.site-header .brand:hover{background:transparent}`。合并态下 `::after` 已变成包住整条顶栏的外框，回退到名牌自身背景。整段包在 `@supports selector(:has(*))` 里，不支持 `:has()` 时保留原写法。给 `::after` 的 transition 补上 `background .25s ease`。
  - **补掉测量快照过期**：`measure()` 原本只在挂载时跑一次（外加 `ResizeObserver`）。加上首帧后两帧的重测、`window load` 重测、`document.fonts.ready` 重测，并用 `alive` 标志防止卸载后回调仍执行。
- 验收（`.test-data/brand-hover-dpr.mjs`，DPR 1 / 1.25 / 1.5 / 2 各跑一次）：hover 时确认 `brand=rgba(0,0,0,0)`、`::after=...0.1)`、`:has支持=true`；**底部亮带降到 1~2 设备像素**（DPR 1.25 下底部 1px、顶部 3px，不再比顶部厚）。下缘色带采样显示是「填充 → 1~2 行抗锯齿过渡 → 阴影」，不再是整片玻璃。
- 截图：`outputs/brand-hover-diagnose.png`（修复前）、`brand-hover-after.png`（修复后）、`brand-hover-joined.png`（合并态），对比页 `outputs/brand-hover-compare.html`。
- 顺带又踩了一次同一个坑：`Page.captureScreenshot` 的 clip 用文档坐标，顶栏是 `position:sticky`，滚动后必须把 `window.scrollY` 加进 clip 的 y，否则截回空白。

## 后续：加强顶栏的边界阴影

- 用户要求「顶部 bar 的边界阴影可以明显一点」。
- 先理清阴影来源。三条 `.brand` / `.main-nav` / `.header-tools` 上的 `box-shadow:0 5px 19px #8969550d`（以及 `@media(max-width:850px)` 里那条同值声明）都是**死代码**——后面的无条件规则 `.site-header :is(.brand,.main-nav,.header-tools){box-shadow:none}` 把它们覆盖了（同特异性、位置更靠后）。真正生效的只有两条：
  - `.site-header::after`：名牌在展开态、整条 bar 在合并态的描边，`0 6px 24px #82635312, inset 0 1px 0 #ffffff8c`
  - `.site-header :is(.main-nav,.header-tools)::before`：导航与工具的描边，`0 5px 20px #82635310, inset 0 1px 0 #ffffff8c`
- 先量基线（新增 `.test-data/header-shadow-check.mjs`，沿胶囊中心列从下缘往下逐行读像素）：背景亮度 237，最暗行 231.33，**阴影深度只有 5.67/255（约 2.2%）**，19 个设备像素内就回到背景——确实几乎看不见。
- 改法：两层阴影，一层贴边做边界定义、一层散开做悬浮感，并把顶部内侧高光提亮一点让边界更利落。
  - `.site-header::after` → `0 2px 5px #82635326, 0 12px 30px #82635333, inset 0 1px 0 #ffffffb3`
  - `.site-header :is(.main-nav,.header-tools)::before` → `0 2px 5px #82635326, 0 10px 26px #8263532e, inset 0 1px 0 #ffffffb3`
  - 阴影色沿用原有的暖棕 `#826353`，不引入新颜色。
- 复测（同脚本、同 DPR=1、同区域）：**深度 5.67 → 32**，扩散 19 → 39 设备像素，最暗处 `rgb(244,229,221)` → `rgb(220,203,192)`。@media 各档与合并态都不覆盖这两条规则，所以所有宽度一致；box-shadow 不参与布局，尺寸无回归。
- 截图：`outputs/shadow-profile-{before,after}.png`（同区域窄条，直接可叠比）、`header-shadow-zoom.png`（展开态 4×）、`header-shadow-joined-zoom.png`（合并态 4×）、`header-shadow-1440.png`、`header-shadow-joined.png`；对比页 `outputs/header-shadow-compare.html`。
- 遗留：上面那三条死掉的 `box-shadow` 声明建议之后清掉，但那是与本次需求无关的改动，没有顺手动。

## 后续：撤掉名牌 hover、改名 Hai's Little World

- 用户说「头部左边那个 hover 去掉吧换成 Hai's Little World」。两件事：**摘掉名牌的 hover 特效**、**把名牌文案改成 `Hai's Little World`**。
- 撤 hover（`src/app/globals.css`）：
  - 删掉老写法 `.brand{transition:background .25s,box-shadow .25s}` + `.brand:hover{background:rgba(255,248,240,.8);box-shadow:0 8px 28px #b57d931c,inset 0 1px 0 #ffffffb3}`。
  - 删掉 `.site-header .brand:hover{background:color-mix(in srgb,var(--space-accent) 10%,transparent)}`。
  - 整个 `@supports selector(:has(*)){…}` 块删掉——里面三条规则全是名牌 hover 专用（`.brand:hover{background:transparent}`、`:has(.brand:hover)::after` 画底色、合并态回退）。删完之后 `:has(` 在文件里归零。
  - `.site-header::after` 的 transition 去掉只为名牌 hover 加的 `,background .25s ease`，恢复成只过渡 `inset`。
  - 注释改写：名牌不做 hover 变色、也不做位移。
  - **随之失效的旧方案**：上一轮为「名牌 hover 底部亮缝」搞的「把 hover 底色交给 `::after`，让填充与描边同属一个元素」整套逻辑，因为 hover 本身没了而整体删除。那条缝不会再出现。
  - 没顺手动：`.motion-off .site-header :is(.brand,button,button svg){transform:none!important}` 里的 `.brand` 是冗余的（名牌本来就是 `button`），无害，留着。
- 改名：
  - `src/lib/types.ts` 的 `DEFAULT_PROFILE.name`：`My little world` → `Hai's Little World`。
  - 顺带把 `src/app/layout.tsx` 的 metadata title 同步成 `Hai's Little World · 我的个人小屋`，否则浏览器标签页还写着旧名。
  - 数据库不用迁移：`SELECT key,data FROM settings` 返回空，说明从没保存过自定义资料，页面一直读的是 `DEFAULT_PROFILE`。改默认值即生效。
  - 同一个 `profile.name` 还渲染在侧栏 profile-card 的 `<h2>` 与页脚 `{profile.name} · MUSIC & MOMENTS` 上，一并跟着变。
  - 撇号用 ASCII `'`（用户在中文输入法里打出来的是 U+2018，不是要那个字符）。字符串因此改用双引号，项目里没有 prettier/eslint 配置，不影响风格。
- 验收（新增 `.test-data/brand-nohover-check.mjs`）：每个宽度下先截名牌周围一块（留 10px 余量、2× 放大），用真实鼠标事件 hover 之后再截一块，两个 PNG 塞回页面用 canvas 解码**逐像素比对**。同时截两张「完全不 hover」的图作为**噪声底**。DPR 1 与 1.5 各跑 1440 / 1100 / 900 / 640 / 380：
  - 噪声底 **0 像素**（无头浏览器渲染是确定性的），所以 diff=0 是强证据而不是「刚好没量到」。
  - hover 后 **0 像素差、maxΔ 0**，五个宽度、两个 DPR 全部如此；同时 `brand.matches(':hover')===true`，证明鼠标确实进到元素上，不是假通过。
  - 对照组：导航「主页」按钮 hover 仍有 **6083~9048** 像素差（maxΔ 108~110）→ hover 只从名牌身上摘掉了，导航与工具的浮起没被误伤。
  - 名牌文字全部是 `Hai's Little World`；各宽度 `scrollWidth === clientWidth`（不裁切）、`docOverflow = 0`；文字右缘到胶囊内壁还剩 20 / 15 / 15 / 15 / 13px。
  - hover 后的计算样式：`background-color: rgba(0,0,0,0)`、`box-shadow: none`、`transform: none`、顶栏 `::after` 的 `background-color: rgba(0,0,0,0)` —— 和默认态一字不差。
- 又踩了一次 `.cursor-notes`：鼠标移动会沿路撒光标星屑（`.cursor-note`，1.25s 动画）。第一版脚本 hover 后只等 900ms 就截图，在 DPR 1.5 / 900px 上量到 1617 像素差（maxΔ 12），一看就是星屑没落干净；把等待拉到 2200ms 并确认 `document.querySelectorAll('.cursor-note').length === 0` 之后就是 0。**凡是用「两张截图逐像素对比」做验收的脚本，都要先让星屑收干净，否则会把随机装饰当成样式变化。**
- 截图：`outputs/brand-nohover-<宽度>-dpr<DPR>-{before,hover}.png`；报告 `outputs/…` 同目录外另有 `.test-data/brand-nohover-dpr1.json` 与 `.test-data/brand-nohover-dpr1.5.json`。
- 遗留：`docs/项目状态总结.md` 按用户要求不自动更新，如果里面写了旧站名，等用户下指令时再一起改。三条死掉的 `box-shadow`（见上一节）仍未清理。

## 后续：切栏目一律回到页面顶部

- 用户问「每次头部点击新菜单都应该跳转到最上面才对吧」。原来 `go()` 只做 `setView` + `history.pushState`，**完全没碰滚动位置**；顶栏是 sticky 的、在页面很下面也一直点得到，于是点导航后新栏目直接从半截开始显示。
- 改法：抽出 `toTop()`，在三个「用户主动换栏目」的路径上调用：
  - `go()` 末尾 —— 一次覆盖导航五个按钮、点名牌回主页、侧栏书架三个入口、侧栏标签切到生活碎片、顶栏「布置小屋」、首屏「看看收藏」。
  - 登录成功后（`setView(pendingView)`）。
  - 退出登录后（`setView('home')`）。
  - 位移方式 `motion?'smooth':'instant'`，与页脚「回到小屋顶端」、浮动 TOP 按钮、首屏 scroll-hint 完全一致，也照样能被 `.motion-off` / `prefers-reduced-motion` 关掉。
  - `popstate`（浏览器前进后退）刻意不动：那是浏览器自己的导航，不该抢走滚动位置。
- 确认没有误伤首屏「翻翻日常」：它是 `go('life')` + `content.scrollIntoView()` 连发两个滚动请求，后发的 `scrollIntoView` 决定最终落点，所以仍然停在正文顶部而不是被 `toTop` 拉回 0。
- 验收（新增 `.test-data/nav-scroll-check.mjs`）：真实鼠标按下/松开，等滚动停稳（连续三次读数不变）后再读 `window.scrollY`。跑 **3101 + `.test-data/browser`** 那套测试数据（6 条内容 + 测试站主账号），不碰 `data/` 里的真实数据。动效开 / 关各跑一遍：
  - 动效开（`motion-on`）：导航「生活碎片 / 收藏小屋 / 主页」、点名牌回主页、登录进资料柜、退出登录回主页 —— **全部 `scrollY = 0`**，且 `aria-current` 的栏目名正确。平滑滚动要 9~11 帧才停稳。
  - 动效关（`motion-off`）：同样全部 `0`，但都只用 **4 帧**停稳 —— 证实 `instant` 分支确实在起作用，两种模式行为不同。
  - 首屏「翻翻日常」：`scrollY = 626`、栏目 = 生活碎片（停在正文，不是 0）✓。
- 顺带记一个观察到但**没改**的现象：「翻翻日常」落点 626 比「按切换后的布局重算」要大（切换后 `.site-main` 距文档顶 466，减 `scroll-margin-top:120` 应是 346）。原因是 `scrollIntoView()` 在同一个事件处理里、React 重渲染**之前**就被调用，平滑动画锁定的是「主页那套布局」的坐标（746 − 120 = 626，对得上）。这是改动前就存在的行为（`toTop` 在 scrollY=0 时是空操作），本次没动它。

## 后续：收藏馆（照参考站的番剧墙改版）

- 用户要求「像参考页面那样做个收藏馆收藏音乐动漫电视剧电影kpop小卡什么的等」。澄清后确定的四条：**升级现有收藏小屋**（不新开栏目）、**站主手动录入**（不做自动抓取）、**完全照参考站**、**只加「类型分类」一个字段**（状态 / 评分 / 短评链接都不要）。
- 结构改动：
  - 新增 `src/components/collection-wall.tsx`。卡片是「铺满的 `<button class="poster-open">` + 绝对定位的角标 / 工具条 / 信息条」——HTML 不允许 button 套 button，所以右侧那排操作按钮只能做成它的**兄弟节点**叠上去。
  - `space.tsx` 里 `kind==='collection'` 走 `CollectionWall`，`moment` 仍走原来的 `.moments-list`；导航项与页面标题的「收藏小屋」统一改为「收藏馆」。
  - 筛选从原来的「分类或标签」改成**只按分类**（海报墙角标显示的就是分类），按数量倒序、同数量按中文名排序，渲染成 `[全部 ✦12] 动漫3 音乐3 电视剧2 电影2 K-pop 小卡2` 这样的胶囊；生活碎片那条路径保持原样。
  - 每页 9 张（`WALL_PER_PAGE`），上一页 / 下一页 + `1 / 2` 计数，只有一页时不渲染翻页条。
  - `useEffect(()=>{setPage(1)},[view,tag,search])`：换栏目、换分类、改搜索词都会让结果集变短，不回第一页就会停在一个空页上。
  - 排版照参考站：`aspect-ratio:2/3` 竖版海报铺满卡片、左上角分类角标、右上角操作按钮与底部信息条默认 `opacity:0`，hover 时一起浮出，卡片 `translateY(-6px)`、封面 `scale(1.06)`。
  - `editor.tsx`：收藏的默认分类由「专辑」改为「音乐」，datalist 补到 12 项（生活 / 音乐 / 专辑 / 舞台 / 写真 / K-pop 小卡 / 动漫 / 电视剧 / 电影 / 综艺 / 游戏 / 其他），并在分类字段上加了一句「收藏馆里按它分组」。
  - 清理死代码：旧的 `.collection-grid` / `.collection-card` / `.collection-cover` 已无任何引用，连同 `@media(max-width:640px)`、`@media(max-width:380px)`、`.motion-off`、`prefers-reduced-motion` 里的相关分支一并删除；构建后 CSS 由 46017 字节降到 44525，`.collection-grid|card|cover` 在产物里归零。
- 验收数据：`.test-data/seed-collection.mjs` 自带一个极简 PNG 编码器（`zlib.deflateSync` + 手写 CRC32）生成 2:3 渐变海报，登录 3101 测试站主后写入 12 条（音乐 3 / 动漫 3 / 电视剧 2 / 电影 2 / K-pop 小卡 2，其中 2 条故意不带封面）。**脚本必须带 `Origin` 头**，否则同源校验返回 403。
- 验收脚本 `.test-data/wall-check.mjs`，四个宽度全部通过：

  | 宽度 | 列 | 卡片 | 比例 | 张数 | 溢出 | 翻页 | 默认隐藏 | hover | 触屏 |
  |---|---|---|---|---|---|---|---|---|---|
  | 1440 | 3 | 282×423 | 0.667 | 9 | 0 | 1 / 2 | true/true | 1/1 | 命中，9 张全常驻 |
  | 900 | 3 | 193×290 | 0.667 | 9 | 0 | 1 / 2 | true/true | 1/1 | 命中，9 张全常驻 |
  | 640 | 3 | 193×289 | 0.667 | 9 | 0 | 1 / 2 | true/true | 1/1 | 命中，9 张全常驻 |
  | 380 | 2 | 166×248 | 0.667 | 9 | 0 | 1 / 2 | true/true | 1/1 | 命中，9 张全常驻 |

  1440 下另外验了：标签计数与选中态、翻页 `1 / 2`（上一页禁用）、第二页 3 张（`OST` / `示例专辑：凌晨三点的电台` / `예시 앨범: 여름의 첫 곡`）、筛选「动漫3」得 3 张且翻页条自动隐藏、点开详情弹窗标题为 `示例小卡：特典` 且正文在。截图 `outputs/wall-<宽度>{,-heading,-filters,-hover,-touch}.png`。
- **踩到并修掉一个「假通过」**，值得记住：触屏分支原来用 `Emulation.setEmulatedMedia({features:[{name:'hover',value:'none'}]})` 模拟，然后只读 `document.querySelector('.poster-veil')`（第一张卡）的 opacity。看到是 `1` 就判定 `@media(hover:none)` 生效了 —— 其实**这个 CDP 开关对 `hover` 完全无效**（`matchMedia('(hover: none)')` 仍返回 `false`），第一张显示 `1` 只是因为上一步的真实鼠标恰好停在它上面。
  - 用新写的 `.test-data/media-query-matrix.mjs` 逐组试开关，结论：真正能改变 `hover` / `pointer` 判定的是 **`Emulation.setTouchEmulationEnabled({enabled:true,maxTouchPoints:5})`** —— 打开后 `hover:none`、`any-hover:none`、`pointer:coarse` 全为 `true`，`maxTouchPoints` 变 5，关掉后完全可逆（对照组回到桌面全部复位）。
  - 新探针 `.test-data/touch-probe.mjs` 改成：开关打开 + **把鼠标挪出卡片** + 逐张读 opacity。改后 9 张全部 `veil=1 / tools=1` 且「悬停中的卡片数 = 0」，未模拟时全部为 `0`（证明读数确实没被鼠标污染）。
  - `.test-data/wall-check.mjs` 同步修正，并加了「没有任何卡片处于 `:hover`」的断言；末尾加了一张人可读的汇总表，不用再自己解析那一大坨 JSON。
  - 教训：**用媒体查询模拟做验收时，必须先断言 `matchMedia` 真的命中了**，否则规则根本没跑起来也会显示「通过」。
- 提交：`feat: rebuild the collection as a poster wall`。同一轮里 `npm run typecheck` 退出 0，`npm run build` 退出 0（构建前照例先停掉占用 `.next/standalone` 的 3000 预览与 3101 测试服务），`npm test` 25/26（失败项仍是本轮之前就存在的 `backup.test.ts` 派生子进程环境问题）。构建完成后 3000 与 3101 均已重启并返回 200。

## 后续：卡片支持横竖混排（小卡墙）

- 用户提出「因为我有很多喜欢的 kpop 明星想要把一些图做出类似小卡那样的有横的有竖的」。澄清后定的三条：**瀑布流错落**（不是横版占两列）、**自动读原图比例且可手动改**、**加白色印刷边**。
- 数据模型：`ItemInput` 新增三个可选字段（`items` 表把整个对象当 JSON 存在 `data` 列里，**不需要迁移**，老数据缺字段就走默认值）：
  - `cardRatio?: 'auto' | 'portrait' | 'landscape' | 'square'`，默认 `'auto'`；
  - `imageWidth?` / `imageHeight?`：上传时在浏览器本地量到的原图尺寸。
  - **尺寸存在条目上而不是图片上**，是为了让瀑布流不依赖图片加载完成就能算对高度 —— 否则每加载一张图，整面墙都会跳一次。代价是轻微的数据冗余（图片自身的尺寸也属于 `assets`），换来的是收藏馆不必再请求一次资源列表。
- `types.ts` 里加了纯函数 `cardAspect(item)`：手动覆盖 > 原图尺寸 > 兜底 2:3；自动档把比例夹在 **0.5 ~ 2**（极端全景/长截图会把它那一列拉成面条）；输出的是 `'0.6667'` 这种纯数字字符串，正好也是浏览器 `computedStyle.aspectRatio` 报出来的形式，便于验收逐项比对。
- **`src/lib/api/items.ts` 是白名单式的**（逐个字段拼 `ItemInput`），新字段必须在这里放行，否则会被静默丢掉。形状非法不报错、静默退回 `auto` —— 这是展示偏好，不该因为一个拼错的字符串把整条保存挡下来。
- `editor.tsx`：上传前用 `new Image()` + `createObjectURL` 在本地量尺寸，和条目一起提交；收藏新增一组「卡片形状」单选（跟随原图 / 竖版 / 横版 / 方形），下面跟一句提示说明当前是按原图还是按兜底。CSS 上把 `.visibility-picker` 的选择器扩成 `:is(.visibility-picker,.ratio-picker)`，两组单选共用一套样式。
- 版式：`.poster-card` 拆成两层 —— 外层是「奶白卡纸 + 一圈印刷白边 + 一道极细描边」，内层 `.poster-frame` 才是照片，`aspect-ratio` 由 `cardAspect()` 内联给出。角标、按钮、信息条都改成以照片层为定位基准。
- **瀑布流没有用 CSS 多列**，两个原因（都实测过）：
  - 多列只能「按顺序切成连续几段」来平衡。把 1:2 ~ 2:1 的比例混在一起时三列是 **1299 / 1244 / 733**（差 77%），最后一列短一截。
  - 就算先用 JS 把顺序排好再交给它，浏览器自己那次平衡是**近似**的，会再切一刀把结果拉偏。
  - 最终改成 JS 直接生成列容器：`.collection-wall` 是 flex 行、`.wall-column` 是 flex 列，列数由 CSS 自定义属性 `--wall-columns` 集中定义（断点只写一处），JS 用 layout effect 读回来。分配算法是**暴力枚举 columns^9 种放法取「最高那一摞最矮」**（3 列 = 19683 次，亚毫秒）；等高的卡会有大量并列解，再加一个 `drift` 次级偏好（1e-6 权重）让卡片按原来的先后从左到右铺开，而不是被枚举顺序随手倒过来。结果：1440 下三列 **1015 / 1148 / 1059（差 13%）**，380 下 **957 / 956（0%）**。
  - 手工验算过这个 13% 已是该组数据的最优解（总高 3222，理想 1074，找不到 max < 1148 的划分），不是算法没调好。
- 验收：
  - 新增 `.test-data/seed-collection.mjs` 改为可重复执行（先清上一轮），并按条目生成 6 种形状的封面：2:3 / 3:2 / 1:1 / 1:2 / 2:1 / 3.2:1(超限) ，另加「手动覆盖」与「有图但不记尺寸（模拟旧数据）」两条，以及一条无封面。同时写下 `.test-data/seed-collection.json` 期望比例清单。
  - `.test-data/wall-check.mjs` 逐张对照清单核对比例：**9 项符合、0 项不符**（覆盖自动、手动覆盖、clamp 到 2 与 0.5、旧数据退回 2:3、无封面退回 2:3）；四个宽度的**声明比例完全一致**；顶边种类 5~6 > 列数 2~3（证明是错落排布而不是网格）；`--wall-columns` 与实际列容器数一致；白色印刷边 = `padding 7px / 描边 1px / 底色 rgb(255,253,250)`（640 以下 padding 5px）。
  - 新增 `.test-data/editor-ratio-check.mjs`：新建时默认「跟随原图」、改成「横版」保存后卡片实测比例 1.5、重新打开已存 `portrait` 的条目选中「竖版」、已存 `auto` 的选中「跟随原图」。截图 `outputs/editor-ratio-{new,reopened}.png`。
  - 新增单元测试 `tests/card-ratio.test.ts`（6 条）锁住四个分支与上下限。整机 `npm test` **32 项 31 通过**（失败项仍是那个 `backup.test.ts` 环境问题），`npm run typecheck` 与 `npm run build` 均退出 0。
- 踩到的小坑：给 `wall-check.mjs` 加「各宽度比例一致」的断言时，第一版按**位置**逐项对比 —— 但平衡排布会随列数改变 DOM 顺序，于是误报「不一致」。改成按标题配对后再比。另外跨宽度比的是**声明值**（computed `aspect-ratio`）而不是实测盒子宽高：后者是整数像素，亚像素取整会让 177/266 这种值偏出 0.6667。

## 后续：首次建站与登录（让站主真的能进去发东西）

- 起因：用户要「先做登录让我进去操作一下了发布东西之类的」。查了一下 **正式库 `data/world.sqlite` 是全空的** —— `owner` / `sessions` / `items` / `assets` / `settings` 都是 0 行，所以当时**没有任何账号能登进去**。而页面上也没有任何创建站主的入口：`configured` 为 false 时弹窗只显示一句「私人空间尚未开放」，唯一的办法是在终端跑交互式脚本 `npm run setup-owner`。这既不适合用户自己操作，也没法远程做。
- `src/lib/api/auth.ts` 新增 `auth/setup` 分支：
  - **只在还没有站主的时候放行**；站主一旦存在就永久返回 409，所以长期不存在「谁先访问谁当站主」的漏洞。
  - 校验：密码 ≥12 位、≤256 位（和服务端登录、终端脚本同一套门槛）；昵称 trim 后截 50 字，留空则落「小屋站主」。
  - 建完**直接发会话**（`store.setOwner()` 会 `DELETE FROM sessions`，所以必须先建人再发 token，顺序不能反），省得刚设完密码又要再输一遍。
  - 走的是和其它写接口同一条 `requireOrigin` 同源校验。
- **窗口期是真的**：建站入口对外是开放的，所以这里有一条运维约束必须记住 —— **对外发布之前一定要先在本机把站主建好**，否则第一个访问到站点的人会成为站主。这一点写进了代码注释。
- `src/components/space.tsx`：
  - 新增 `signUp()`：本地先校验「至少 12 位 / 两次一致」，报错就地显示，不用等一个来回；服务端仍然会再校验一次。成功后清空三个密码/昵称字段，**落点回主页**并删掉 `view` 查询参数 —— 刚建好站主要做的事是「记一笔 / 收一份喜欢」，资料柜这会儿还是空的。
  - 弹窗改成 `ready ? 登录 : 建站`；标题对应「欢迎回到你的小屋 / 先给小屋配一把钥匙」；锁图标的 `aria-label` 也跟着变（「站主登录 / 设置站主账号」）。
  - **`configured` 必须复制成 state**：它只来自服务端首屏，如果直接用 prop，建完站主再退出登录时 `ready` 会翻回 false，弹窗又变回建站表单、并对着一个已经有站主的站点问你要密码。这是本轮最容易踩的一个坑。
- 验收（`npm run build` 后，`DATA_DIR=.test-data/fresh` 起一个**全新的空库**跑 3102，不碰 `data/` 和 `.test-data/browser`）：
  - 新增 `.test-data/setup-check.mjs`，脚本先直接用 `fetch` 打三个服务端探针，再走完整浏览器流程。八项全过：

    | 检查 | 结果 |
    |---|---|
    | `GET auth`（空库） | 200 `{owner:false,configured:false}` |
    | `POST auth/setup` 不带 Origin | 403 请求来源不匹配 |
    | `POST auth/setup` 密码太短 / 超长 | 400 密码至少需要 12 位 / 密码长度不正确 |
    | 空库锁图标 | 「设置站主账号」；弹窗标题「先给小屋配一把钥匙」；字段「站主昵称 / 设置密码 / 再输一次」；按钮「创建站主并进入」；**旧文案「尚未开放」已消失** |
    | 本地校验 | 太短 → 密码至少需要 12 位；两次不一致 → 两次输入的密码不一致 |
    | 建站成功 | 弹窗关闭、右上角出现退出按钮、落点是主页（URL 上没有 `view=`） |
    | 建好就能发 | 「记一笔」入口在；选「公开给访客」后首页立刻能看到这条 |
    | 刷新页面 | 会话仍在，还是站主态 |
    | 退出登录后点锁图标 | 是「欢迎回到你的小屋」+「站主密码」+「打开我的小屋」，**不再问「设置密码 / 再输一次」** |
    | 用刚设的密码重新登录 | 通过 |
    | 再次 `POST auth/setup` | 409 站主账号已经存在；`GET auth` 变 `{owner:false,configured:true}` |

    截图 `outputs/setup-form.png`、`outputs/setup-form-mismatch.png`、`outputs/setup-login-after.png`、`outputs/setup-after-publish.png`。服务端日志里也确认打出了 `[setup] 站主账号已创建（验收站主）…`。
  - 新增 `tests/setup.test.ts`（6 条）把服务端分支锁进回归：单独一个文件、单独一个空 `DATA_DIR`（node 的测试运行器会给每个测试文件开独立进程，所以 store 是干净的；`api.test.ts` 在模块加载时就把站主建好了，那边只剩「已经建过」这条路）。最后一条验「昵称留空」时直接用 `store.db` 删掉 `owner` 行把自己退回原始状态 —— 是测试专用后门，业务代码里没有删站主这条路。
  - 整机 `npm test` **38 项 37 通过**（失败项仍是那个预存在的 `backup.test.ts` 派生子进程环境问题），`npm run typecheck` 退出 0。

## 后续：滚动条与圆角弹窗

- 起因：用户贴了一张登录弹窗右边缘的截图 ——「滚动条像是凸出来多加的违和感好严重」。随后澄清是**登录菜单**里的，四角都是圆角，而滚动条是一条直上直下的竖条，「还是超出了圆角」。
- 先如实记下**根因是两条**，不是一条：
  1. **Windows 经典滚动条**：槽是 `#fafafa` 一类的白色，比页面底色 `#fff9ef` 还白，看着像从右边凸出来一条；滚头是 `#8a8a8a` 的冷灰粗圆头；两端还有三角箭头。整站只有收藏馆的分类标签自己关掉了滚动条，其余（整页、弹窗、Iris 侧栏、聊天记录）全是默认样式。
  2. **滚动条不认圆角**：滚动条会从滚动容器的顶边一直画到底边。弹窗 `border-radius:25px`，滚动条必然横穿两个角。
- 改版一（整站）：`::-webkit-scrollbar{width:12px}`、槽与角落全透明、`::-webkit-scrollbar-button{display:none}` 去掉箭头、滚头用 `border:3px solid transparent` + `background-clip:content-box` 从 12px 槽缩成 6px 的暖调药丸（静止 `#c9a3a6`、悬停 `#b58c90`、按下 `#a67a81`）。顺手把 `.chat-messages` 上原有的 `scrollbar-width:thin;scrollbar-color:#ead0d6` 删掉，跟整站统一。
  - **两个真踩到的坑**：
    - **颜色必须用 `background-color` 而不是 `background` 简写**。简写会把 `background-clip` 重置回 `border-box`，6px 的药丸会被撑成 12px 的满宽条 —— 这个是靠「并排渲染 6 个候选色、逐像素对比」时才暴露出来的，肉眼看图完全没发现。
    - **Chrome 121+ 的互斥规则**：`scrollbar-width` / `scrollbar-color` 一旦不是 `auto`，Chrome 会整套忽略 `::-webkit-scrollbar`。所以标准属性必须包在 `@supports not selector(::-webkit-scrollbar)` 里只给 Firefox。验收脚本里加了硬断言：Chrome 下 `CSS.supports('selector(::-webkit-scrollbar)')` 必须为 `true`、`not` 之后为 `false`，且 `getComputedStyle(html).scrollbarWidth` 必须是 `auto` —— 否则等于改了个寂寞。
  - 顺带查明一件事：**`--hide-scrollbars` 会让无头 Chromium 的 gutter 恒为 0**，之前所有验收脚本都带了这个参数，所以从来没量到过滚动条。去掉之后能正常渲染 15px 的经典滚动条，`::-webkit-scrollbar{width:23px}` 也能立刻把 gutter 变成 23 来验证规则生效。
  - 页面自己的滚动条**不在 CDP 截图范围内**（拍了右边缘 26px 整条，是空白）。所以视觉验证改成在页面里注入一个可滚动方块 —— 全局规则同样作用于它，且它**在**截图范围内。
- 改版二（圆角弹窗）：先量了一遍溢出现状（`.test-data/modal-fit-check.mjs`，六个视口高度）—— **视口高 ≥800 时建站弹窗根本不溢出**，760 才溢 20px、700 溢 71px、640 溢 122px。用户看到滚动条，说明他的可视高度大概在 760 上下（1080p + Windows 125% 缩放正好是这个数）。
- 结构上试过六种搭法（`.test-data/modal-corner-experiment.mjs`，逐像素判定而不是肉眼看图），结论：
  - **只给外壳加 `overflow:hidden` 而不留边距不够** —— 滚头从 y=11 就开始出现，还扎在 25px 的顶角弧线里。
  - 正确解法是**边距**：外壳 `padding:0 14px 24px 0` 把滚动条推进一块「安全矩形」——上方约 75px（标题栏）、下方 24px、右侧 15~27px，全部躲开 25px 的圆角弧线。
- 最终实现：
  - `Modal` 拆成两层：`<dialog class="modal">` 只管圆角 / 底色 / 阴影 + `overflow:hidden`，里面是固定的 `.modal-header` 和一个 `.modal-scroll`。**顺带把标题栏变成固定的**：长内容滚动时关闭按钮不再跟着滚走，这在收藏详情这种长文章上本来就是个真问题。
  - 窄弹窗（登录 / 建站、删除确认）内容就那么几行，干脆不显示滚动条（`scrollbar-width:none` + `::-webkit-scrollbar{width:0;display:none}`），`max-height` 也从 `85svh` 放宽到 `calc(100svh - 40px)`，只要窗口放得下就永远不出现滚动条。宽的（编辑器、收藏详情）内容可能很长，保留 `85svh` 上限和可见的滚动条。
  - 用户要求删掉建站表单底部那行「…可以在终端跑 `npm run setup-owner`」的提示；`.hint` 样式在编辑器 / 资料柜 / 布置小屋还在用，保留。
- 验收：
  - `.test-data/modal-fit-check.mjs`：改动前 `760/700/640` 三个高度溢出 20/71/122px、滚动条 14px；改动后 **六个高度（1000/900/800/760/700/640）全部溢出 0、滚动条 0px、提交按钮完整可见**，末尾文案不再出现 `setup-owner`。
  - `.test-data/modal-corner-check.mjs`（3101 测试站，登录后开编辑器）：把截图塞回浏览器用 canvas 解码，找出所有滚头色像素，再用圆角矩形公式判定有没有落在弧线之外 —— **滚到顶和滚到底都是「落在圆角外 0 像素」**；滚动区 12px 滚动条、内容 878 / 可见 658；滚到底后标题距弹窗顶仍是 28px（标题栏固定成立）。
  - `.test-data/setup-check.mjs`（全新空库 + 3102）复跑：八项全过，其中新增「弹窗有没有滚动条 → 没有（0px，内容 465 / 可见 465）」「登录弹窗有没有滚动条 → 没有」「底部 `setup-owner` 提示 → 已删掉」。
  - `.test-data/editor-ratio-check.mjs` 回归：四条用例仍全对（结构改动没带坏编辑器）。
  - `.test-data/page-shot.mjs`（新建的通用整页截图）确认首页无回归。

## 后续：密码下限从 12 位改为 8 位

- 用户要求「密码8位就行了」。
- 新增 `MIN_PASSWORD_LENGTH = 8`（放在 `src/lib/types.ts`）作为**唯一出处**，三处校验共用：服务端 `auth/setup`、终端 `npm run setup-owner`、前端建站表单的本地预校验与字段提示。放 `types.ts` 而不是 `security.ts`，是因为前端不能引用 `security.ts`（那边依赖 `node:crypto`），而这个文件本来就是纯模块（`CARD_RATIOS` / `cardAspect` 也在里面）。
- `tests/setup.test.ts` 里把原来写死的 `'elevenchars'` 换成 `'x'.repeat(MIN_PASSWORD_LENGTH-1)`，并在最后一条加上**边界断言**：差一位 → 400，刚好够长 → 201（借那条测试已有的「删掉 owner 行退回原始状态」的后门来测第二次建站）。

## 后续：站主只登录一次（会话寿命与续期）

- 用户要求：「设置一下只有我每次进去可以编辑 然后路人的话只能看 总不能我每次进去都要重新登录吧」。
- **先说结论：前半句不用改，已经是现在的行为。** 逐条核对过：
  - 所有写接口（`items` POST/PUT/DELETE、`files` POST/DELETE、`profile` PUT、`iris` 全部）都先 `requireOwner`（401）再 `requireOrigin`（403）。
  - `store.listItems(owner)` 在非站主时只返回 `visibility='public'` 的行；`getItem(id, owner)` 同理，私密条目对路人直接 404。
  - `/api/files`（列表本身）和 `/api/iris` 整体要站主身份；只有 `profile` 读是公开的 —— 首页要展示头像和昵称。
  - 前端 `space.tsx` 里私密栏目是 `{view==='files'&&owner&&<Files/>}` 这种条件渲染，而且 `go()` 对路人会先弹登录框（`privateViews.includes(next)&&!owner` → `setLogin(true)`），所以路人点「资料柜」看到的是登录提示，不是 401 报错页。
  - 编辑 / 删除按钮（`.owner-card-actions`、「记一笔 / 收一份喜欢」）全部包在 `owner &&` 里。
- **真正的问题在会话**：`sessionCookie` 发的是 `Max-Age=7*24*60*60`，而且**从来没有续期逻辑** —— 登录一次管 7 天，之后连在用的状态下也会被踢出去重输密码。用户说的「每次进去都要重新登录」，体感来源应该是这个（加上浏览器重启后 session cookie 丢失，不过这里发的本来就是持久 cookie）。
- 改动：
  - `src/lib/http.ts`：`SESSION_MAX_AGE = 180*24*60*60`（半年）作为唯一出处，`auth.ts` 里两处原本各自写死的 `7*24*60*60` 局部变量删掉。新增 `renewSession(request, response)`。
  - `src/lib/store.ts`：新增 `sessionExpires(token)` 与 `extendSession(token, expires)`。
  - `src/app/api/[...path]/route.ts`：把原来的 `handler` 拆成 `dispatch()`（业务分发）+ `handler`（`renewSession(request, await dispatch(...))`），续期统一在出口做，各接口不用各自操心。
- 三个设计决定，都是为了不做多余的事：
  - **只在剩余寿命掉到一半以下才续期**（`SESSION_RENEW_BELOW = SESSION_MAX_AGE/2`）。每个请求都写一次库、都重发一次 `Set-Cookie` 是没必要的；半年寿命下这样能保证「只要还在用，就永远剩一半以上」。
  - **续期排在业务处理之后**。登出已经把会话行删了，`sessionExpires()` 返回 `null`，续期逻辑自然碰不到它，不会把登出的会话复活。
  - 名字叫 `token.length !== 64` 就直接跳过 —— 跟 `isOwner` 同一个前置判断，不拿乱字符串去查库。
- **踩到的坑（本轮最值得记的一条）**：`renewSession` 必须**重新构造 Response**，不能直接 `response.headers.append('Set-Cookie', …)`。`Response.json()` 出来的 headers 守卫是 `"response"`，而 `Set-Cookie` 属于 forbidden response-header name，`append` 会被**静默丢弃** —— 没有报错、没有 cookie。必须 `new Headers(response.headers)`（守卫 `"none"`）之后再 `new Response(body, {…, headers})`。
  - 这条的危险之处在于：`tests/session.test.ts` 里那几条「应该重发 Set-Cookie」的断言**如果只测到这一层，是能过的**（因为库里确实续期了），而线上客户端其实一个字节都收不到。所以验收脚本里额外直接读响应头 `getSetCookie()` 来钉死这条，不能只看库里的值变了就以为成了。
- 验收（`.test-data/session-check.mjs`，全新空库 + 3102，跑完即弃；库是 WAL 模式，所以脚本能另开一条连接直接改 `sessions` 表来模拟「会话快到期」）：
  - **路人**：`GET items` → 200 只看到 1 条（私密那条没出现）；`POST items` → 401；`GET files` → 401；`GET iris/status` → 401；`GET profile` → 200（公开）。
  - **已登录 + 伪造 Origin**：403 —— 注意路人伪造 Origin 只会撞到 401，因为 `itemsApi` 里 `requireOwner` 排在 `requireOrigin` 前面，没登录就先被挡了，403 那条分支根本没机会跑。要证明同源防护是活的，必须用**已登录**的身份去打。
  - **会话寿命**：建站发的 = 180 天，登录发的 = 180 天（原来都是 7 天）。
  - **不必要不续期**：刚登录就请求一次，响应里没有 `Set-Cookie`。
  - **续期**：把库里到期时间改成 60 秒后 → 下一次请求响应里带 `Set-Cookie`，`Max-Age=15552000`，且**库里的到期时间确实往后推了 180 天**。
  - **登出**：`POST auth/logout` → 200；再 `GET auth` → `{owner:false,configured:true}`，且**没有被续期逻辑复活**（响应里没有 `Set-Cookie`）；拿登出后的 cookie 去写 → 401。
  - **过期会话**：读公开列表 200、写 401。
  - **真实浏览器（这条是用户真正在问的）**：用登录弹窗登录 → 有「退出按钮」、磁盘 cookie 剩 180 天、`HttpOnly` 是 → **关掉整个浏览器** → 用同一个 `--user-data-dir` 重新打开 → **还是站主态、没有再弹登录框、cookie 还剩 180 天、「记一笔」入口在、打开的是编辑器**。
- **关于「关掉浏览器」这个动作本身，单独写了个小实验（`.test-data/cookie-persist-experiment.mjs`）**，因为第一、二版验收都量到「重开变回路人」，一度以为是功能没生效：
  - **① `Browser.close` 后耐心等它自己退 → cookie 写进了 `Default/Network/Cookies`，退出码 0。**
  - **② 直接 SIGKILL → Cookies 库里没有这条 cookie。**
  - **③ 先导航到 `about:blank` 再优雅关闭 → 也写盘了。**
  - 结论：Chromium 的 cookie 是内存里攒着、**退出时才落盘**的，硬杀等于什么都没留下。而第一版脚本的真凶更蠢 —— 我在发 `Browser.close` **之前**就 `first.close()` 把 CDP socket 关了，那条指令根本没发出去，浏览器没走优雅退出，紧接着的补刀又把 flush 截断了。
  - 顺带一个 CDP 的坑：浏览器一关 socket 就断，**不会有任何回应回来**，所以 `pending` 必须在 socket `close` 时全部 reject 掉，否则 `await browserSend('Browser.close')` 会永远挂着 —— 第二版就是这么卡死 3 分钟的。脚本里另加了一个 150 秒看门狗兜底。
  - 这两条都写进了脚本注释，免得下次再踩。
- 新增 `tests/session.test.ts`（5 条）锁住服务端行为：登录发的是「月」不是「天」、刚登录不重发 `Set-Cookie`、过半就续期、登出后不复活、过期会话被拒绝而不是被续期。
- 整机 `npm test` **43 项 42 通过**（唯一失败仍是预存在的 `backup.test.ts` 派生子进程 `EBUSY` 环境问题），`npm run typecheck` 退出 0，`npm run build` 通过。

## 后续：修掉「请求来源不匹配」——同源校验误信 request.url

- 用户直接贴了报错文案：「请求来源不匹配，请从本站重新操作。」这是 `requireOrigin` 抛的 403。
- 复现与定位（`.test-data/origin-check.mjs` 起一个**不设 APP_URL** 的实例，交叉跑 Origin × Host 四种组合）：

  | Origin | Host | 修复前 |
  |---|---|---|
  | `http://127.0.0.1:3000` | `127.0.0.1:3000` | **403** |
  | `http://127.0.0.1:3000` | `localhost:3000` | **403** |
  | `http://localhost:3000` | `127.0.0.1:3000` | 400（放行） |
  | `http://localhost:3000` | `localhost:3000` | 400（放行） |

  也就是说**请求的 Host 头完全不影响判定，只有 Origin 用 `localhost` 才能过**。而 `http://127.0.0.1:3000` 正是 Next 启动横幅打印出来的 Local 地址 —— 按它给的地址打开，所有写操作（登录、建站、记一笔、上传、改资料）全部 403。
- 真因：**Next 的 standalone server 会把 `request.url` 的 host 写成 `localhost`**。加了个临时探针路由（`/probe`，用完即删）直接把原始值打出来，一次请求同时看到：

  | 字段 | 值 |
  |---|---|
  | `request.url` | `http://localhost:3101/probe` ← **恒为 localhost** |
  | `host` | `127.0.0.1:3101` |
  | `x-forwarded-host` | `127.0.0.1:3101` |
  | `x-forwarded-proto` | `http` |
  | `__NEXT_PRIVATE_ORIGIN` | `http://127.0.0.1:3101` |

  而 `requireOrigin` 传的第三个参数 `process.env.APP_URL` 在正式服务上是空的（没配 `.env.local`），于是 `configuredOrigin || requestUrl` 落到了那个被改写过 host 的 `request.url` 上 → Origin 永远对不上。
  - 附带确认：静态段路由 `/api/__probe/route.ts` **会被 `/api/[...path]` catch-all 抢走**（实测 404「没有找到这项内容」），探针必须放在 `/api` 之外。
- **为什么这么久没被测出来（最该记的一条）**：`tests/api.test.ts`、`tests/session.test.ts`、`tests/setup.test.ts` **每一个都在开头设了 `process.env.APP_URL='http://localhost:3000'`**，`.test-data/` 下的验收脚本也全都显式传了 `APP_URL`。这个参数正好短路了出问题的那条回退路径 —— 于是「测试全绿 + 手工验收全过」和「用户打开就报错」可以同时成立。**凡是「只有配了某个环境变量才被覆盖的分支」，验收必须有一条不配的路径。**
- 改法（不动安全语义）：
  - 判定改为「跟客户端**实际请求的那个来源**比」：配了 `APP_URL` 就以它为准；没配就用 **Host 头**（`x-forwarded-host` 优先，取逗号前第一段），协议取 `x-forwarded-proto`、没有再看 `request.url`。
  - 浏览器侧这是自洽的：同源请求的 `Origin` 与 `Host` 必然指向同一个 host:port；跨站攻击者无法伪造 `Host`。所以没有放松。
  - **有一处反而变严了**：以前拿 `localhost` 的 Origin 去打 `127.0.0.1` 是能过的（因为两边都被规范成 localhost），现在端口/主机名不一致一律 403。端口仍然参与比较。
  - `isSameOrigin` 去掉第三个参数（`APP_URL` 的覆盖逻辑移到新增的 `requestOrigin(request)` 里），新增 `requestProtocol` / `isSecureRequest`。
- 顺手修了同一处隐患：`sessionCookie` 原来用 `process.env.APP_URL || request.url` 判断要不要加 `Secure`，而 `request.url` 恒为 `http` —— 也就是**用 https 部署但忘了配 `APP_URL` 时，cookie 永远不会带 `Secure`**。现在会考虑 `x-forwarded-proto`（Caddy 会带）。
- 回归测试（`tests/security.test.ts` 从 1 条扩到 3 条）：新增「同源判定跟 Host 头走，不跟 request.url 走」，覆盖 127.0.0.1 与 localhost 双向、跨站 Origin、端口不一致、以及配/不配 `APP_URL` 两种模式；另一条覆盖反代 https 下的 `Secure`。
  - 一个细节：这条测试往 `new Request()` 里塞了 `host` 头。浏览器里 `Host` 是 forbidden request header，Node 的 undici 目前**不**剥离它，但这是实现细节，所以测试开头先断言 `request.headers.get('host')` 真的拿到了值 —— 将来 Node 若开始剥离，测试会直接炸，而不是空转通过。
- 验收（`.test-data/origin-check.mjs`，**刻意不设 `APP_URL`**，临时库，不碰 `data/`）：
  - 服务端：伪造来源 403、无 Origin 403（都没放松）。
  - 真浏览器从 `http://127.0.0.1:3102` 进去：锁图标是「设置站主账号」→ 填两次密码提交 → **弹窗关闭、页面无报错、进入站主态、会话 cookie 180 天且 HttpOnly、「记一笔」入口在**。修复前这一步必定是「请求来源不匹配」。截图 `outputs/origin-fixed-127.png`。
  - 换 `http://localhost:3102` 进同一台服务：页面正常、锁图标在（cookie 按 host 分开存，所以换 host 是未登录态，符合预期）。
  - 直接 curl 四种组合复验：`127.0.0.1→127.0.0.1` 放行、`localhost→localhost` 放行、其余组合 403。
- 整机 `npm test` **45 项 44 通过**（唯一失败仍是预存在的 `backup.test.ts` 本机 `EBUSY`），`tsc` 退出 0，`npm run build` 通过。3000 已用**不带 `APP_URL`** 的方式重启，与正式部署形态一致。

## 后续：每个栏目一套自己的章节头，主页 Hero 只留主页

- 用户要求：「头部点击的每个首页我希望都不一样 不要每一个都是主页的样式，比如那个大头像和左边的把喜欢慢慢收藏这个在主页显示就行了」。
- 现状：所有栏目共用同一个 `welcome-hero`，非主页只是加 `compact-hero` 把它等比缩小 —— 所以大头像 / 唱片、「把喜欢，慢慢收藏。」、副标题、三个标签**在六个页面上一字不差地重复**。每个栏目其实早就各有自己的标题区（生活碎片 / 收藏馆 / 我的资料柜 / Iris，陪你整理 / 布置我的小屋），问题是头顶那套 Hero 把它们的差别盖掉了。
- 改法：
  - 新增 `sectionBanners` 配置（`space.tsx` 模块级），五个栏目各一条：栏目图标 + 一句写给这个栏目的话。
  - Hero 改成 `{view==='home'? <welcome-hero> : <section-banner>}`；`.section-banner` 里是「圆角图标徽章 + 那句话 + 同款图标放大成淡色水印」。
  - **章节头刻意不带标题**。各栏目的标题和动作按钮（记一笔 / 上传资料 / Iris 连接状态）都还在它们自己的标题区里，搬到上面来只会把同一句话说两遍。章节头只负责气氛，栏目自己保管自己的名字。
  - 五套配色都在原有的奶油 / 暖棕范围内，**没有任何蓝紫**：生活碎片暖棕 `#c0906c`、收藏馆玫瑰 `#bd8aa0`、资料柜沙色 `#a8907b`、Iris 鼠尾草绿 `#98a07b`（复用已有的在线小圆点那个绿）、布置小屋陶土 `#b8836f`。
- **顺手删掉了整套 `.compact-hero`**：四个断点里二十多条覆盖规则，存在的唯一目的就是「让一个共用 Hero 服务六个页面」—— 那正是问题的根源。章节头自己写了 1100 / 850 / 640 三档。
- 两个必须说清的连带影响：**「小屋寄语」（`daily-quote`）和「向下滚动」提示原本长在 Hero 里**，现在也变成只在主页出现。寄语是「小屋寄语」，放在主页读起来是对的，但用户如果想留着，可以挪到页脚。
- 验收（`.test-data/section-check.mjs`，临时库 + 3102，**不设 APP_URL**；会先把站主建出来并造两条内容，免得栏目页全是空状态看不出样子）：
  - 主页：`welcome-hero` 在、`.section-banner` 不在、`h1` 文本正是「把喜欢，慢慢收藏。」、`.welcome-subtitle` 在、唱片 / 头像在。
  - 其余五个：`welcome-hero` 不在、`.section-banner` 在且 `banner-*` 类正确、各自的图标与淡色水印都渲染出来了、**`h1` 为 null、`.welcome-subtitle` 为 null、唱片 / 头像都不在**。
  - 六个页面全部通过，顶部各截一张图：`outputs/section-home.png` / `section-life.png` / `section-collection.png` / `section-files.png` / `section-iris.png` / `section-settings.png`。
- **断言踩的坑（值得记）**：第一版用 `document.body.innerText.includes('把喜欢')` 判断「主页元素还在不在」，结果五个栏目全部误报成「没改干净」—— 因为**空状态文案里那句「……把喜欢的，都收进来。」**也含这三个字。改成直接读 `h1` 元素本身的文本（`textContent.replace(/\s+/g,'')==='把喜欢，慢慢收藏。'`）与 `.welcome-subtitle` 是否存在，才是有意义的断言。**拿整页文本做包含判断，很容易被别处的巧合文案骗到。**
- `npm test` **45 项 44 通过**（唯一失败仍是预存在的 `backup.test.ts` 本机 `EBUSY`），`tsc` 与 `npm run build` 均退出 0。


## 后续：栏目切换从透明逐渐显现（2026-10-02）

- 用户要求每次切换页面从空慢慢显现，可参考 https://yaronluo.com/。参考站页面可读，动态浏览检查超时；最终按用户描述实现。
- 将原先只有正文的 400ms 入场替换为统一的 page-reveal：栏目头/主页 Hero、侧栏、正文、页脚使用透明度 0→1 与向上归位 16px，620ms，后三层延迟 60/120/180ms。顶栏和背景持续保留。
- 展示区域按栏目更换 React key；各区域 key 加独立前缀，避免兄弟节点使用相同 key 后残留旧节点。浏览器返回改变 view 也会重播；搜索和数据更新不重新挂载展示区域。
- 动画只在 motion-on 生效，沿用现有动效开关与系统偏好的优先级；关闭时 opacity=1、animation=none。移除旧 section-enter 动画，避免正文两次叠加。
- 浏览器验收使用 3103 临时库和测试账号，没有修改正式资料：六页均从透明开始；逐次读计算样式确认透明度升高；1 秒后四层 opacity=1；连续切换仅有一份栏目头、侧栏、正文；返回重播；搜索不重播；关闭动效立即显示。结果 .test-data/page-reveal-check.json，截图 outputs/page-reveal-preview.png。
- npm test 45/45 通过，生产构建与 TypeScript 检查通过；3000 正式预览已重启。

## 后续：头像裁剪、文案与部署安全（2026-10-02）

- 用户要求头像选图后调整位置和缩放，移除“快乐追星”和收藏馆“一张专辑”；完成后开始安全加固，比较便宜部署方案。用户明确先只部署小屋，Iris 后续接。
- 头像新增独立裁剪弹窗，圆形预览、Pointer Events 拖动、100%–400% 缩放、方向键、重置与取消。预览与 canvas 导出使用同一 source-pixel crop；边界夹紧避免空白，导出 512×512 PNG。确认上传到布置草稿，保存布置才公开；取消不上传；GIF 转静态。通用 dialog 的 Escape 经 onClose 决定是否关闭，避免上传中默认关闭弹窗。
- 在 3103 隔离数据库用 900×600 三色测试图实测鼠标拖动到红色区域，导出后 sharp 验证 512×512 且 RGB 均为 196/91/100；匿名读取保存前 401、保存后 200。手机 390×844 布局裁剪框 250×250、无横向溢出、确认按钮完整；CSP 下重复选择、缩放、键盘与保存仍正常。截图 outputs/avatar-crop-preview.png、avatar-crop-mobile.png；没有修改正式个人资料。
- 安全审计发现全局失败锁可能被攻击者用于阻止站主登录。改为受控 Caddy 地址的失败计数（10 次/15min）和请求限流（30 次/min），正文 8KB，SQLite 持久化并清理过期记录。Caddy 覆盖专用 IP 头，Compose 内部 3000，显式 TRUST_PROXY=1；本地不信任代理头。
- 独立代码审查复现并发慢正文绕过失败检查：30 个请求可一起通过读取前检查。新增延迟正文回归先观察 30 个 401，再在正文读取后重新检查，使其变为 10 个 401 + 20 个 429；修复已通过。
- 公开部署关闭网页 setup；Docker 启动前只读验证 HTTPS 来源和有效 scrypt 账号，缺少数据拒绝启动且不创建空库。应用 node 用户、禁新增权限、cap_drop ALL、进程上限 128；构建忽略环境文件、数据、测试和截图。
- 根 HTML 使用随机 nonce CSP；现有 React 主题/位置保留行内样式，生产脚本不放行 unsafe-inline/eval；API 附件保持 sandbox。增加 Permissions-Policy，Caddy HSTS、22MB 请求限制。生产 HTTP 两端口检查9个脚本nonce一致、每次nonce变化、HTML no-store；附件CSP未被覆盖，浏览器无控制台错误。
- npm 官方源生产依赖审计 0 个已知漏洞；默认 npmmirror 审计接口不支持，本轮显式指定官方源。完整 npm test 56/56、typecheck、build 通过。
- 最后一次生产构建后，实际 3103 HTTP 服务重复并发慢正文验收：10 个错误密码响应 401、20 个请求响应 429；另一地址正确登录 200。3000 预览 200、脚本 nonce 匹配。结果 .test-data/security-live-check.json。
- 新增 docs/安全与部署建议.md，列出香港 38 元/月、海外 30 元/月 2核2G等官方价格，明确跨境网络限制、ICP与公安备案区别以及云端验收边界；没有购买、部署或接入外部防护。当前机器无 Docker/Caddy，真实容器、证书、防火墙、恢复仍待云端验证。

## 后续：直接点击头像与收藏入口留白（2026-10-02）

- 按用户截图移除布置页独立选图按钮，头像本身改为带无障碍名称的圆形按钮，通过 ref 打开隐藏文件输入；保留原裁剪、上传与保存流程。
- 收藏入口缺少基础布局规则，浏览器复现桌面 display:block、padding:0。补齐 flex 横排、24px 留白与间距；手机使用双列 grid、20px 留白，入口按钮与文案左侧对齐。
- 生产构建与类型检查通过。3103 隔离库实测头像 Enter 打开选图、选择测试照片进入裁剪、取消正常；桌面卡片图标距边约 25px，390px 手机左侧约 21px，无横向溢出、文字和按钮对齐。浏览器无错误；3000 已重建重启。截图 outputs/avatar-click-preview.png、collection-invitation-fixed.png、collection-invitation-mobile-fixed.png。

## 后续：分类建议菜单统一主题（2026-10-02）

- 用户指出分类输入框的原生 datalist 弹层灰白样式不符合主题。仅替换生活/收藏编辑器的分类建议，不改变分类数据或其他控件。
- 新增 category-input.tsx：可自由输入的 combobox，输入时过滤、箭头展开全部建议、鼠标选择、方向键/Enter、Esc 仅收起建议、Tab 离开收起；保留 40 字限制。根据弹窗内可用空间选择向上或向下展开，限制列表高度。
- 奶油背景、柔粉选中与悬停、15px 圆角及柔和阴影。修正外层 label 默认激活造成点击选项后再次打开的问题，选项点击取消默认行为。
- 类型检查与最后生产构建通过。隔离库浏览器验证选择电影后正确收起、方向键选择音乐、输入旅行日记、输入“动”只显示动漫、Esc 保留编辑弹窗、Tab 收起；390×844 菜单完全位于滚动区内、无横向溢出、选择后收起，控制台无错误。截图 outputs/category-menu-themed.png、category-menu-mobile.png。正式 3000 预览已更新，未写入正式个人资料。

## 后续：完整 Cloudflare 适配与部署准备（2026-10-02）

- 用户从 Drop 展示包改为完整 Workers 版本，随后授权实际部署并完成 CLI OAuth。
- API 复用原权限与校验逻辑，以请求级 SiteStore/配置接入 Node SQLite 与 CloudStore D1/R2。Node 文件读写下沉至存储，Worker 不包含 node:sqlite 或 node:fs。D1 对附件累计尺寸做原子检查，并发密码校验前原子预留失败预算。
- 审查指出 workerd 的异步 scrypt 仍占当前 CPU；改为浏览器 noble scryptAsync 保留旧参数和 ASCII 盐，Cloudflare 保存 SHA256(K)、常量时间对比。两种 Unicode 密码与 Node 结果完全一致，验证值不能直接登录；不降低密码强度、不写本地存储。
- 导入 SQL 按 7000 Unicode codepoint 分块，单语句小于100KB，首块替换后追加，重复初始导入保持长文本完全一致；账号最后插入，复跑检测已有账号避免重置云端数据。公开资源与账号/记录/文件迁移资料分离，忽略旧会话和 Iris 配置。
- 本地 workerd 验证 bootstrap 公开范围、密码登录、HttpOnly/Secure cookie、来源拒绝、R2私有附件、头像公开、上传/下载/删除、使用中头像不可删、未接 Iris 503、20并发10次401/10次429、其他IP登录。58项回归通过。浏览器3104验证原密码、头像缩放上传/保存、生活记录分类音乐并私密保存、390px无溢出和坏图、退出隐藏测试记录，无控制台错误。
- Next构建/typecheck/Wrangler deploy dry-run成功；生产audit0。独立审查修复R2 bucket list的provideConfig:false：每个命令显式设置已选CLOUDFLARE_ACCOUNT_ID。
- 真实执行部署脚本已创建 D1，随后 R2 API 返回10042；用户已选择继续R2开通。尚未迁移或发布，后续续用现目录与数据库，不能标记为上线完成。

## 后续：当前 Cloudflare 账号实际发布（2026-10-02）

- R2 开通并重新 OAuth 后发现账号变化，脚本按保护规则停止。用户明确选择当前账号后，备份旧绑定并在新账号创建 D1/R2，迁移原密码校验、1 条记录和头像，成功发布 little-world-edb34d；控制面确认版本 c259ef19-885e-490d-95f8-48f43c616d21 100% 流量。免费网址 https://little-world-edb34d.y-log--loudflare--ull-20261002.workers.dev/ 。旧账号空 D1 未删除，未升级 Workers 套餐。
- 真实云端 D1 查询 owner/items/assets 数量各为 1；通过 R2 CLI 下载头像，312735 B 且 SHA-256 与原件一致；r2.dev 公共访问关闭。
- 本机 Node fetch 连接超时，浏览器 ERR_SSL_VERSION_OR_CIPHER_MISMATCH，系统 DNS 与另一 HTTPS DNS 返回非 Cloudflare 异常地址；指定 Cloudflare IP 且保留 TLS 验证的请求遭连接重置。Wrangler 远程调试启动成功但请求仍超时，已停止临时调试进程。因此公开网址的登录/编辑/20 MiB 上传尚未验收，没有声称其通过，未改系统网络配置。用户选择保留免费域名。
- 保留 .test-data/cloudflare-live-check.mjs 供网络可达后执行，凭据只存在进程内，验收使用有唯一标记的私密记录和文件并清理，避免修改真实用户内容。部署包按当前账号的实际编号更新，排除 .wrangler 缓存和原账号备份。

## 后续：实际域名与代理排查、云端验收（2026-10-02）

- 用户询问访问失败，核对部署版本、静态头规则和绑定仍正常。通过 CLI 已有授权只读查询 Cloudflare API，确认当前账号子域名变为 yuehaiworld，脚本的 workers.dev enabled=true；有效网址 https://little-world-edb34d.yuehaiworld.workers.dev/ 。旧发布日志网址已失效，不应继续发给用户。
- 新域名直连解析为异常地址，curl/Node 超时。只读检查 Windows 网络设置，发现原有系统代理已启用；原先 Node/curl 直连验收没有使用代理。通过现有代理发送请求，保留 HTTPS 证书校验，主页及 auth API 200，未修改注册表、DNS 或代理规则。
- 执行 cloudflare-live-check.mjs 对实际公开网址验收：原账号登录、HttpOnly/Secure 会话、私人记录创建/编辑、CSRF 403、迁移头像公开可读、迁移 SQL/配置404、私人文件匿名401、64 B 和 20971520 B 上传/下载完全一致、未接 Iris503、退出失效全部通过。专用测试条目/文件清理完成；真实 D1 再查询 owner/items/assets各1，sessions0。没有更改用户记录、头像或密码。
- 更新中文状态说明和交付包的当前网址，标注直连网络问题及浏览器需使用既有代理；免费域名保留，不购买域名或升级 Workers。

## 后续：缩短免费网址（2026-10-02）

- 说明 workers.dev 格式要求保留应用名，用户选择 home.yuehaiworld.workers.dev。通过官方 PATCH `/accounts/{account}/workers/workers/{worker_id}` 仅更新 name，原地改名为 home；不可变 Worker ID 与生产版本不变，没有新建另一个应用或重导入用户数据。
- 本机部署包 wrangler.jsonc 的 name 同步 home，Cloudflare API 列表确认仅同一 Worker、免费域名入口启用；最终网址 https://home.yuehaiworld.workers.dev/ 。新网址重新完成生产 API 登录、编辑、CSRF、64 B/20 MiB 私人上传下载和退出清理验收；原代理/TLS 校验保持。
- 更新中文说明、状态文档与 ZIP，未来部署沿用 home 和原 D1/R2 绑定，避免恢复旧应用名。

## 后续：本地人物收藏与更新教程（2026-10-02）

- 只读取用户指定 MobileFile 的人物目录，177 张图片去除 5 张完全重复文件；最终导入 172 张公开本地收藏（Jennie 117、Jisoo 36、Karina 10、ROSÉ 9），一图一卡、原图比例、首屏交错，0 跳过。
- 用户明确允许本地转换 3 张伪装 JPG 的 HEIC，使用既有 FFmpeg 创建 JPEG 副本。原素材不变；导入前备份 .test-data/collection-before-20261002，manifest 在 outputs/collection-photo-import-20261002.json，均不提交或上传。
- 校验 172 个本地 HTTP 图片为 200，MIME 和 SHA-256 对应原件/转换副本；原账号、个人设置及已有记录保持。浏览器四个人物筛选正确、无坏图或横向溢出，截图 outputs/collection-photos-local-preview.png。
- 新增 update:cloudflare 命令；只刷新已部署包的代码和幂等建表 SQL，保留 config/state/private-import 的原字节，测试先失败再通过。发布时先建缺失表，再 Wrangler deploy，不运行首次迁移或本地数据导出。教程明确后续更新无需打包或 Drop，代码发布与本地内容同步分开。

## 后续：卡片每日点赞（2026-10-02）

- 用户新增“每个用户每天一次并记录”，沿用现有心心并常驻显示总数；无注册的访客通过服务端 HttpOnly Cookie 按浏览器识别，日期由服务器按北京时间确定。再次点击不取消；清除 Cookie/换浏览器视为新访客，未声称实名唯一。
- SQLite / D1 新建 item_like_visits（每个访客每张卡最近日期）及 item_like_counts（累计数），唯一约束 + INSERT/UPDATE 触发器原子更新，只接受严格更新的日期，跨日延迟旧请求不能重置日期。删除卡片级联清理；GET 批量最多 80，私人范围按现有权限，写操作需同源且限速。
- 新增本地 API 测试先确认 404 后实现通过；验证两访客、同日/12 并发去重、北京时间午夜、次日、重启、跨站403、私人隐藏、缺 Cookie400、限流429与删除清理。真实 workerd/D1 16 并发仅增加一次，第二访客累计2。
- 最终 typecheck、66 项测试、Next 生产构建、更新包编译与 Wrangler dry-run 通过。3000 生产预览已重启，浏览器实际点击累计加1并显示当天实心，刷新和人物筛选后保留。446px 窄屏无横向溢出，全部9张图可读，心心均在卡片内且与分类标签至少留75px；无控制台错误。详情可打开/关闭。用户并行试用的点赞保留，未清空计数。截图 outputs/collection-daily-likes-preview.png。
- 按代码审查技能由既有 security_review 做一次只读审查，发现旧日 POST 延迟响应可覆盖新日 GET 状态。已用 snapshot 绑定日期和状态，拒绝旧日覆盖、跨日 GET 批次重读；纯函数回归先复现错误再通过，另防止同日旧 GET 抹掉刚完成的点赞。审查其余范围无阻塞项。Wrangler 本地完整 schema 文件执行及复跑均14条成功，未访问远程 D1。
- 当前未 --deploy，未上传新增照片，不修改线上数据或 DNS/代理。针对用户加速器疑问再次实测线上网址：直连5秒超时，既有代理 HTTPS200。仅说明当前网络结果，没有推断所有网络必须代理。

## 后续：手机线上访问诊断（2026-10-02）

- 用户确认手机打不开的是线上 home.yuehaiworld.workers.dev，且没有开启加速器。保留本地只监听127.0.0.1的设置，未调整 LAN 或防火墙。
- 再次对照 HTTPS：本机直连5秒超时，现有代理200。直接使用已缓存 CLI Token 查询控制面先收到401；由 Wrangler 自动续期已有 OAuth 后，再查 API 成功，当前 home 免费公开入口 enabled=true，网址正确。没有启动新的登录授权流程。
- 结论仅限已实测网络：站点公开入口正常，手机可能遇到默认域名直连可达性问题；没有直接测试手机，不声称已修好手机。给出手机系统浏览器、Wi-Fi/移动数据对照、已有代理全局模式测试，以及自有域名接入/绑定步骤。未购买域名、变更真实 Cloudflare 配置或上传本地内容。

## 后续：发布人物收藏和每日点赞（2026-10-02）

- 用户决定先搁置手机直连问题，并明确要求“现在先把这些上传吧”。按既有授权账号和原 home / D1 / 私有 R2 发布，未购买域名、调整代理或升级套餐。
- 发布前重新执行 typecheck、npm test，66 项全部通过；CLI 账号与部署配置匹配。读取实际云端数据备份至 backups/cloudflare-before-photos-20261002，原有条目 0、附件 1、用户会话 1。保存应用表、SQL 结构、R2 原头像；先用内存 SQLite 验证增量 SQL 重放不会覆盖原数据或重复插入。
- 实际执行 npm run update:cloudflare -- --deploy，远程幂等结构导入 14 条成功，新代码版本 f6accec2-23ab-413b-a2fe-f67811400833。Worker 名、账号、D1/R2 绑定和部署状态文件字节保持；没有运行 private-import/data.sql。
- 只同步原本地导入 manifest 的 172 个收藏与附件（Jennie 117、Jisoo 36、Karina 10、ROSÉ 9，共 153461703 字节），先上传文件后插入记录，冲突时拒绝覆盖。没有同步本地测试点赞。批量上传发现 Node 内置 fetch 与项目 ProxyAgent 的 Buffer 请求兼容问题，通过同库 fetch 对照定位并修复操作脚本；未修改产品代码。
- 通过既有代理核验真实线上 HTML200、JS/CSS 与新构建摘要一致、全部172张匿名图片200且 MIME/SHA-256对应原件；原密码登录成功，Secure/HttpOnly、来源拒绝、私人内容权限保持。专用私密卡片的同访客8并发仅累计一次，第二访客累计2，刷新读取保留；之后删除测试卡片及其点赞并退出验收会话。
- 最终 D1 有172张收藏、173个附件，原账号、设置、头像原件与已有用户会话保留。SQL结果比较遇到SQLite返回无原型对象与HTTP普通对象的差别，规范化后只读复核通过，未再写云端数据。报告 outputs/cloudflare-photos-live-check-20261002.json 和 outputs/cloudflare-photo-sync-20261002.json。
- 线上浏览器导航本次超时，未取得线上截图；验收证据为实际 HTTPS/API 与全量原件校验，本地视觉截图继续保留。线上收藏馆标签已请求在 Codex 打开（queued）。没有声称解决手机不开加速器访问的问题。

## 后续：关于我、统计与素材迁移，本地状态（2026-10-02）

- 已实现关于我及站主编辑；用户兴趣为永劫无间、CS2、K-pop音乐、韩剧、仙侠国漫、K-pop短视频剪辑。隔离3105库完成编辑、增删兴趣、保存和刷新保留，未修改正式个人设置。
- 新增公开stats接口、SQLite/D1原子PV/UV计数、事件去重及公开内容汇总；72项全量测试通过。真实workerd/D1包含16并发重放去重及不同事件计数。关于我/统计桌面及手机预览已检查。
- 用户明确批准迁移旧YOcean站并保留40/70/45/20元价格。读取旧库14a6fcca9f579255c4b54535da50fee42657b819，将18张公开原件复制到public/editing-materials，8,756,885字节；原库不改。Next start、Docker和Cloudflare编译携带公开文件。新增打包测试先失败后通过，逐文件源/本地/Cloud包/HTTP摘要一致。
- 三图集循环切换、大图/Esc、二维码及复制、返回与公开统计接入已验收；320/360/480页面无整体横向溢出，768导航胶囊边缘问题通过820断点修正。聚焦审查发现纵向拖动误开Modal，真实浏览器先复现再修复；最新Next构建通过。**复验已完成**：该修正后的交互用 Playwright 可信事件在真实浏览器复验 6/6 通过、0 页面错误（纵向/斜向不误开、横向切图 1/4→2/4、点击打开、Esc 关闭、820px 导航无横向溢出）；携带修正的更新包 `npm run update:cloudflare` 重新准备、`wrangler deploy --dry-run` 再次通过（25 个资源、D1/R2/Assets 绑定齐全）。均未上传或发布。
- 用户要求立即输出状态文档，已优先更新docs/项目状态总结.md，包含已完成、结构、参数、问题、下一步五节，明确新模块本地完成、未发布。当前没有--deploy，没有写远程D1、上传R2、改网络、提交或推送；线上仍为f6accec2-23ab-413b-a2fe-f67811400833。

## 后续：内容管理、数据库草稿与导航折叠（2026-10-03）

- 站主内容管理新增日常／文章／观后感独立列表、分类／日期／可见范围／发布状态筛选，以及编辑、发布／撤回与首页置顶。观后感类型独立于电影／韩剧等分类；旧记录默认已发布。
- 编辑器新增持久化保存草稿，保留临时标签页草稿与格式配置；Node 与 D1 同时限制草稿的记录、附件、点赞和公开统计。PATCH 管理操作保留正文与照片并验证站主及请求来源。
- 用户要求简化头部与主题下拉框：内容管理、资料柜、Iris、小屋统计统一折叠到小屋工具；管理中心使用奶油色圆角选项菜单、粉色选中状态与键盘操作，修正搜索框双层边框。
- 类型检查、135 项测试及正式构建通过。隔离端口 3002 完成草稿重开、发布、类型与分类独立、日期、置顶与撤回、访客 404、菜单原位导航和手机布局验证；截图见内容管理计划。原数据未添加测试内容，3000 开发服务已重启，未提交或部署。

## 后续：小屋工具悬停、照片归类与小卡入场（2026-10-03）

- 小屋工具支持鼠标移入展开、移出 160ms 后收起；菜单与按钮之间增加透明连接区，跨越空隙不误关。折叠箭头使用 240ms 旋转过渡；点击、键盘与触屏继续可用。实测观察到旋转中间帧，菜单选择后收起。
- 本地实际 173 张收藏照片均已有小卡标签；将其中 162 条重复的照片标签合并进小卡，173 条记录统一归类。事务与逐条比较保证人物分组、标题、正文、公开范围、图片与其他字段保持。原记录备份 outputs/collection-photo-tags-before-2026-10-03T08-07-22-771Z.json，脚本 outputs/merge-photos-into-small-cards.ts；API 复核 173 条小卡、0 条旧照片标签。
- 收藏卡片增加按顺序错开的透明度渐显，保留悬停位移与原布局；浏览器确认入场透明度从 0 到 1，关闭动效后动画取消并直接显示，无坏图、横向溢出或浏览器错误。截图 outputs/collection-small-cards-fade.png。
- 类型检查、7 项内容管理与 4 项收藏相关测试通过；本地开发服务 3000 保持运行，未提交或部署。

## 后续：访客署名与文章评论（2026-10-03）

- 访客仅填昵称即可署名，按用户最新要求只在首次评论时填写，浏览页面无需署名；评论区可改昵称，浏览器身份记住昵称。公开文章／观后感增加主题评论区，提交后直接公开，支持分页与纯文本；改名保留历史署名。
- Node SQLite 与 D1 保存昵称、评论和作者身份；仅真正站主显示专属标记，本人和站主可删除。私密／草稿评论对访客返回 404，公开状态在插入 SQL 中再次确认，删除文章级联删除评论。访客发表限制 5 条／分钟，同源与字段长度校验继续生效。
- 新增 7 项测试先失败后通过；全套 142 项、类型检查和正式构建通过。D1/Worker 测试包含昵称、留言、归属、撤回与删除。隔离 3002 浏览器完成署名／改名／刷新／普通文字／本人删除／站主回复与删除验收，桌面和手机截图见访客评论计划；错误日志为空。
- 正式数据仅自动新增空表，验收名字和留言全部使用独立库；完整数据库备份包含新增表。3000 开发服务保持运行，未提交、推送或部署。

## 后续：统一头部、编辑关闭与代码块（2026-10-03）

- 文章、地图与时光轴的 Next 路由全部进入 Space；文章嵌入下方，站内链接、前后篇与浏览器历史恢复内容时头部持续保留。直接访问仍执行服务端文章权限检查；文章内分类与专题回到原位地图，导航从独立地址切换时规范化为根页面。
- 字号与封面位置复用主题下拉框；关闭未保存编辑改为顶层确认弹窗，支持继续、放弃与保留草稿重开。嵌套 Modal 的 Escape 不传播至下层。
- 仅将 Markdown 顶层缩进代码节点重解析为普通缩进段落，围栏代码保留原格式。新增代码输入按钮、语言选择与等宽字体卡片，包含反引号的粘贴内容不会截断代码块。
- 相关回归先失败后通过；最终类型检查、148 项测试与生产构建通过。隔离 3002 浏览器检查头部、分类返回、刷新、字号、缩进、代码插入预览、滚动后关闭与草稿重开，以及桌面／手机布局；浏览器无错误。截图与日志见共享头部计划。
- 验收草稿、测试会话与服务已清理，正式记录未修改，本地 3000 保持运行，未提交或部署。

## 后续：文章排版、箭头悬停与编辑空间（2026-10-03）

- 按参考文章结构增加分级标题、圆点／编号列表及引用主题排版，编辑器提供对应按钮和 Enter 续写／空白项退出；显式围栏代码保留正常输入。
- 用户要求新写内容默认公开：只调整新建日常／文章／观后感的编辑初始值，旧记录与草稿保留所选范围。跳转箭头统一主题粉色，悬停渐显轻移，窄屏／触屏／关闭动效直接显示。
- 小屋工具改为收纳箱图标，文章／观后感编辑加宽至 1060px、92svh，手机接近全屏；未保存确认继续正常。
- 类型检查、152 项测试和生产构建通过；隔离浏览器桌面／手机实测列表、公开默认值、箭头动画与专题点击、大编辑窗口及关闭确认，无错误。详情与截图见文章排版计划；草稿与服务清理，正式数据未写入，3000 保持运行，未提交或部署。

## 后续：文章自动目录（2026-10-03）

- 三级标题在现有 Markdown 渲染链中生成稳定唯一 ID，重复标题不会冲突；目录读取真实正文节点，代码和普通文字不误收，没有标题不展示空目录。
- 桌面目录在正文右侧粘附显示；手机默认折叠、选择章节后收起。滚动高亮、点击定位、复制章节链接、直接访问／刷新／历史返回支持，定位留白根据共享头部尺寸自适应。
- 4 项回归先失败后通过，类型检查、156 项测试、正式构建通过；隔离桌面／手机实际验证定位、复制粘贴、重复标题、平滑／键盘／关闭动效与无标题布局，浏览器错误为空。
- 测试文章已逐字节恢复，未提交留言，独立服务与页面清理，正式 3000 运行，未提交或部署。证据见文章目录计划。

## 后续：正文插图（2026-10-03）

- 编辑工具栏从已上传文章照片中选图，按光标位置插入，不删除选中文字；支持说明、普通／通栏宽度、预览及点击放大。说明转义处理，正文只加载当前文章附件，代码框内图片语法保持代码。
- 图片配置随已有 Markdown 正文保存，自动进入草稿与备份，无新依赖或数据库迁移。封面独立，底部图库根据真实正文渲染排除已使用图片，标题目录继续工作。
- 新增 5 项行为回归先失败后通过，全套 161 项测试、类型检查与正式构建通过。隔离桌面／手机验证插入、草稿重开、保存／刷新、独立封面、两种宽度、放大／Escape、访客查看与无横向溢出，浏览器错误为空。
- 测试文章逐字节恢复，测试账号退出、临时页面与独立服务清理，正式 3000 保持运行；未提交或部署。截图与日志见正文插图计划。

## 后续：全站搜索小弹框（2026-10-03）

- 头部搜索图标展开正下方居中的主题小框，保持当前页面和地址；输入后显示四类筛选与短摘要，安全高亮、标题优先、多词匹配，访客不显示私密和草稿。结果按 20 条展开、框内滚动，文章进入阅读页，日常和收藏复用详情。
- 按用户新截图将搜索页改为弹框，撤销本轮搜索路由；输入只留一个叉，搜索框底色不随输入焦点和分类变化，手机高度随头部及可视区域调整。没有新数据库、接口或依赖。
- 最终 8 项搜索回归、全套 169 项测试、正式构建及随后类型检查通过。浏览器验证单叉、固定底色、居中、原页保留、文章、收藏、日常、无结果、清空、Escape 和 390px 手机；隔离账号验证私密与草稿权限。
- 测试账号退出、临时服务关闭，未改写正式记录或附件，3000 保持运行，未提交或部署。证据见全站搜索计划。

## 后续：留言管理（2026-10-04）

- 入口为“小屋工具 → 内容管理 → 留言”。按文章／观后感汇集昵称、正文、时间与归属，支持全部／未读、分页、刷新、已读标记及主题删除确认框。
- 已读状态写入关联表，站主留言不计未读；Node 与 D1 同步，随完整备份及迁移保存。站主列表不返回访客身份哈希，原文章私密与草稿访问规则继续生效。
- 查看原留言保留共享头部并精确定位，支持第一页以后的评论、直接刷新、查看最新留言以及返回时保留留言标签。手机四个管理标签同行，无横向溢出。
- 四项新增回归先失败后通过，全套 173 项测试、正式构建、类型检查通过。隔离浏览器验证双向标记、筛选、计数、刷新、较早留言定位、私密文章、删除弹框及取消、桌面与手机布局，错误为空。
- 验收记录恢复比对、临时服务和页面清理，正式 3000 本地运行，未提交或部署。证据见留言管理计划。

## 后续：站主关联回复（2026-10-04）

- 每条留言配一段站主回复，管理列表与文章评论区共用行内表单；嵌套展示、署名与站主标识，修改保留首次署名与时间，删除前确认。取消未保存修改时提示，保存失败保留输入。
- 新增 `comment_replies` 外键关联表，Node／D1 共用批量查询和写删 SQL。回复只允许站主写入，继承父文章权限，保存标记原留言已读，不改变评论排序、计数及定位；删除父留言自动清理。
- 四项接口回归先失败后通过，增加完整备份恢复测试；全套 178 项测试、生产构建与类型检查通过，D1 验证迁移和写删权限。
- 隔离浏览器验证发布、修改、刷新、未保存确认、会话失效时输入保留和重试、删除确认、私密及访客显示。390px 手机无横向溢出，编辑操作正常。
- 验收记录恢复比对一致、临时服务及页面清理，正式 3000 重启使用新表，未提交或部署。证据见关联回复计划。

## 2026-10-04：回收站

- 普通删除及收藏批量删除改为软删除，小屋工具增加仅站主回收站入口；恢复原记录、时间、范围、照片、标签及留言／回复／点赞，永久删除必须中央确认。
- 新增幂等 item_trash 标记表，正常列表、详情、留言管理、公开图片、点赞和统计隐藏移除内容；附件引用与清理保护仍包含回收站。永久删除清理关联记录，原照片留在资料柜。
- Node／D1 共用查询，备份恢复与 Cloudflare 迁移保留标记；创建重试不能覆盖回收站内容。
- 六项核心测试先失败后通过，并加入完整备份恢复测试；全套 185 项、生产构建及类型检查通过。桌面及 390px 手机验收正常，刷新与返回保留头部和回收站，刷新列表不闪空。QA 临时记录清理后原九条 JSON 一致。本地服务重启，尚未提交或部署。

## 2026-10-04：文章分享卡片

- 公开已发布文章与观后感底部提供主题小浮层，复制规范文章链接、预览及下载 1080×1440 PNG；包含封面／无封面底图、标题、摘要、日期、阅读信息与二维码，保留共享头部。
- 浏览器 Canvas 生成，qrcode 按需加载，不新增上传或存储接口。复制失败可手动选中链接；关闭取消未完成生成并释放临时资源。portal 与视口定位避免浮层被内容动画截断，Escape 返回入口焦点。
- 复制、生成和下载前重新读取文章公开状态；撤回、草稿及回收站无法导出，文章更新后清除旧预览并要求重新生成。本地／内网地址提示上线后重新生成。
- 5 项行为回归先失败后通过；最终全套 190 项、生产构建与随后类型检查通过。隔离桌面和 390px 手机检查无封面、长标题、关闭、复制反馈及实际下载，无横向溢出或浏览器错误。两个实际 PNG 尺寸正确，二维码解码均匹配文章链接；撤回公开和更新版本阻止旧图下载。
- 只删除两条合成验收文章，原九条 QA 记录 JSON 与验收前完全一致；临时页面、视口及服务清理，正式 3000 重启。保留既有工作区，无提交、推送或云端部署。证据见文章分享计划。

## 2026-10-05：旅行足迹

- 小屋工具新增公开旅行足迹入口，`/?view=travel` 原位切换与直接刷新保留共同头部。参考旅行页面的中国地图与地点手账结构，沿用奶油粉主题。
- 34 个省级区域、372 个地级区域转换为本地 SVG 与城市坐标；南海诸岛小图、三沙坐标保留。去过／家乡点亮省份，想去单独计数和显示空心点；手机扩大圆点点击范围，键盘可选城市和省份。
- 站主管理地点、状态、可选日期、公开手记与关联内容；使用主题菜单，未保存关闭与移除分别确认。访客关联 ID 过滤私人、草稿和回收站记录。原有文章按当前环境打开，照片记录显示原图库。
- 设置存于 `settings.travel`，Node 与 D1 接口同步，Cloudflare 首屏路由与迁移保留；完整备份恢复已测试。
- 7 项新增回归先失败后通过，最终全套 197 项、生产构建与之后的类型检查通过。隔离环境实测添加想去、修改家乡、刷新保存、文章关联、九图详情、未保存提醒、取消移除和 390px 编辑表单；桌面／手机无页面错误、无横向溢出。截图位于 outputs/travel-map-desktop.png、travel-map-mobile.png。
- 正式数据只补充福州足迹，关联 2026-04-04 真实记录与九张照片，175 条原内容未改动。测试使用独立 outputs/travel-qa 数据；临时服务关闭，保留本地 3000，未提交、推送或部署。
- 后续调整：按用户要求将旅行足迹移出折叠菜单，成为顶部导航独立入口，位于收藏馆之后；关于我仍最后。更新入口回归先失败后通过，7 项旅行测试与类型检查通过，原位切换已实测。

## 2026-10-05：旅行地图缩放与市级区域

- 补齐 372 个地级区域的本地 SVG 轮廓与范围。省份自动定位、主题省份菜单、1–16 倍按钮／滚轮缩放、拖动、双指变换及返回全国；海南定位同时保留南海诸岛小图。
- 市级区域区分去过、家乡、想去与待点亮；城市圆点和字保持屏幕尺寸，选择相邻圆点时按最近距离判断。拖动后的点击被取消，选择视野外的手账城市会自动移入视野。
- 5 项视口回归先失败后通过，覆盖缩放锚点、移动限制、福建各市边界与足迹间距、相邻城市点击及双指缩放／平移。最终全套 202 项、正式构建及之后的类型检查通过。
- 本地浏览器实测福建展开九市、泉州／厦门手账切换、未到访龙岩、按钮与滚轮缩放、拖动后选择不变、返回全国及 390px 手机无横向溢出。双指操作的数学变换由回归测试覆盖，未使用实体触屏验收。截图 outputs/travel-zoom-desktop.png、travel-zoom-mobile.png。
- 本轮只修改地图代码、静态边界数据及文档，无正式旅行数据写入、提交、推送或部署。

## 2026-10-05：撤下旅行地图，新增视频作品

- 按用户要求撤下旅行页面、导航和活跃样式引用，地图组件、行政区数据、地点接口及已有 settings.travel 保留；原旅行地址显示主页，备份和迁移仍保留足迹。
- 顶部独立“视频作品”栏目沿用共享头部与奶油粉主题。支持本地 MP4／WebM（100 MB）、上传进度、自动首帧封面与自选图片、标题／简介／分类／标签、默认公开／仅自己、编辑与未保存关闭确认。
- 独立视频附件参与 Node／D1 的公开检查和使用保护，Node 文件流与 R2 Range 支持进度跳转，HEAD 和无效范围返回正确响应。图片／资料仍限制 20 MB；Next 与 Caddy 请求体配置支持视频上限。
- 作品封面卡片、站内播放器、分类与关键词筛选、全站搜索、软删除／恢复、访问统计及完整备份同步接入。备份增加可选 videoCount，旧历史兼容；完整备份恢复真实视频字节、封面、资料及保留旅行设置。
- 7 项新增回归及已有 Cloudflare 集成测试覆盖视频校验、21 MB 上传、隐私／草稿／回收站保护、Range／HEAD、搜索及备份恢复；全套 209 项通过，最终生产构建、之后的类型检查及 diff 空白检查通过。
- 独立生产验收环境实测真实 H.264／AAC 样本上传接口、解码与播放、进度跳转、编辑保存、关闭提醒、公开撤回、登录留在视频栏目、回收站恢复、手机适配和网页备份视频计数。文件选择框与自动首帧封面尚未完成端到端验收：初次浏览器选择未出现原生对话框，恢复连接后受到 URL 协议策略阻止，未绕过。截图 outputs/video-qa/player-desktop.png、player-mobile.png。
- 所有样本和临时账号仅在忽略目录 outputs/video-qa；无正式内容或旅行数据写入。临时服务关闭，3000 开发服务恢复并返回 HTTP 200。未提交、推送或部署。

## 2026-10-05：按用户要求撤下视频栏目

- 用户考虑服务器负担，要求撤下视频模块。移除共享头部入口、视频页面渲染和活跃样式，Node／Cloudflare 与客户端旧 videos 地址回到主页；搜索不展示视频分类或返回视频作品。
- 上传恢复为每文件 20 MB，包括旧 video=1 标记；Next／Caddy 请求体配置分别恢复 25 MB／22 MB。视频组件、附件存储与权限、回收站和备份兼容代码保留，无正式内容或文件删除。
- 更新已有入口、搜索和上传上限回归：先观察 3 项失败，再通过相关 22 项测试与类型检查。
- 最终全套 209 项测试、生产构建、构建后的类型检查及 diff 空白检查通过。正式 3000 旧视频地址 HTTP 200，首屏为主页且不包含视频导航或模块；打开本地主页供用户查看。

## 2026-10-05：文章封面取景与列表剧透提示

- 文章／观后感的封面加入拖动取景框、100%–300% 主题缩放滑杆、加减与重置、桌面／手机预览及方向键微调。取景百分比与缩放存入 article.coverCrop，随草稿、数据库及完整备份保存；换封面重置，原图不裁切或新增附件。
- 阅读页和分享海报共用裁剪几何；旧文章仍按原 coverPosition 显示。服务端拒绝非有限、越界或结构错误的取景配置。
- 根据追加要求，首页／生活碎片和文章地图展示封面，使用保存的焦点与缩放；含剧透标记在卡片、地图、时间轴和搜索结果中先于打开文章显示。
- 新增 7 项回归先观察失败后通过，验证边界、不露空白、旧配置、API 保存与重开、草稿、阅读／分享和各列表入口；全套 216 项测试、生产构建、构建后类型检查及 diff 空白检查通过。独立范围代码审查无 Critical／Important 问题。
- 隔离生产环境实际验证拖动、缩放、关闭确认、草稿恢复、保存后刷新／重开、原生文件选择上传、换封面及重置。390px 预览无横向溢出，最终手机滑杆宽 206px；未使用实体触屏。截图 outputs/cover-qa/editor-mobile.png、cards-mobile.png、cards-desktop.png。
- 正式 3000 主页刷新后，既有“爱情怎么翻译”公开卡片已显示封面和含剧透提示。所有上传／文章修改仅在 outputs/cover-qa/data 测试目录，未修改正式内容；临时服务与测试标签页关闭，保留 3000 服务。未提交、推送或部署。

## 2026-10-05：Tab 空两格与紧凑文章卡片（最终调整）

- 用户撤回列表封面展示，希望首页能容纳更多文章。首页、生活碎片和文章地图恢复文字卡片；进入前的含剧透标记保留。阅读页、封面取景编辑和分享海报继续使用封面。
- 正文 Tab 和工具栏“空两格”共用插入逻辑，插入两个中文全角空格，保留选中的正文；显式围栏代码内插入两个 ASCII 空格，Shift + Tab 可切换焦点，输入法组合时不处理快捷键。
- 浏览器验收发现 items API 通用 text().trim() 会删除第一段缩进，新增失败回归后修复为正文仅校验字符串类型和 50000 字长度、保留首尾格式空白。POST、PUT 及管理 PATCH 均验证格式不被修改。
- 新增缩进 2 项及 API 持久化 1 项回归，列表 2 项回归改为无封面且有剧透提示；最终全套 219 项测试、生产构建、构建后类型检查和 diff 空白检查通过。快捷键和紧凑卡片的限定范围复审无 Critical／Important。
- 隔离浏览器实测 Tab 插入 U+3000 × 2、按钮插入、Shift + Tab 离开输入框、代码内 ASCII 空格、预览无代码框，保存后刷新仍保留两个全角空格。正式主页刷新后有 2 张文章卡片、0 张列表封面、1 个剧透标记。
- 文章修改仅发生在 outputs/cover-qa/data，正式文章与附件未修改。临时服务与测试标签页关闭，保留 3000 开发服务。未提交、推送或部署。

## 2026-10-05：正文缩进、直接插图与参考字号

- 用户的加粗标题后紧接缩进正文被 Markdown 合并成同一段，解析时丢失后续行首空格。根据源位置恢复普通段落行首空格和强调文字前缩进；列表、引用和显式代码块保持原有格式。
- 正文工具栏可直接从电脑／相册选图上传、预览、填写说明和选择展示宽度，再插入光标位置；已有图片可选复用。封面独立选择、更换和移除，正文上传不会自动成为封面，明确无封面的文章保存后仍无封面。日常第一张默认封面行为保留。
- 图片仍关联原附件结构，保留最多 12 张、草稿恢复、公开检查、备份及管理。上传期间禁用保存和关闭；错误显示在插图弹窗，保留正文，可继续选择。附件整理折叠收纳。
- 按用户最后反馈实际读取 yaronluo.com 首页样式，桌面卡片标题 27.2px、摘要 16px、日期及阅读信息 14px；手机标题 24px、摘要 16px、日期及阅读信息 13px。替换此前偏大的 34px／20px 方案。
- 新增两项 Markdown 缩进和一项 API 无封面回归，均先失败后通过；全套 222 项测试通过，最终生产构建、构建后类型检查及 diff 空白检查通过。限定范围复审未发现 Critical／Important 问题。
- 隔离浏览器使用原生文件选择框上传真实样本，验证插入、预览、保存、刷新、独立换封面、移除封面和无效图片错误；正文格式和配图保留。最终正式主页计算字号匹配上述值，1280px 和 390px 无横向溢出。截图 outputs/cover-qa/inline-upload-desktop.png、inline-upload-mobile.png、cards-reference-desktop.png、cards-reference-mobile.png。
- 上传和文章写入仅在 outputs/cover-qa/data 测试数据，正式内容未修改。测试页面与 3002 服务已关闭，3000 返回 HTTP 200；没有提交、推送或部署。

## 2026-10-05：收藏馆影视片单

- 参考 yaronluo.com/bangumi 的海报与观看状态，在收藏馆内部新增“影视片单／小卡收藏”切换，默认展示影视片单；保留共同头部，影视页面使用完整内容区，电脑四列、手机两列。原小卡、人物分组、图片比例和批量操作保持。
- 站主手动添加片名、海报、简介、标签、外部链接、韩剧／电影／国产电视剧／动漫／其他类型、想看／在看／已看／搁置／弃剧、可选 0–10 分评分、年份及集数进度。新影视默认公开；完结状态在总集数已知时补全进度。支持类型、状态、搜索和每页 18 部分页；统计收藏、在看、已看与已评分条目的平均分。
- collection JSON 新增可选 watch，不新增数据库表。共享 items API 校验评分、进度和观后感关联；Node／D1 首屏列表与公开详情过滤私人、草稿及回收站的关联，旧关联删除后仍可重新编辑。草稿、附件权限、回收站、备份恢复和 Cloudflare 保存同步兼容。
- 浏览器发现新字段导致 JSON.stringify 整体比较受顶层顺序影响，空白影视编辑误弹未保存提示。新增失败回归，改为按字段值比较；实测未修改直接关闭，真实修改提示，并恢复片名、观看进度、评分和关联。
- 新增 6 项回归先失败后通过；扩充既有完整备份恢复与 D1 集成验证。最终全套 228 项测试、生产构建、构建后类型检查与 diff 空白检查通过。限定范围及草稿修复复审无 Critical／Important 问题。
- 隔离浏览器实测访客隐藏私密片单、原生海报上传、新建、编辑完结进度、保存与刷新、韩剧及状态筛选、详情进入观后感并关闭弹窗且保留头部、小卡与批量入口、未保存提示／草稿恢复；1280px 与 390px 无横向溢出。截图 outputs/watch-qa/library-desktop.png、library-mobile.png。
- 所有样本仅写入 outputs/watch-qa/data。没有自动添加或修改正式影视、小卡、文章或附件。隔离页面与 3002 服务已关闭，正式 3000 HTTP 200，打开收藏馆供查看；未提交、推送或部署。

## 2026-10-05：已看影视隐藏集数与进度

- 修复剧集选为“已看”后仍显示“未开始”的问题：编辑表单隐藏总集数和看到第几集，卡片与详情隐藏进度信息；其余状态继续支持集数记录，已有进度数据保留。
- 新增两项实际组件渲染回归，覆盖无总集数和已有进度的已看剧集，以及在看剧集继续显示编辑字段和进度。已看回归先失败后通过，全套 230 项测试与生产构建通过。未修改正式片单数据。

## 2026-10-05：收藏馆简介仅站主可见

- 收藏馆（影视与小卡）的简介／收藏理由仅站主登录后显示。共享可见字段处理在 Node 与 D1 的列表、单项数据中清空访客 body；首屏、bootstrap、items API 与搜索使用一致规则，详情不渲染访客简介。编辑标签和公开提示说明简介仅自己可见。
- 原文仍完整保存，站主读取、编辑、草稿及完整备份恢复保持。新增访客／站主接口与搜索回归，扩充 D1 的 bootstrap、列表和详情验收，更新备份恢复的访客预期并断言原文保留；新增回归先失败后通过。全套 231 项测试、生产构建、类型检查通过。
- 本地开发服务全局 Store 缓存了旧方法，重启 3000 开发服务后实测公开 179 项收藏的简介均为空，影视单项详情同样不返回简介；收藏馆 HTTP 200。未修改正式收藏或简介原文，未提交、推送或部署。

## 2026-10-06：Iris 仅站主本人使用

- 阅读当日项目状态总结，复用现有单站主账号与会话。访客的小屋工具菜单隐藏 Iris，已有直接地址与历史导航的私人栏目限制保持，站主登录后保留入口与聊天界面。
- Cloudflare Iris 路由在检查服务配置之前验证站主会话；Node 原有全部 Iris 接口的站主校验保持。匿名、伪造、过期和退出后会话无法读取会话、知识库、原文，或创建会话、聊天与导入；跨站写入被拒绝，拒绝请求不会到达上游。
- 新增 3 项组件与 Node 权限回归，扩充 Worker 匿名／伪造会话矩阵。先复现访客菜单可见和 Worker 匿名请求返回 503 的两个失败，最小修复后通过。全套 236 项测试、类型检查及生产构建通过；日志 outputs/iris-access-tests.log、iris-access-typecheck.log、iris-access-build.log。
- 本地匿名 HTTP 验收：直接 Iris 地址返回主页，不出现菜单或聊天输入；健康、会话、知识库、原文下载返回 401。本机独立 Iris 的 8000 端口没有监听，真实对话未连接验收；测试使用隔离数据库与本地模拟上游，不调用模型。
- 用户再次确认部署目标为阿里云，并表示相关申请已办理。README 与状态文档说明站主登录方式及独立 Iris 必须通过受控内网连接，独立端口公开会绕过博客权限。未修改独立 Iris 服务、正式内容、账号或密码，未提交、推送或部署。

## 2026-10-06：Iris 网页个人博客助手

- 用户确认在博客内发送素材、先预览再确认发布，并明确不修改 Iris 源码。新增写博客面板，选择文章／日常，输入要求、上传最多 10 份 PNG／JPG／WebP 和 PDF／TXT／MD／DOCX／XLS(X) 素材。图片沿用博客优化及私人上传，文档保存在资料柜。
- 新增 POST /api/iris/blog/prepare，继承站主会话与来源检查，使用 Iris 已有会话、附件和流式聊天接口。服务端只接受校验后的标题、正文、分类、标签和摘要，图片身份来自用户选择。生成只返回候选，不创建条目，不改变图片公开权限；文档不作为公开附件。
- 预览展示正文与配图，进入现有 Editor 修改并确认发布或保存草稿，回传真实保存状态与查看入口并刷新父页面数据。当前标签页保存输入、素材和候选 ID，未保存编辑可在切换／刷新后恢复；长期保存仍使用数据库草稿。
- 限定范围复审修复 4 类实际问题：safe/read_attachment 工具权限，读取附件前的解释文字污染 JSON，候选 ID 丢失导致编辑草稿不可恢复，以及创建响应丢失后重试忽略正文／可见范围／草稿／换封面修改。新回归均先失败后修复；共新增 10 项，最终全套 246 项、类型检查和生产构建通过。
- 隔离生产网页实测 MD／图片上传、生成预览时匿名列表不变、修改标题并确认发布文章、日常保存草稿、图片尚未发布时匿名 401，以及“保留草稿并关闭”后刷新恢复编辑标题和配图。390px 无横向溢出；桌面截图 outputs/iris-blog-qa-1791250206220/assistant-preview.jpg。浏览器模拟请求的取消时序未单独作为通过证据，未声称真实模型链路已验收。
- 所有验收内容、文件与账号仅在 outputs/iris-blog-qa-1791250206220/data，使用本地模拟 Iris，不调用模型。测试服务和页面已关闭，保留正式 3000 服务。独立 Iris 源码与正式博客内容未修改，未提交、推送或部署阿里云。

## 2026-10-06：Windows 联合部署准备与编辑权限

- 用户确认已有阿里云 Windows 服务器、ICP 备案进行中，并要求 Iris 及所有编辑管理只供本人使用。改为 Windows 原生 Node/Python/Caddy；新增部署脚本、云配置、环境样例及教程。脚本仅生成准备文件，不安装服务或改防火墙。
- 独立 Iris 源码目录保持；准备脚本只复制必要代码到空运行目录，拒绝相互包含与非空目标。独立云配置关闭本机语音、消息网关及 Ollama 流水线。首次种子保留后续用户设置，模型密钥验证不输出值。
- Run-Service 强制应用回环地址、站主初始化关闭，拒绝本地 .env.local 覆盖。Caddy 公网开关默认 0，明确文件配置才可启用。WinSW 2.x 生成 LocalService、自启、失败重启、滚动日志配置，未在本机注册服务。
- 编辑权限矩阵覆盖 23 个操作的匿名／伪造／过期／撤销会话，共 92 次拒绝。发现文件删除先查存在性再验权限，回归先失败，调整文件写入为先校验权限后查询，回归通过；访客公开互动不变。
- 本地实跑 Windows PowerShell 5.1：准备运行目录、真实 Iris 服务健康、文档提取、safe/read_attachment 实际工具读取与 JSON 流、重启会话保留、生成解析服务 XML。模型响应为本地模拟，不调用真实模型、不复制本机密钥与历史数据。修复入口位于博客导致 Python 导入路径缺失，以及 PowerShell 5.1 参数默认值阶段 PSScriptRoot 未生效两个启动问题。
- 247 项 Node 测试、3 项 Python 部署测试、类型检查与生产构建通过。日志 outputs/windows-deployment-tests.log、windows-deployment-typecheck.log、windows-deployment-build.log、windows-iris-runtime-qa.log。实际 WinSW 安装、LocalService 权限、Caddy 证书与云端防火墙仍在服务器验收；没有发布、提交、推送或修改独立 Iris 源码。
- 末次限定复审发现 WinSW 2.x 账号字段误用了 username；核对官方 v2 文档与解析源码，新增实际生成三个包装器的回归，先因缺 domain 失败，再修复 domain/user 为 NT AUTHORITY/LocalService，最终 4 项 Python 测试通过。避免包装器忽略低权限账号、按默认 LocalSystem 安装。outputs 下的临时测试副本、日志和 XML 保留；清理命令被工具策略拦截，未改用其他删除方式。该目录被 Git 与 Docker 忽略，Windows 教程明确上传时排除；原仓库始终只读。

## 2026-10-06：本地真实 Iris 模型试运行

- 用户明确要求验证本地运行。读取独立 Iris 的环境与当前模型档案，不输出密钥；复制必要代码和博客专用配置到 outputs/iris-real-local-1791252955372299500/iris-runtime，不启动原配置中的语音、企业微信或 QQ 网关。
- 使用原当前模型 mimo-v2.5，后台启动仅回环的 8000 API。私有运行目录 ACL 限制当前用户、SYSTEM 与 Administrators；密钥不在命令行或聊天输出，独立模型档案保存在私有运行数据。端口实际进程为虚拟环境 Python 启动器的子进程，记录父 PID 与运行路径在 outputs/iris-real-local-current.json。
- outputs/real-iris-blog-smoke.ts 使用隔离博客 Store、合法测试站主会话和虚构 Markdown 文件，经真实 files 上传、Iris 健康代理和 blog/prepare 链路取得模型预览“雨后散步的二十分钟”，约 29 秒。匿名请求 401，候选为 draft，博客条目仍为 0，素材公开标记 false。日志 outputs/real-iris-blog-smoke.log，结果位于该运行目录的 blog-smoke/result.json。
- 保持实例后台运行，正式博客仍为本机 3000 服务，可由用户登录后使用。没有自动发布，未修改正式博客内容、独立 Iris 源码或历史数据，未部署云端。已调用真实模型；不能将文档试运行扩大为图片理解或公网安全验收。

## 2026-10-06：Iris 生成后自动弹出预览与确认发布

- 用户重申生成后弹出菜单预览、点击发布。沿用已确认的先预览后发布设计，只在成功且未取消时自动打开现有 Editor；助手正文默认排版预览，可返回编辑。普通编辑器保持默认编辑模式，关闭助手弹窗后保留候选入口。
- tests/iris-blog-ui.test.ts 新断言先因缺少正文预览区域失败，修改后助手、权限和草稿共 18 项相关测试通过；类型检查与生产构建通过。日志 outputs/iris-popup-red.log、iris-popup-tests.log、iris-popup-typecheck.log、iris-popup-build.log。
- 独立数据库和本地模拟 Iris 的生产网页实测自动弹窗、关闭重开、修改标题与正文、确认发布、保存草稿。生成后记录数为 0，点击发布后 1 条公开记录，保存另一个草稿后共 2 条、公开仍为 1。结果 outputs/iris-popup-qa-20261006/result.jsonl；截图 preview.png。未修改正式博客内容与独立 Iris 源码，未提交、推送或部署云端。

## 2026-10-06：普通 Iris 聊天超时后的空回答显示

- 用户截图出现“这条回答没有文字”。检查博客接口 200、真实 Iris 会话只有问题无回答、任务 failed 且执行约 20 秒，结合只读 Iris provider 内置 20 秒首个响应等待与后台 SDK 重试，定位到模型首响应超时及博客空占位没有就地显示错误。没有改动独立 Iris 源码或超时上限。
- 同一真实模型直连普通回复、默认知识库写作与博客代理隔离请求均取得完整回答；代理写作结果 155 字且博客条目为 0。证据 outputs/iris-chat-diagnosis-20261006/proxy-result.json。诊断使用虚构内容，没有发布用户素材。
- 新增 iris-chat.ts 统一读取正文、完成与错误事件，忽略空增量且拒绝未完成回复；iris-chat-message.ts 在对应气泡显示错误并保留部分正文。Iris 页面失败后保留原问题，不覆盖用户同时输入的新问题；停止时显示可重新发送，原问题保留。普通聊天仍不自动发布博客。
- 6 项回归先因缺少实现失败，随后通过；253 项全套测试、类型检查、构建通过。隔离生产网页模拟真实超时事件，错误气泡显示“模型首个响应超时，请稍后重试”，输入框保留问题，发送按钮可用。截图 outputs/iris-chat-ui-qa-20261006/timeout.png。云端未部署，原模型服务的偶发超时仍可能发生。
# 2026-10-07：聊天回答转博客

- 用户在建议「整理成博客 → 选择文章或日常 → 预览 → 明确发布/草稿」后回复「开始」。按既有范围内联完成，不创建新 worktree、不 commit、不部署。
- 新增纯函数候选转换与聊天发布组件，原文保持，默认空图片，复用 Editor 的预览、配图、草稿、稳定候选 ID 和服务器身份校验。只在完整 assistant 回复显示入口；素材工作区与聊天候选使用不同暂存键。
- 新增测试先出现缺失模块及入口缺失失败，再实现并验证通过。全套 258 项测试、类型检查、构建通过；独立只读审查相关 21 项通过，未发现需修复问题。
- 隔离网页验证文章预览 0 记录、编辑标题并刷新恢复、明确确认后 1 篇公开文章、日常保存草稿后站主 2 / 访客 1。证据 outputs/iris-chat-blog-ui-qa-20261007/result.jsonl 与 preview.png。
- 仅博客改动；原 Iris 源码和正式博客内容未修改。本地 3000/8000 恢复，健康检查通过。模型首个响应超时限制仍保持原状，云端仍未部署。
# 2026-10-07：普通聊天公开网页读取

- 用户看到 Iris 声称「当前不联网」，调查发现博客只发送 safe/knowledge，而 fetch_page 等在 research。网络请求曾返回 GitHub 200，但后续主站及 raw 文件地址出现连接超时；不将工具授权和网络可达性混为一谈。
- 用户确认开始接入。最终只在普通聊天服务端固定工具组加入 research，站主/来源校验与客户端不能扩权保持；网页回答复用已有「整理成博客」原文预览。没有修改 Iris 源码、原目录配置或运行时抓取防护。
- 新增实际代理测试先观察缺少 research 的失败，再实现通过。最终全套 259 项测试、类型检查、构建通过。内网 127.0.0.1、localhost、云元数据地址及 file URL 被现有 PageFetcher 拒绝。
- 真实模型调用 fetch_page 成功读取用户项目的 GitHub 官方公开 API，工具耗时约 1.4 秒；带来源回答可进入 Editor 文章预览，candidate.status=draft，隔离博客 0 记录。证据 outputs/iris-web-live-20261007-api/chat-events.jsonl、chat-result.json、final-flow-result.json。
- 独立审查发现写作面板加入 research 会触发 Iris 面经收集专用模式；撤回此扩展，保留素材面板 safe 与原提示。失败主站尝试及中间写作联调证据保留，最终功能范围以普通聊天联网为准。

## 2026-10-08：同一记录图片复用与当前文章重复手记修复

- 用户确认“开始”。服务端通过站主／Origin校验后，对最多12个当前记录候选比较MIME、长度和完整字节；相同内容返回已有图片，不创建文件。客户端保持一份附件，可在正文多处引用并独立调整大小；满容量仍可复用，新图片被拒绝。没有全库去重、存储迁移或Iris源码改动。
- 回归先失败再实现；7项新增测试覆盖同图／不同图、权限、候选边界、满容量、缺失旧文件及附件合并。274项全套测试、类型检查、构建通过；独立只读审查相关33项通过，无需修复问题。日志 `outputs/photo-reuse-all-tests.log`、`photo-reuse-typecheck.log`、`photo-reuse-build.log`。
- 隔离网页真实上传重复图片，资产2→2、附件1张，正文50%与25%两处图片可预览，保存后无照片手记。证据 `outputs/photo-reuse-ui-qa-20261008/result.json`。首次验收副本误将唯一附件移除，复核后纠正为正文图片编号，再进行完整网页验收；正式数据未受该副本影响。
- 用户当前文章原images仅关联旧编号e9dad207…，正文使用8b6ac3e3…，两文件字节一致。备份数据库、原行及文件后，事务仅把附件编号统一到正文图片；正文、25%大小、标题／元数据／时间戳、其他条目及全部资产保持。一次维护断言因SQLite行对象原型差异回滚，修正比较后成功。可恢复备份 `outputs/photo-repair-backup-20261008-1791463865719/`；实际匿名阅读页正文图片可放大且无重复手记，截图 `outputs/photo-reuse-ui-qa-20261008/repaired-article.png`。
- 真实Iris处理虚构素材，拟定完整标题、正文、分类、标签、摘要；隔离库预览0条、重复选图1资产、明确发布后1条公开测试文章，图片50%。证据 `outputs/photo-reuse-live-20261008/result.json`。正式库仅进行上述授权图片关联修复，没有自动发布测试内容。
- 本地博客3000与Iris8000已恢复后台运行且仅监听127.0.0.1，健康检查通过、匿名Iris401。临时3002验收服务结束；没有commit、push或云端部署。

## 2026-10-09：Iris 预览中继续改稿

- 用户对推荐的首项功能回复“开始”。在共用Editor内增加改稿要求、更新预览、停止及恢复最近一次改稿前版本。使用当前手动编辑快照，保持候选ID与配图／封面／可见范围；聊天和素材父组件同步新候选，不自动写入博客。
- prepare接口新增sourceDraft分支，身份及Origin保护保持；与素材／聊天输入互斥，只发文字和保护标记，tools为空、knowledge关闭。图片和引用定义恢复后核对完整Markdown节点，遗漏、顺序变化、伪造及变成代码文本均拒绝更新。浏览器／服务端共用模块保持纯函数，避免Node服务端依赖进入浏览器构建。
- 首轮新测试缺失实现及SSR入口失败；之后全套测试发现共享模块导入ApiError拖入Node内置模块，修改为纯Error并由服务端映射400。独立审查发现图片反引号包装及“放弃修改”父候选未回退，补充语义失败回归并修复，网页验证关闭重开。最终278项测试、类型检查和构建通过，日志 `outputs/iris-revision-all-tests.log`、`iris-revision-typecheck.log`、`iris-revision-build.log`。
- 隔离生产网页验收手动稿作为输入、停止与失败保留、成功切预览、恢复、保留关闭重开仍能恢复、放弃修改后重开原稿、确认发布。确认前0记录、后1条published/private文章；原配图说明和50%大小保持。证据 `outputs/iris-revision-ui-qa-20261009/result.json`、`revised-preview.png`。真实8000以虚构内容改稿成功，配图原始Markdown保持，隔离博客0记录，证据 `outputs/iris-revision-live-20261009/result.json`。
- 正式博客数据、独立Iris源码未修改；临时3002服务结束，既有3000开发服务与8000服务保持；未commit/push/部署。发现目前8000由另一套Python启动器运行并监听所有网卡，直接匿名sessions接口200，而博客代理401。此次未重启该既有进程；当前运行实例需要收紧，历史仅loopback验收不能覆盖此启动方式。

## 2026-10-12：普通 Iris 聊天拖入文件

- 用户要求对话框能拖入文件。新增独立输入区，原普通聊天保持，支持拖放／点击选择、待发送名称与大小、移除；发送时才上传当前会话，失败保留并复用成功上传编号，新对话与切换清空，历史气泡显示附件名。10份／20MB和格式白名单与原Iris提取器匹配，不修改原Iris源码、不自动入知识库或博客。
- 受身份与Origin保护的会话multipart上传代理只允许POST，验证限额、File与会话编号；attachment_ids最多10个合法且不重复，工具组仍固定。4项新回归先缺少模块失败，后通过；相关14项、类型检查、最终290项全套与生产构建通过。日志 `outputs/iris-chat-files-all-tests.log`、`iris-chat-files-typecheck.log`、`iris-chat-files-build.log`。独立只读审查无必须修复问题。
- 隔离网页真实选择／移除／只有文件发送／模型错误／同会话重试／新对话清空／历史附件名验证，2次上传支持3次发送，博客0记录0资产；拖放Files数据与非文件数据分别有纯函数回归，原生OS拖动手势未作网页自动化实测。结果 `outputs/iris-chat-files-ui-qa-20261012/result.json`；截图 `pending-files.png`。
- 8000被另一套Django服务占用，原地址health／sessions均404，不停止该服务；已有博客专用副本改用仅127.0.0.1的8003。真实TXT上传ready，模型读到指定饮品和路线，博客0记录0资产，证据 `outputs/iris-chat-files-live-20261012/result.json`。测试脚本首次误按200断言创建会话，原Iris正确返回201，已调整为接受成功状态。
- `.env.local`记录本地IRIS_BASE_URL，核实当前Next进程属于本项目后重启3000并接8003；首次严格路径检查因命令路径表示未匹配而未停止任何进程，规范化后验证重启成功。健康200、匿名上传401，两个专用入口只监听127.0.0.1；本地恢复助手同步记录端口。正式博客内容／阅读时间保持，临时3002验收服务结束，不commit/push/云端部署。

## 2026-10-13：聊天照片预览与勾选博客配图

- 用户确认“开始”，完成前两项推荐：待发送图片对象URL缩略图／放大并释放；发送后用真实附件编号和受保护GET接口预览，历史消息同样可查看。接口按20MB限制和真实PNG／JPEG／WebP字节返回，私有no-store及nosniff，不开放文档或任意代理。
- 回答对应最近用户消息图片作为会话快照进入选图窗口，默认不勾，文档排除。文字拟稿成功后才读取／压缩上传所选图片并合入候选，文章正文配图，日常相册；候选ID、状态／可见范围保持，文章不自动设封面。同窗口缓存导入图片，支持取消、失败保留与重试。没有自动创建博客条目或发布。
- 新测试先缺少模块失败；随后5项覆盖对应请求映射、私有图片字节与授权、明确选择与缓存／取消、候选合并和SSR入口。295项全套测试、类型检查、build通过；只读审查27项相关测试通过，无必须修复问题。日志 `outputs/iris-chat-photos-all-tests.log`、`iris-chat-photos-typecheck.log`、`iris-chat-photos-build.log`。
- 隔离网页选择两张照片和一份文档，待发送／已发送／历史照片可放大；博客仅勾选第二张，生成后0条目1私人资产，调整说明和50%大小，明确确认后1篇public文章且只有1处插图、无照片手记。证据 `outputs/iris-chat-photos-ui-qa-20261013/result.json`、`photo-picker.png`、`published-article.png`。缓存复用／取消及日常候选由测试覆盖，不声称网页重复测试每个组合。
- 真实服务初次未运行，恢复既有专用8003后图片上传201、下载200且字节与原图一致；此接口联调未调用模型、博客0条目0资产，证据 `outputs/iris-chat-photos-live-20261013/result.json`。验收脚本曾在build尚未结束时尝试启动，未启动成功，等待构建通过后重新启动隔离3002；临时服务已结束。本机3000／8003健康、匿名图片401；原Iris源码、正式文章、阅读时间、云端不变，不commit/push。

## 2026-10-13：我的写作偏好

- 用户确认“开始”。Iris页面增加私有折叠设置，文章／日常分开选择语气、篇幅、小标题、标题风格、500字补充要求，默认中性；明确保存后生效，未保存修改不进入拟稿。素材、聊天转博客、预览改稿三个分支由服务端统一读取对应偏好，本次要求优先；普通聊天、配图、工具和知识库授权、确认发布保持。
- Node／Cloudflare Store复用已有settings专用私有键，共用纯校验，无数据库迁移。GET／PUT经站主认证，PUT验证Origin与字段，非法写入不覆盖，公开profile不包含偏好。初始回归缺模块／方法失败后转绿；最终新增5项测试，全套300项、typecheck和build通过，日志 outputs/iris-writing-preferences-all-tests.log、iris-writing-preferences-typecheck.log、iris-writing-preferences-build.log。
- 独立只读审查发现固定“已保存／知识库”措辞满足原Iris面经快速分类器第三组条件，可使无URL的收集面试题项目描述误分流。只读核实原agent.py分类器，actual-handler素材／聊天两分支回归先11/12失败，改为“长期写作偏好／工具能力和发布权限”后通过，审查针对修复的3项测试复核通过。不改变原Iris分类器；用户素材或自定义要求自身满足条件的原边界保持。
- 隔离生产网页保存两套设置，刷新后文章casual／short／no／brief与两份独立要求保留；未保存标记没有进入拟稿或改稿。模拟Iris请求验证知识库false、素材safe／改稿空工具组，实际预览与改稿成功，博客0记录。证据 outputs/iris-writing-preferences-ui-qa-20261013/result.json、events.jsonl、preferences.png；真实模型文风没有逐种选项实测，不声称严格保证。
- 正式偏好与博客内容、原Iris源码、阅读时间未改。本机3000／8003保留仅loopback监听，匿名博客Iris401、专用Iris健康200；核实进程父链后结束临时3002验收服务，关闭临时浏览器页。没有commit、push或云端部署。
