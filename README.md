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
│   ├── icons/                  通用网站图标（重复 ICO 合并）
│   └── vendor/marked/          周记离线 Markdown 解析库及许可
├── images/
│   ├── home/                   首页卡片、湘江原稿和响应式展示图
│   └── …                       周记及生活图片（保留已有链接）
├── functions/api/              Cloudflare Pages 后台接口
├── scripts/                    网站构建、同步和本地预览脚本
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

## 在飞机上打开本地网站

没有网络时，在这台电脑上直接按下面步骤打开即可。无需提交或推送 Git，也不用重新构建网站。

### 1. 启动预览

打开“终端”，复制下面这一整行，按 Enter：

```sh
node "/Users/pby/Desktop/pangboyue-site/scripts/preview.mjs"
```

不管终端当前在哪个文件夹，都可以运行这条完整路径命令。

看到“本地预览：http://127.0.0.1:8787/”后，**保留终端窗口运行，不要关闭**。

### 2. 打开网站

在浏览器地址栏打开：

[http://127.0.0.1:8787/](http://127.0.0.1:8787/)

这个地址访问的是电脑里的网站，没网也能打开。从首页照常进入各个栏目即可；不要打开线上域名，也不要直接双击 HTML 文件。

| 内容 | 本地入口 |
| --- | --- |
| 首页 | [打开首页](http://127.0.0.1:8787/) |
| 周记目录 | [打开全部周记](http://127.0.0.1:8787/thoughts/) |
| 第 42 周周记 | [打开 2026-W42](http://127.0.0.1:8787/thoughts/week.html?week=2026-W42) |
| 我现在每天正在做的事 | [打开日常记录](http://127.0.0.1:8787/thoughts/week.html?page=daily) |
| 最爱的歌曲 | [打开歌单](http://127.0.0.1:8787/favorsongs/) |
| 电子书 | [打开电子书](http://127.0.0.1:8787/sample/) |

周记、日常、图片、本地音视频和已生成的电子书可以离线查看。歌曲和视频点击播放按钮即可播放，支持拖动进度。修改文字后先保存，再刷新浏览器。

数字助手、外部链接和仍依赖在线资源的项目需要联网，本地预览不会模拟这些在线服务。

### 3. 看完后关闭

回到终端，按 **Control + C** 停止预览。下次再运行同一条启动命令即可。

### 如果提示端口已被占用

改用：

```sh
node "/Users/pby/Desktop/pangboyue-site/scripts/preview.mjs" --port 8788
```

然后打开 [http://127.0.0.1:8788/](http://127.0.0.1:8788/)，其他入口的端口也相应改成 `8788`。

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
