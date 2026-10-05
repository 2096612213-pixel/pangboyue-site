# 群山首页维护

本目录从 `/Users/pby/Desktop/preview` 接入，桌面原稿保留不动。

- `index.html` 是独立入口，可视化项目第六张卡片“网站第二首页”链接到这里。
- 首页通过同源 `?embed=1` 展示相同场景，隐藏独立页的坐标和底栏；文字和北京时间仍由首页原模板负责。
- `js/` 是场景源码，`bundle.js` 是生成文件。音乐、节拍数据和 Three.js 都是本地资源。
- `window.HomeMountains` 提供首页所需的启停与音乐控制。未选中、离屏或页面隐藏时停止绘制并暂停音乐。首次访问不自动发声。
- 首页场景选择默认 bright，并保存到 localStorage 的 `home-scene`；黑色切回原黑云/月亮，白色进入群山。
- 首页控制位于 `../../src/home/scripts/home-scenes.js`，布局位于 `../../assets/home-scenes.css`。240px（手机200px）外边距及底部遮罩控制山脚延伸与图片间距。

在网站根目录运行：

```sh
node 有趣的小玩具展示/mountain-home/build.mjs
node scripts/build-home.mjs
node 有趣的小玩具展示/mountain-home/build.mjs --check
node scripts/build-home.mjs --check
```

构建生成脚本与样式的内容版本，避免改源码后浏览器继续读取旧资源。修改原云层只增加场景启停条件，保留原绘制、月相和雷声实现。

2026-10-05 本地 Chromium 验证过双场景、音乐切换互斥、选择记忆、390px布局、山脚渐隐和独立入口。实体手机及Safari未验证；软件渲染环境不能代表真实设备的帧率。没有执行生产部署。
