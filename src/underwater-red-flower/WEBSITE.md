# 首页三接入

- 来源：用户提供的 underwater-red-flower；默认动画、颜色、水波参数保留。
- 同源嵌入地址：`/visibleproductsshow/silver-blossom/?embed=1`，延用原地址以兼容旧链接。
- 嵌入模式只调整最终画面取景：水与花整体向右、向上移至首页中央偏右，非嵌入工作室仍使用原构图。
- 页面向下的渐隐由 `src/home/styles/scenes.css` 负责，透明处显露纯黑背景。
- 音乐由 `src/home/scripts/home-scenes.js` 管理，复用时间右侧按钮；只有点击时创建音频并请求 `/favorsongs/river-flows-in-you-martin-ermen.mp3`，开启循环。切换场景、首屏离开视口、标签隐藏时暂停；返回不自动续播。

在仓库根目录依次运行：

```
node scripts/build-silver-blossom.mjs
node scripts/build-home.mjs
node scripts/build-silver-blossom.mjs --check
node scripts/build-home.mjs --check
node src/underwater-red-flower/tools/check.mjs
```

修改真正的 `src/`、`shaders/` 或首页源文件，不直接修改发布副本。原花首页源码已移除，原先导出的图标仍保留。
