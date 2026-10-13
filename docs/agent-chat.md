# 首页 Ψ 数字分身

## 文件归类

- `src/home/agent-chat.html`：首页聊天区结构，位于首屏与内容卡片之间。
- `src/home/header.html`：名字右侧的 Ψ 入口，点击滚动到聊天区。
- `assets/home/agent-chat/psi.svg`：与桌面图标一致的矢量图，图标使用CSS放大动效。
- `src/home/styles/chat.css`：所有图标与聊天区样式，统一使用 `agent-` 前缀。
- `assets/home/agent-chat/chat.js`：输入限制、请求、上下文、图标滚动入口和安全文本展示。
- `assets/home/agent-chat/backdrop.js`：底层Ψ点阵、鼠标附近的`<`形变、流动与动画性能控制。
- `functions/api/chat.js`：Pages后台路由 `/api/chat`，转发到独立 Worker。
- `_routes.json`：仅让 `/api/*` 进入Pages Functions，静态页面仍走静态服务。
- `scripts/build-home.mjs`：拼装首页、更新图标和功能样式/脚本的内容指纹。
- `index.html`、`assets/home/main.js`、`assets/home/main.css`：构建输出，不能作为首页修改的唯一来源。

## 可调参数

`chat.css` 顶部控制聊天区宽度、黑色区域高度、图标放大倍数和动效时间。输入框底色完全透明，没有渐变反光或阴影，仅保留细边框；圆角输入区域内的点阵通过小幅折射和笔画散射模拟清水透镜观感，散射与字符动画在同一Canvas内实时绘制；输入框不再使用backdrop-filter，避免覆盖区出现缓存画面与动画不同步。聚焦时也不添加底色，发送按钮同样使用透明底。

背景点阵复用`psi.svg`三条路径作为采样及裁切轮廓，图案外不绘制点阵。默认是短横；软边聚光每8秒从左上扫向右下，束宽按画布在垂直光束方向的完整投影计算，循环覆盖Ψ的全部字符（包括左下和右上），只有光束照到的字符显示，其余完全透明并融入黑色背景，光束本身不在图案外绘制；鼠标附近平滑变成`<`、变亮并产生局部流动，输入框、按钮和聊天记录覆盖区域也响应鼠标；回复正文下方降低环境亮度，鼠标交互的亮度独立保留；Ψ只由短横与尖括号构成，没有整圈轮廓线或填色；三条路径独立填充取并集，修复交接处因绕向抵消而被挖空的问题。输入框保持透明，以同一动态画布内的轻微笔画散射和小幅形变模拟隔着清水看点阵的效果；覆盖区和外部共用流动时间、鼠标形变与亮度，不再通过独立背景滤镜取样，也没有雾面底色与自带反光。`backdrop.js`顶部CONFIG控制密度、流速和亮度，限制30帧/秒和1.5倍像素密度，移出屏幕或隐藏页面时暂停；减少动态效果设置下停止流动和自动扫光，固定为居中的柔光。`spotlightPeriod`控制循环秒数，`spotlightLength`与`spotlightWidth`控制束长和束宽，`spotlightGain`控制照亮强度。鼠标可独立唤醒光束外的字符，原来的亮度、`<`形变和飘动继续保留。

`--agent-top-gap` 为山景与聊天区之间的额外留白，当前180px。聊天记录滚动到顶部或底部后，继续滚动可带动整张页面。

消息分隔线已移除。用户消息在右侧深灰气泡里，助手回复左侧显示Ψ，正文没有气泡，也没有Thinking complete文案。回复下方按顺序排列复制、重新回答、分享。复制写入剪贴板；重新回答重用该问题之前的上下文并替换这条回复，失败保留原回复；分享优先使用系统分享，不支持时复制该条问答。消息发出后立即清空输入框、复位高度及字数。

- 桌面聊天区最大宽度1040px，超宽屏1120px。
- 黑色对话区桌面至少960px，超宽屏1080px，手机880px；聊天区在其中垂直居中。
- 导航、聊天框中央和回复左侧的Ψ都可悬停放大到1.24倍，用440ms曲线平滑过渡；键盘聚焦也支持放大。减少动态效果设置下关闭动画。
- 本轮将截图中黑色空间“宽一倍”解释为上下高度扩大，保留大幅上下留白。

## 接口与资料

浏览器调用本站 `/api/chat`；Pages Function优先通过内部Service binding `BOYUE_AGENT`调用独立Worker `boyue-agent` 的 `/chat`。Cloudflare Pages生产环境须新增该服务绑定并重新部署代码；本地Node预览没有绑定，保留HTTP访问 `https://boyue-agent.2096612213.workers.dev/chat`，因此不需要修改本地预览入口。

