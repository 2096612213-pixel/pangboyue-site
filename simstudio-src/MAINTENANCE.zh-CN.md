# 在线拼乐高：接入与维护说明

本目录是个人网站中乐高项目的可维护源码，来自桌面上的 `SimStudio-LEGO-Technic-Physics-Simulator-main`。后续网站修改以本目录为准。桌面原项目保留原状。此次只做网站接入、中文化、必要的资源加载、部署适配与保存恢复修复，没有升级物理或拼搭功能。

## 网站入口与构建

- 卡片：`../有趣的小玩具展示/index.html`，放在第一个，宽屏占两列、两行，小屏单列。
- 封面：`../有趣的小玩具展示/assets/lego-studio-cover.png`，使用用户提供的原图。
- 页面：`/有趣的小玩具展示/lego/`。
- 源码：本目录。部署产物：`../有趣的小玩具展示/lego/`，不要直接编辑产物。
- 构建配置：`vite.pages.config.ts`，使用相对路径，支持中文子目录。

首次准备依赖时，在本目录运行 `npm ci`。当前机器为避免重复安装，`node_modules` 暂时复用桌面原项目的依赖；更换机器或移走原项目后重新安装即可。

在网站根目录运行：

```sh
node scripts/build-simstudio.mjs
node scripts/build-simstudio.mjs --check
```

原项目同时带有 Vinext 服务端构建。个人网站接入用 Vite 静态构建，不需要运行 Vinext 服务。默认零件库、缩略图、WASM 随站点部署。`functions/api/parts.ts` 为 Cloudflare Pages 提供 `/api/parts` 适配，复用原来的外部 LDraw 查询；纯静态文件预览服务不会运行这个接口。

## 代码导览

| 文件 / 目录 | 作用 |
| --- | --- |
| `app/page.tsx` | React 界面、Three.js 场景、拖放、选择、吸附、连接、模拟调度、项目管理；约一万五千行，是当前主要维护入口 |
| `app/i18n.ts` | 西班牙语、英语、简体中文常用文案；中文默认，三语可切换并记住偏好 |
| `app/part-names.zh.ts` | 默认零件的中文显示名称，不改变几何/物理识别所用的英文名；支持中文名称及编号搜索 |
| `app/catalog/colors.ts` | 颜色值及三语颜色名称 |
| `app/palette.ts` | 默认零件分组、编号、别名、颜色与资源位置 |
| `app/catalog/load-geometry.ts` | 模型加载，以及超大模型 gzip 解压 |
| `app/connection-maps.ts`、`app/connectors.ts` | 连接映射与几何连接点识别 |
| `app/collision-maps.ts`、`app/collision-primitives.ts` | 碰撞映射与近似碰撞形状 |
| `app/physics/`、`physics-core/` | TypeScript 调度与 Rust/Rapier WASM 物理核心，包括齿轮、摩擦、电机、万向节等 |
| `app/renderer/`、`render-core/` | Three.js/WebGL、Rust/WASM WebGPU 渲染及回退 |
| `app/project-format.ts` | `.simstudio` 文件、IndexedDB 项目管理、自动恢复 |
| `app/ldraw.ts`、`app/studio-io.ts` | LDraw/MPD 及 Studio `.io` 导入；可导出 LDraw |
| `public/catalog/` | 预计算几何、缩略图、清单 |
| `public/ldraw/` | LDraw 原始数据、材质与原始许可说明 |
| `tests/` | 物理、连接、导入、映射、项目存储与接入回归测试 |

运行中的三维事件通过语言引用读取最新文案，切换语言不会重建场景。零件编号、文件格式、快捷键、WebGL/WebGPU 等标准标识以及用户自己的项目名称保留原样。

## 部署适配

零件 `39369` 的原始几何 JSON 约 29.4 MiB，超过单文件 25 MiB 限制；现以约 2 MiB 的 gzip 文件分发。解压数据与原始文件逐字节一致，不减少模型精度。构建脚本会检查文件大小，重新生成零件库后也会处理这份大模型。材质库从本地 `ldraw/LDConfig.ldr` 加载，组合零件缩略图改用相对路径。

外部零件仍依赖上游 LDraw 网络服务。外部接口已做响应契约测试，但未部署到生产 Cloudflare，不能据此认定线上接口已可用。

保留 `LICENSE`（MIT）、`LDRAW-NOTICE.md` 及各 LDraw 文件自身许可。构建输出也带有许可与来源说明。

## 当前验证与边界

- 已完成静态构建，浏览器检查首位大卡片、封面、移动端无横向溢出。
- 已检查三语切换与刷新记忆、中文零件搜索、拖放、压缩大模型加载、WASM 物理开始和停止、保存项目及刷新恢复（含压缩大底板）。
- 本次相关测试共 97 项通过，静态构建与部署产物一致性检查通过。浏览器使用 Chromium，WebGPU 在此验证环境中无可用适配器，实际检查走 WebGL 回退，未据此确认真实设备的 WebGPU 性能。
- `tests/site-integration.test.mjs` 检查文案键完整性、全部默认零件中文名、资源路径、模型压缩无损性和外部接口响应契约。
- 原映射测试使用 Windows 路径分隔符，已改为系统分隔符，让测试也能在 macOS 上运行。
- 修复原项目保存恢复时读取不存在的 `saved.part` 的错误，改为读取 `saved.catalog` 中的编号。
- 原项目存在 12 条 TypeScript 类型诊断，恢复字段修复后剩余 11 条（例如可空对象、缺少的属性、重复对象键与联合类型推导）；已用桌面原版复核。其余留待后续整理代码时处理。
- 原项目本身定位为实验性模拟器。电机、大型机构、复杂连接与碰撞精度还需专门验证；不应把此次接入视为专业产品能力已完成。
- 项目和自动恢复数据目前只保存在当前浏览器，跨设备需导出 `.simstudio`；尚无用户账号或云端项目同步。

后续若继续产品化，可先围绕真实拼搭案例确认需求，再逐项建立性能、连接可靠性和物理准确性的基线。本次没有实施这些改进。
