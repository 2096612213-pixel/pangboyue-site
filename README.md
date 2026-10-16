# 庞博约的个人网站

仓库根目录是 Cloudflare Pages 的发布目录，已有页面网址不变。

## 文件树

```text
pangboyue-site/
├── src/                        可维护源码
│   ├── home/                   首页 HTML、scripts/ 交互、styles/ 样式
│   ├── underwater-red-flower/  首页三水中花源码、Shader 与纹理
│   ├── abstract-wave/          抽象波纹项目的页面、样式、动画与谐波数据
│   ├── book/                   React / MDX 电子书源码
│   └── simstudio/              乐高项目源码及自身依赖、测试和许可
├── assets/                     浏览器资源
│   ├── home/                   首页 main.css、main.js
│   │   ├── agent-chat/         聊天脚本、Ψ 动画与图标
│   │   └── scenes/             云层、月面、天文库与 thunder/ 音效
│   └── icons/                  通用网站图标（重复 ICO 合并）
├── images/
│   ├── home/                   首页卡片、湘江原稿和响应式展示图
│   └── …                       周记及生活图片（保留已有链接）
├── functions/api/              Cloudflare Pages 后台接口
├── scripts/                    网站构建和同步脚本
├── docs/                       网站维护说明
├── index.html                  生成的首页
├── sample/                     生成的电子书发布页面
├── visibleproductsshow/        各可视化项目的发布页面
├── thoughts/                   随笔页面、每周 Markdown 和数据
├── favorsongs/                 歌单及音频
├── impressive-short-videos/    视频页面及媒体
├── daily/                      日记内容
└── _headers / _redirects / _routes.json 等托管配置
```

浏览器默认寻找的 favicon.ico 和 apple-touch-icon.png、网站入口及托管配置继续放在根目录。页面和项目各自独立的资源留在对应页面内；不同用途的依赖、源码与构建输出分开，避免互相覆盖。

## 修改和构建

在网站根目录运行，或者使用对应的 `npm run` 命令：

| 任务 | 生成发布文件 | 检查一致性 |
| --- | --- | --- |
| 首页 | `node scripts/build-home.mjs` | `node scripts/build-home.mjs --check` |
| 首页三水中花 | `node scripts/build-silver-blossom.mjs` | `node scripts/build-silver-blossom.mjs --check` |
| 抽象动画 | `node scripts/build-abstract-wave.mjs` | `node scripts/build-abstract-wave.mjs --check` |
| 电子书 | `node scripts/build-book.mjs` | `node scripts/build-book.mjs --check` |
| 乐高 | `node scripts/build-simstudio.mjs` | `node scripts/build-simstudio.mjs --check` |

电子书和乐高首次准备时，分别在 `src/book/`、`src/simstudio/` 运行 `npm ci`。各项目的依赖版本继续独立锁定。首页无需安装依赖。

修改红花场景后先运行 `node scripts/build-silver-blossom.mjs`，再运行 `node scripts/build-home.mjs`，以同步首页嵌入地址。

修改首页应编辑 `src/home/`，再生成 `index.html` 和 `assets/home/main.*`。电子书发布到 `/sample/`，乐高发布到 `/visibleproductsshow/lego/`，源码归类不改变网址。

- [加载优化与资源维护](docs/performance.md)
- [数字助手与后台接口](docs/agent-chat.md)
- [乐高项目维护](src/simstudio/MAINTENANCE.zh-CN.md)
- [抽象动画维护](src/abstract-wave/README.md)
- [山景维护](visibleproductsshow/mountain-home/MAINTENANCE.zh-CN.md)
- [周记维护](thoughts/README.md)

源码和生成的发布文件需一起提交。发布仍由站长自行完成。
