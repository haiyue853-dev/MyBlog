# 执行记录 — plan: docs/superpowers/plans/2026-10-01-personal-space.md

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
