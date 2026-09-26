# 每周写一份 thoughts.md

周记正文按 `年份-W周数/thoughts.md` 存放。现有内容在 `2026-W39/thoughts.md`，对应 2026 年第 39 周。

下一周写作时，在网站项目根目录的终端运行：

```bash
node thoughts/new-week.mjs 2026-W40
```

命令会自动创建 `2026-W40/thoughts.md` 并把日期加入 `weeks.json`。以后只要把 `2026-W40` 换成实际的年份和周数即可；周数必须是两位数字。打开新建的 Markdown 文件写作即可，不要把 JSON 内容粘进终端。目录页会自动按周数从新到旧排列；`week.html` 是所有周记共用的阅读页面，不需要每周复制。

保存后将新增的 Markdown 文件与 `weeks.json` 一起提交、推送；托管平台部署成功后，网站上才会出现新的一周。只保存 Markdown 而不增加目录项，目录页不会显示它。
