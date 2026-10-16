# 全站搜索实现计划

**目标：** 按用户最终要求，在顶部栏下方居中弹出小搜索框，支持文章、观后感、日常、收藏和现有权限。

**架构：** 复用 Space 的服务端内容，纯搜索函数负责匹配、排名与摘要，SiteSearch 负责主题弹框及关闭。无新接口、数据库或依赖。

**文件：** src/lib/site-search.ts、src/components/site-search.tsx、src/app/site-search.css、src/components/space.tsx、src/app/globals.css、tests/site-search.test.ts。

- [x] 先写回归并运行缺失功能失败；新增弹框结构回归 7 通过／2 失败后转绿。
- [x] 实现字段搜索、多词、排名、四类、权限、正文摘要和安全高亮。
- [x] 实现居中小弹框、主题分类、单个叉、固定底色、20 条展开和文章／日常／收藏详情。
- [x] 保留当前页面、地址和头部；外部点击／Escape 收起，重开保留会话搜索条件。
- [x] 完成类型检查、169 项测试和构建；桌面／手机及隔离账号权限实测。
- [x] 更新 README、状态总结和实现记录。

**决定：** 根据用户最新截图与定位要求，搜索页方案改为弹框；撤销本轮新增的搜索路由及参数处理，沿用既有页面与历史行为。保留全部既有改动与正式内容，不提交、不推送、不部署。

**证据：** outputs/site-search-red.log、site-search-popover-red.log、site-search-unit.log、site-search-tests.log、site-search-build.log。桌面弹框中心与头部中心同为 634px，空框高约 76px；输入框只有一个叉，点击分类前后底色都是 rgb(245,235,227)。正文链接保留共享头部，收藏 47 条按 20／40 展开，图库详情正常。390px 手机左右各 18px、中心 189.2px、无横向溢出，47 条结果底部 825.45px，小于 844px 视口。

隔离账号能搜索私密与观后感草稿，退出后结果为 0；日常详情正常。QA 没有改写文章或附件，账号已退出、3002 服务及临时页已关闭，3000 保持运行。测试服务占用构建目录时先停止服务再重建；最终构建与随后类型检查通过。截图：outputs/site-search-popover-empty.png、site-search-popover-results.png（最终效果截图随后更新）。
