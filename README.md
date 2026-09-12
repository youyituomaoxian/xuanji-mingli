# 玄机命理（个人命理推演工作台）

四分区命理工具：倪海厦天纪 / 四柱八字 / 紫微斗数 / 通用运势。
纯静态、零依赖、零后端 —— 知识库构建时内联，双击即用，也可直接部署到 GitHub Pages 或 Cloudflare Pages。

## 快速开始

**方式一：直接双击（零配置）**

双击 `index.html` 即可。知识已内联进页面，资源状态显示「内置 · 正常」。

**方式二：本机 HTTP（可实时读取本地 Skill 仓库）**

```bash
# 根目录必须是「公司分析」（_skills 的上级目录），否则回退内置快照
cd 玄学工作台的上级目录
python -m http.server 8124
# 打开 http://127.0.0.1:8124/玄学工作台/index.html
```

本机环境下资源状态显示「本地 · 正常」（实时读取 `../_skills/` 三仓库）。

## 部署

### Cloudflare Pages

1. 把本目录推送到 GitHub 仓库（注意：推送前确认 `.gitignore` 已生效）；
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git；
3. 选择仓库，构建配置：
   - **Framework preset**: None
   - **Build command**: 留空
   - **Build output directory**: `/`（仓库根）
4. 部署完成后访问分配的 `*.pages.dev` 域名。

### GitHub Pages

Settings → Pages → Deploy from a branch → 选分支与 `/ (root)` 即可。

> 部署环境会自动识别：非本机访问直接使用内置知识快照，不会出现 404 探测噪音。

## 知识真源与重建

三仓库关键知识在构建时内联进 `js/kb-inline.js`：

| 来源 | 内容 |
| --- | --- |
| `../_skills/nihaixia` | 《天纪体系》一节（天机道/人间道/地脉道）+ 倪师表达 DNA |
| `../_skills/bazi-skill` | 五行/神煞/大运/时辰/典籍 五份参考表 |
| `../_skills/MingLi-Bench` | 32 例 iztro 权威快照（亮度/四化/辅星）+ 160 题类别分布 |

规则层（非内联、随仓库分发）：

- `js/ziwei-rules.js` —— 亮度表 / 四化表 / 双星组合 / 格局 / 四化落宫断语
- `js/nihaixia-rules.js` —— 六十四卦索引 / 起卦 / 天纪三层 / 倪师话术

克隆仓库后若需重建快照：

```bash
node _tools/build-kb.js   # 需要 ../_skills/ 三个仓库在位
```

## 隐私策略（重要）

- **云端零保存**：本项目是纯静态站点，**没有后端、没有任何统计/埋点/上报**。生辰数据不会离开你的浏览器。
- **每次打开都是干净会话**：命盘档案只写入 `sessionStorage`，**关闭标签页/浏览器即全部销毁**；同一台电脑上，下一个人打开不会看到上一个人的任何命盘信息。
- **自动清除旧残留**：页面加载时会自动清除早期版本遗留在 `localStorage` 中的档案（`xuanxue.archives.v1` / `xuanxue.current.v1`）。
- **悬浮卡本地档案**（`float-cards.json` / `xuanji-data.json`）：保存在你自己的电脑上，仅悬浮卡读取，不上传任何网络。如需彻底清除，删除这两个文件即可。
- **反缓存加载**：知识库文件使用 `cache: 'no-store'` 探测，不产生数据外传。

## 测试

```bash
node _test/test_calendar.js          # 历法 12
node _test/test_paipan.js            # 排盘 39
node _test/test_cross.js             # 八字交叉 560
node _test/ziwei_cross.js            # 紫微安星 × 32 例 128
node _test/ziwei_ext_cross.js        # 辅星/大限/长生 × 32 例 1632
node _test/ziwei_rules_check.js      # 紫微规则层 20
node _test/nihaixia_rules_check.js   # 天纪规则层 27
node _test/smoke_frontend.js         # 前端冒烟 163
node _test/browser_e2e.js            # 浏览器端到端 54（需 Chrome + 本机双端口）
node _test/preview_school.js ziwei   # 分区解读纯文本预览（QA）
```

## 边界与免责

输出仅供个人娱乐参考，不构成任何决策依据。命理与卦象均为传统文化框架下的
结构化推演：安星/排盘类结果经权威库交叉校验；断语类内容均标注来源
（典籍 / iztro / 传统通则 / 倪师原文），不含编造规则。
