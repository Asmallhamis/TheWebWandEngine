# 纸页主题家族设计笔记（静思纸页 / 静夜墨页）

日期：2026-10-22
状态：v1.0（完整重构）
范围：为 TWWE 提供受 Claude / Anthropic 编辑式视觉语言启发的原创主题家族。不复制商标、品牌插画或专有字体；品牌标记为原创的“法杖火花”。

## 设计原则

延续 Anthropic 品牌复盘中的三句话：**温暖胜过现代感、可接近胜过排他、克制胜过炫技**。落到界面上：

- 纸张层级代替玻璃与霓虹：Canvas `#F0EEE6` < Surface `#FAF9F5` < Raised `#FFFFFF`。
- 衬线负责“阅读时刻”（品牌字标、法杖名、章节标题、属性数值），无衬线负责“操作时刻”。
- 句首大写（sentence case）代替全大写加宽字距。
- 单一强调色：陶土 `#C96442`，只用于选中、焦点、品牌与少量强调；主要操作用“墨色按钮”（`#141413` 底、象牙白字）。
- 数值默认是墨色，只有“判断”保留颜色：好（橄榄）、坏（砖红）、多重施放（陶土）。
- 阴影柔和偏暖，永不出现黑色光晕；装饰仅有极淡的纸纹与暖光。

## 架构

### 1. 可主题化的 Tailwind 调色板

`tailwind.config.js` 把 zinc / white / black 以及所有强调色相改写为
`rgb(var(--tw-c-<color>-<shade>, <原始值>) / <alpha-value>)`。

- 未定义变量时回退为 Tailwind 原值，**其他主题与默认深色界面零变化**。
- 纸页主题只需重定义 `--tw-c-*`，就能一次性转换全部 ~350 种颜色工具类，包括 `bg-white/[0.03]` 这类任意透明度。
- 浅色版以 500/600 为轴镜像明度：950–800 的“深色背景”变成浅纸，300–100 的“亮色文字”变成深墨，从而保留原深色界面的语义层级。
- 色相映射：indigo / violet / purple → 陶土；cyan / sky / blue → 雾蓝；emerald / green / lime / teal → 橄榄；amber / yellow / orange → 牛皮纸赭；red / rose → 砖红；fuchsia / pink → 无花果。

### 2. 主题家族作用域

- `src/lib/themeFamily.ts`：`PAPER_THEMES`、`isPaperTheme()`、`isPaperThemeActive()` 与设置页预览色板 `THEME_SWATCHES`。
- `App.tsx` 在 `<html>` 上写入 `data-paper-theme`（让 portal 菜单也继承令牌），并在根节点加 `theme-paper` 类（令牌在首帧即可被 Canvas 渲染器读取）。
- `themes.css` 中面向玻璃主题的通用覆盖使用 `.theme-cool-ui:where(:not(.theme-paper))` 排除纸页家族，`:where()` 保证原有优先级不变。

### 3. 样式文件

| 文件 | 内容 |
| --- | --- |
| `themes/paper/tokens.css` | 语义令牌 `--paper-*`、Canvas 树令牌、`--cool-*` 兼容值、调色板重映射（浅/深两套） |
| `themes/paper/base.css` | 排版、材质（glass → 纸）、阴影、按钮、开关、输入框、滑块、滚动条、动效 |
| `themes/paper/components.css` | 页眉、页脚、通知、法杖卡、属性表、法术格、评估器章节、时间轴、执行树、弹窗/设置/抽屉、悬浮切换器、法术选择器、画布模式 |

组件只声明**与主题无关的语义钩子类**（如 `app-header`、`wand-card`、`wand-stat-value`、`eval-section-title`、`settings-nav-item`、`drag-mode-option`），外观全部由 `components.css` 决定。

### 4. Canvas 渲染器

`SpellGridCanvas` 与 `CanvasTreeRenderer` 通过 `isPaperTheme` 判断，并读取 `--paper-cell-*`、`--paper-tree-*`、`--paper-accent*` 等令牌；浅色与深色版共用同一套代码路径。

## 字体

- 衬线：`Newsreader Variable`（`@fontsource-variable/newsreader`，含光学尺寸轴，本地打包，离线可用；拉丁子集约 130 KB，仅在使用时加载）。
- 中文衬线回退到已安装的思源宋体 / Noto Serif SC，否则回落到苹方 / 微软雅黑，**绝不回落到宋体（SimSun）**——与 Claude 中文界面“拉丁衬线 + 中文系统字体”的做法一致。
- 无衬线：Inter（若可用）→ 系统 UI 字体。
- 等宽：JetBrains Mono / Cascadia Mono / Consolas。

## 静夜墨页（深色）

与 Claude 深色模式同源：Canvas `#1F1E1D`、Surface `#262624`、Raised `#30302E`，文字 `#FAF9F5`，强调 `#D97757`。结构规则完全共享，只替换令牌；调色板保持自然明度方向并整体偏暖。

## 设置页

主题选择器改为带迷你页面预览的色板卡（背景 / 纸面 / 墨线 / 强调点），对所有主题生效；纸页主题下不显示“动态背景”选项。

## 验证

- `e2e/paper_theme.spec.ts`：令牌挂载、调色板重映射、深色变体、非纸页主题不受影响、设置页色板实时切换。
- 手动截图复核：列表视图、评估器、时间轴、设置页、仓库抽屉、法术选择器、画布模式、默认深色界面回归。

## 后续可选

1. 法术选择器分类标题的进一步排版。
2. 仓库卡片缩略区的纸面化细节。
3. 历史面板与 Mod 管理器的专属排版。
