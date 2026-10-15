# 抽象动画还原项目

对应项目卡片：Gemini 4 argon用代码还原抽象动画实例。

- 源码：`src/abstract-wave/`，`index.html` 为界面，`styles.css` 为样式，`scene.js` 为动画，`interface.js` 为参数面板和原视频交互。
- 发布页面：`visibleproductsshow/abstract-wave/`。此目录中的 HTML、CSS、JS 和谐波数据由构建脚本生成，不要直接修改。
- 卡片：`visibleproductsshow/index.html`；封面：`visibleproductsshow/assets/abstract-wave-cover.png`，取自还原项目的第 4 帧。
- 原视频：`visibleproductsshow/abstract-wave/media/reference.mp4`，打开“原视频”后才加载，关闭后暂停。

在网站根目录运行：

```bash
node scripts/build-abstract-wave.mjs
node scripts/build-abstract-wave.mjs --check
```

来源为站长提供的 `finalwave.html` 与 `HS_UV8oWIAAGOWM.mp4`。保留原项目的动画计算、两种合成引擎、图层、谐波参数、逐帧与图片导出。原 HTML 内嵌的 WebP 是谐波场数据，现拆为 `harmonic-fields.webp`，不是替代动画的视频帧序列，不要作有损转码。所有方程与符号保留，操作文字采用简体中文。

默认收起参数，页面上方可返回项目集、查看原视频、展开参数。小屏幕下画布缩小适配，参数面板可独立滚动。该项目目前独立展示，尚未接入首页场景切换。
