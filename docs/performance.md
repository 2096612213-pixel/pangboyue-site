# 网站资源与加载优化

网站是静态多页面结构。首页不提前下载其他页面的音频、视频或业务包；链接悬停或键盘聚焦时仅预取目标 HTML。

## 首页加载

- 四份样式源码统一放在 `src/home/styles/`，按原先顺序合并为一个 `assets/home/main.css`，减少阻塞样式请求。
- 通用交互源码位于 `src/home/scripts/`，生成单个 `assets/home/main.js`。
- 首次只加载当前选择的山景或云景。山景稍后启动，让导航和欢迎词先显示；云景的天文库、云层程序、月面纹理在首次切换到云景时才加载，十份雷声也按播放需要加载。
- Ψ 点阵在聊天区即将进入视口时才启动；移出视口或隐藏页面时继续暂停动画。
- 图像继续用 `<picture>` 的 AVIF 优先和原图回退，并在接近视口时加载。
- 湘江页脚的矢量原稿 `images/home/xiangjiang.svg` 保留供编辑；页面使用 2159 与 4318 像素宽的 AVIF / WebP 展示图，浏览器按屏幕宽度与像素密度选择。原稿约 10.5 MiB，展示图约 80–201 KiB，不再让浏览器加载与绘制大型矢量原稿。

AVIF 与 WebP 分别用于优先格式与兼容回退，1x / 2x 用于屏幕密度适配；这些是有用途的版本，不当作重复文件删除。更换卡片图片时，同目录内重新生成对应 AVIF；更换湘江原稿时，应分别按原稿 2159×728 和 4318×1456 的尺寸渲染，再输出四份展示图，不能仅把小图放大。构建脚本会给首页 CSS、JS 与页脚图片加内容指纹，便于更新缓存。

## 源码与输出

首页结构在 `src/home/`；脚本与样式也集中在其中。聊天运行脚本和图标在 `assets/home/agent-chat/`，云景运行资源在 `assets/home/scenes/`。修改后执行：

```sh
node scripts/build-home.mjs
node scripts/build-home.mjs --check
```

构建生成 `index.html`、`assets/home/main.js`、`assets/home/main.css`。请同时提交源码与构建输出，不能只改输出。目录总览见根目录 `README.md`。

电子书源码 `src/book/` 发布到 `sample/`，乐高源码 `src/simstudio/` 发布到 `visibleproductsshow/lego/`。统一用根目录 `scripts/build-book.mjs` 和 `scripts/build-simstudio.mjs` 构建、同步和检查，避免手动复制后遗留旧哈希包。本地依赖和构建中间目录已忽略；不同项目的依赖版本独立管理。

`functions/api/chat.js` 提供数字助手后台路由，详情见 `docs/agent-chat.md`。人物提示词仍只在独立 Worker 内。`functions/api/parts.ts` 继续引用 `src/simstudio/` 的零件接口。

## 缓存与验证

根目录 `_headers` 区分经常更新的 HTML / 数据、普通资源和带哈希的长期缓存资源。不要给频繁替换且没有内容指纹的文件使用 immutable。新页面加入 `sitemap.xml`。

本地构建、路径和浏览器功能检查用于确认优化与归类没有破坏页面；本地计时会受代理、缓存和动画影响，不能当作线上访客速度的保证。线上效果须站长发布后验证。