人物档案和SYSTEM提示仍在独立Worker中，未放入前端目录，也未复制到本站静态文件。现有Worker只需正常支持 `POST /chat` 返回 `{ "reply": "..." }`，无需为网站追加CORS配置。

单独的助手身份问题在Pages后台直接返回一句“我是 Ψ（Psi），庞博约的数字助手。”，防止上游模型附带人物资料。独立Worker也包含同样的规则；混合问题继续转发模型，避免遗漏访客的其他问题。独立Worker提示词更新需要另外在Cloudflare部署，本地文件修改不会自动部署。

每条访客消息最多100个Unicode字符，前端、Pages Function和现有Worker都检查；标点、空格、换行计入。默认不显示字数和额度文案，仅在超限时显示删减提示；字数保留为读屏信息。上下文仅在当前标签页内保留最近若干轮，刷新后清空。

按站长后续要求，移除了区块标题、英文眉题、介绍副标题、身份栏、推荐问题、卡片左上图标、右上新对话加号及底部说明。最外层卡片的边框、底色和阴影也已移除，初始状态是黑色底上的大Ψ点阵背景、中央Ψ、输入框和发送箭头；网站导航的Ψ入口继续保留。

模型输出按文本展示，支持粗体与http(s)链接，不执行输出的HTML。回复失败显示明确提示，不生成假回复。

## 构建与发布

修改源文件后，在网站根目录运行 `node scripts/build-home.mjs`，再运行 `node scripts/build-home.mjs --check`。

沿用网站已有的Cloudflare Pages Git发布流程，需确保仓库根目录的 `functions/` 随发布一起编译；单纯把HTML拖入静态托管不会提供 `/api/chat`。普通静态HTTP预览只能验证页面，不能运行Pages Functions。本轮完整预览使用工作目录内的临时服务器执行同一份Pages Function，并向已有Worker转发真实测试消息。

本轮只进行本地修改。线上完整可用性需要发布后对 `/api/chat` 与真实模型对话进行验证。

## 线上聊天转发修复（2026-10-13）

已实测线上`/api/chat`身份问题返回200，真实模型问题返回502且不是JSON；直接访问独立Worker同样的普通消息返回200及正常回复。这说明Pages路由已经部署，故障集中在Pages到Worker的转发路径，不能仅凭502认定具体Cloudflare内部错误码。

本地`functions/api/chat.js`已增加内部服务调用。要让线上生效：

1. Cloudflare → Workers & Pages → **托管pangboyue.com的网站Pages项目**（不是独立boyue-agent Worker）→ Settings → Bindings → Add → Service binding。
2. Variable name填`BOYUE_AGENT`；Service选择`boyue-agent`，使用生产环境；保存。
3. 发布包含本次`functions/api/chat.js`修改的网站代码，触发一次新的Pages生产部署；绑定只有重新部署后才生效。
4. 在生产网站测试“你好”和“你现在是什么模型”，不能只用“你是谁”验证，因为身份问题不调用模型。

Cloudflare官方说明：https://developers.cloudflare.com/pages/functions/bindings/#service-bindings

此修复不改变前端聊天布局和100字限制，不把个人资料或提示词放入前端，也不需要访客直接请求Worker或新增跨域权限。本地文件修改不等于已修复线上，线上验证须在绑定配置及新部署完成后进行。

## Cloudflare请求参数兼容性修复

再次核对确认：生产部署与GitHub提交一致，服务绑定名称正确，但请求仍失败。根因是转发请求使用了`redirect: 'error'`；本地Node接受该参数，Cloudflare workerd会在创建Request时抛出异常，尚未进入服务绑定调用，因此绑定本身无法修复它。

改为`redirect: 'manual'`并显式拒绝3xx响应，继续阻止自动跟随跳转。服务绑定、身份最小回答、100字限制与本地预览回退均保留。用Cloudflare官方Miniflare/workerd实际执行旧、新代码（本地工具最高支持兼容日期2026-08-06）：旧代码502、新代码200、重定向拒绝及超长输入校验通过。网站生产兼容日期未修改。

官方运行时实现：https://github.com/cloudflare/workerd/blob/main/src/workerd/api/http.c%2B%2B

## 按需启动

聊天脚本保留首屏入口绑定，点阵脚本在聊天区接近视口时才加载。样式源码集中在 `src/home/styles/chat.css`，由首页构建统一输出到 `assets/home/main.css`；不会单独请求源码样式。
