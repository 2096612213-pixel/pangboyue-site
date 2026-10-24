# 傅里叶实验室

网站源码采用用户提供的桌面独立版 index.html，保留全部样式、程序和交互，不依赖外部资源。

- 入口：/visibleproductsshow/fourier/
- 卡片：visibleproductsshow/index.html，第 8 张，位于抽象动画之后。
- 封面：visibleproductsshow/assets/fourier-cover.png，取自项目的实际圆链与波形画布。
- 构建：node scripts/build-fourier.mjs
- 同步检查：node scripts/build-fourier.mjs --check

修改本目录的 index.html 后重新构建，不单独修改发布副本。桌面原项目保持原样。

## 圆环编辑

暂停后，悬停圆环会加粗、提亮；点击打开参数浮框。圆环命中使用当前画布缩放和平移后的屏幕坐标，优先选择最近的圆周，再选择包含指针的最小圆。逐层对比使用各自分区内的圆。拖动超过 4 像素视为平移，避免拖动结束误开浮框。

浮框可调半径、独立角速度、相位、杆宽倍数、圆线宽倍数、圆透明度、颜色、启用状态，以及“更多”中的连续相位修正。修改角速度仍保持当前角度连续；轨迹保留。原参数表与浮框同步，参数表的圆编号可重新打开已禁用或零半径的圆。恢复播放、切换函数/视图、恢复参数会关闭浮框；Esc 和点击外部也可关闭。

导出参数版本为 3，新增 circleWidthMultiplier 和 circleOpacity，其余字段保留。长说明在工作界面隐藏，参数单位和无障碍名称保留。
