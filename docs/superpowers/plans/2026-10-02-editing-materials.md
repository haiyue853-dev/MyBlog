# 剪辑素材迁移实现计划

**目标：** 把用户旧YOcean主页迁为主题一致的公开「剪辑素材」栏目，保留原价格、图片和联系入口。

**架构：** 静态资料定义在 src/lib/editing-materials.ts，React组件使用原站公开文件和本站Modal。公开view接入现有Space与统计；构建链携带指定public目录，数据库和云端绑定不变。

**技术栈：** 既有React、TypeScript、lucide-react、CSS、Next standalone、esbuild、Workers Assets。当前工作区顺序实现，保留此前未提交变化，不提交/推送。

- [x] tests/cloudflare-update.test.ts 先增加公开图片目录及逐文件字节一致的验证，运行 `npx tsx --test tests/cloudflare-update.test.ts`，观察准备包缺图片失败。
- [x] 复制旧站18张被引用图片到 public/editing-materials；build-cloudflare.ts 用cp仅带该目录，start.mjs 和 Dockerfile 加public携带；重复同一测试通过。原站图片原件与SHA-256一致。
- [x] src/lib/editing-materials.ts 保存图库、价格、原联系方式；src/components/editing-materials.tsx 实现Hero、说明、三图集、抖音、联系及Modal，独立editing-materials.css适配。图集索引循环，touch水平移动>50px才切图；图片区按钮打开图，controls有准确aria-label，缩略图aria-pressed。
- [x] space.tsx 加materials公开导航和宽布局；page.tsx、cloudflare/browser.tsx、use-site-statistics.ts、api/statistics.ts接入；新增CSS两入口均导入。8项导航检查320/360/480/768/1268宽度，修正紧凑断点与桌面顶栏换行。
- [ ] `npm run typecheck`、`npm test`、`npm run build`、`npm run update:cloudflare`、`node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config outputs/MyBlog-Cloudflare-Full-20261002/wrangler.jsonc`，要求全部退出0；不得运行--deploy。
- [ ] 重启3000，浏览器验收直接地址/刷新/返回、两组与单卖切图/大图/Esc/触摸、18张真实图片200、联系方式和价格、统计新增浏览、控制台无错误。保存桌面/手机截图，做一次聚焦审查，更新状态/教程/实施记录并保留本地预览。
