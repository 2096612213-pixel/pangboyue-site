# 傅里叶实验室

网站源码采用用户提供的桌面独立版 index.html，保留全部样式、程序和交互，不依赖外部资源。

- 入口：/visibleproductsshow/fourier/
- 卡片：visibleproductsshow/index.html，第 8 张，位于抽象动画之后。
- 封面：visibleproductsshow/assets/fourier-cover.png，取自项目的实际圆链与波形画布。
- 构建：node scripts/build-fourier.mjs
- 同步检查：node scripts/build-fourier.mjs --check

修改本目录的 index.html 后重新构建，不单独修改发布副本。桌面原项目保持原样。
