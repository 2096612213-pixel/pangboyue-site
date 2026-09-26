# 网站资源与发布约定

这是静态多页面网站：访问首页时不会下载其他路由的 HTML、音频和视频；只有点击相应入口才会加载目标页面。首页的链接在鼠标悬停或键盘聚焦时提前获取目标 HTML。

首页和可视化项目卡片的展示图由原图及同名 AVIF 组成。页面用 `<picture>` 优先选 AVIF，浏览器不支持时回退原图，并用视口观察器把屏幕下方的图片延迟到即将可见时再请求（同时保留 `loading="lazy"`）。更换图片后，请重新生成同名 AVIF（项目卡片图片同理，在 `有趣的小玩具展示/assets/` 下处理）。示例命令（需要 Pillow 及其 AVIF 支持）：

```sh
python3 - <<'PY'
from pathlib import Path
from PIL import Image
for name in ['daily_main.jpg', 'thoughts_main.png', 'book_main.png', 'toys_main.jpg', 'music_main.png', 'footer.png']:
    path = Path('images') / name
    Image.open(path).convert('RGB').save(path.with_suffix('.avif'), format='AVIF', quality=50, speed=6)
PY
```

首页的**源文件**按功能放在 `src/home/`：

- `document-head.html`：文档开头、元信息和资源引用。
- `header.html`：网站名称与导航下拉栏。
- `hero.html`：云层、欢迎词、北京时间和音量按钮。
- `archive-cards.html`：首页项目入口卡片。
- `footer.html`：页脚图片和首页脚本引用。
- `scripts/overscroll.js`、`dropdowns.js`、`lazy-images.js`、`route-prefetch.js`、`clock.js`：对应的首页交互功能。

修改这些源文件后，在仓库根目录运行 `node scripts/build-home.mjs`，它会生成部署用的 `index.html` 和单文件 `assets/home.js`。用 `node scripts/build-home.mjs --check` 可检查是否忘记生成。请提交源文件和生成文件；不要只改生成后的 `index.html` 或 `assets/home.js`，否则下次生成会覆盖改动。构建时合并脚本，是为了分类维护时仍只发出一个首页交互脚本请求。

`assets/home.css` 管首页样式，`assets/fluid-tank.*` 管云层动画，`assets/storm-sound.js` 管雷声。周记的数据请求集中在 `thoughts/api.js`；目前没有远程业务 API，不需要另造接口层。

电子书的源码在 `sample-src/`，发布文件在 `sample/`。`node_modules/` 与 `dist/` 是本地生成物，已从版本控制中移除；需要重建电子书时，在 `sample-src/` 中运行 `npm ci` 和 `npm run build`，再把 `sample-src/dist/` 的内容复制到 `sample/`，提交 `sample/` 更新。Cloudflare Pages 如直接发布仓库根目录，根目录的 `_headers` 会对静态资源设置浏览器缓存。新页面应加入 `sitemap.xml`；周记按周生成的查询链接仍由目录页提供。

当前周记列表只有少量项目，虚拟列表会增加代码和可访问性成本，暂不使用。浏览器缓存策略已按可更新的 HTML/数据、普通资源、哈希资源分别处理；不要给不带哈希且经常替换的文件设置 `immutable`。
