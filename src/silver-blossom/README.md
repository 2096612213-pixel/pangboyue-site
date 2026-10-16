# 红花与黑白流光

源码为本目录 `index.html`，发布副本为 `visibleproductsshow/silver-blossom/index.html`。两者均为单文件 HTML：WebGL2 着色器、花朵谐波与背景系数全部内嵌，可直接用支持 WebGL2 的浏览器打开，无需播放 GIF 或视频。

在网站根目录运行：

```bash
node scripts/build-silver-blossom.mjs
node scripts/build-silver-blossom.mjs --check
```

## 当前画面与默认值

默认背景为黑白流动焦散，花朵为绯红 `#a63055`、着色浓度 95%。背景亮度 100%，花面光纹强度 80%。两者共用同一空间波场与相位，速度仍由原有的光影流转控制。

原截图的花朵参数保留：附加水波/焦散/水膜/花蕊光照为 0，花瓣漂浮 1.25、纹理细节 2.20、色温 1.45、速度 0.55，分辨率 1600，初始相位 98.4°。“恢复默认”同时恢复红花、背景及上述参数；“花瓣原始光影”预设只恢复花朵原参数。

## 连续背景与花面受光

背景来自站长提供的 `codex-clipboard-fc306e2f-8ff0-4b90-bac6-977b9729e1a3.gif`。参考动画 50 帧、1.66 秒：先转换灰度并去除细小抖动，再按真实帧时间拟合八阶傅里叶谐波。运行时由相位连续求值，周期端点自然一致，非逐帧贴图动画。

每个像素的平均值、八组正余弦系数打包为 384 像素的六格 RGB 无损 WebP。图集剩余通道保存填实、去黑边、柔化后的花朵轮廓。背景与花瓣的明暗、法线、轻微折射使用同一个 `sharedCausticField`；着色仅影响花朵，背景输出等量 RGB。

重建参考数据需要 Python、NumPy、Pillow、SciPy；浏览器运行不需要这些依赖。需要重新拟合时运行：

```bash
python3 scripts/fit-blossom-caustics.py /实际路径/参考动图.gif
node scripts/build-silver-blossom.mjs
node scripts/build-silver-blossom.mjs --check
```

拟合记录为本目录 `caustic-fit.json`。原 GIF 不作为浏览器运行依赖，也不额外复制进仓库。原花朵来自站长提供的 `chiaroscuro_floating_blossom_water_caustics_studio_webgl2_super_resolution.html`，下载目录原件未覆盖。

## 保留的功能与边界

- 花朵仍为原算法渲染，保留原花蕊；未使用被站长放弃的 AI 修改版花心。
- 花蕊光照与焦散统一周期，花粉噪声平滑插值，避免循环归零及摆动时跳变。
- 调色预设、自选颜色、着色浓度、逐帧、导出及透明图标提取继续可用。
- 鼠标划过及点击画布触发水波的事件仍已移除。“滴落水滴”按钮可单独使用。
- 原图标留在 `visibleproductsshow/silver-blossom/icons/`；本次未覆盖已导出的图标。
- 当前已接入首页 C 面，位于黑、白色块右边；入口使用 CSS 绘制的酒红色圆点，与黑、白圆点尺寸一致。


## 宽幅构图与首页接入

画布随容器宽高变化，背景系数场镜像延展，避免宽屏水平拉伸；花朵单独在像素比例一致的坐标系中缩放，默认大小为视口短边的 50%，实际花瓣轮廓约占短边的 44%。花朵保持屏幕居中，背景与花瓣仍共享同一屏幕波场。工作室中可调整“居中花朵大小”。

首页通过 `?embed=1` 加载同一页面，嵌入模式隐藏编辑面板、标题和按钮，只显示画布。父页面通过 `window.HomeBlossom.setActive(active)` 控制动画：切换场景、滚出首屏或页面隐藏时暂停渲染。iframe 不接收触摸事件，手机手势由父页面处理。

修改花朵源码后，先生成花朵页面，再构建首页，以更新嵌入地址的内容指纹：

```bash
node scripts/build-silver-blossom.mjs
node scripts/build-home.mjs
node scripts/build-silver-blossom.mjs --check
node scripts/build-home.mjs --check
```

首页入口维护在 `src/home/header.html`、`hero.html`、`scripts/home-scenes.js` 与 `styles/scenes.css`。首页第三入口图标由 `src/home/styles/scenes.css` 的伪元素绘制，颜色为酒红色 `#800020`，不加载截图图片。选择 C 面会保存到 `localStorage`，首次默认场景仍为 B 面。C 面不播放声音，切回群山仍需点击喇叭才播放音乐。
