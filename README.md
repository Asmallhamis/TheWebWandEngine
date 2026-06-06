# The Web Wand Engine (TWWE)

中文 | [English](./README_EN.md)

一个基于 Web 的 Noita 魔杖编辑、评估、收藏与同步工具。它更像是一个给 Noita 玩家和法杖研究者使用的工作台：你可以在浏览器里搭配法杖、保存方案、导入 Wiki 模板、查看施法结果，并在本地版中把魔杖与游戏存档做手动同步。

项目目前仍在持续迭代中，定位偏“实用工具 + 研究辅助”，不是官方工具，也不是试图替代游戏内编辑器。在线版适合快速查看和轻量模拟；本地版适合需要游戏同步、Mod 法术数据和高性能评估的场景。

## 适合用来做什么

*   **搭配与保存法杖**: 在网页里编辑法杖，把常用方案放进本地魔杖仓库，并用文件夹、标签、搜索和排序管理。
*   **分析复杂施法逻辑**: 通过本地 `wand_eval_tree` 引擎或静态 WASM 模式查看法术执行、触发链和模拟结果。
*   **和游戏互通数据**: 本地版可通过 Noita Mod 与后端服务把游戏里的魔杖拉到网页，也可以把网页里的设计推回游戏。
*   **整理 Wiki / 分享素材**: 支持导入 Noita Wiki 的 `{{Wand2 ...}}` 模板，也支持复制分享链接和导出法杖图片。
*   **研究 Mod 环境**: 本地版可以同步当前游戏已加载的 Mod 法术数据，并尝试把部分 Mod 逻辑注入模拟器中。

## ✨ 核心特性

### 1. 游戏数据双向同步
*   **手动推送/拉取**: 支持将当前存档中的魔杖一键同步到网页端，或将网页端设计的魔杖推送到游戏中。目前更推荐使用手动的单次推送/拉取；自动同步仍偏实验性。
*   **单次同步保障**: 深度打磨了推送与拉取逻辑，确保即便在复杂的 Mod 环境下，单次同步依然稳定可靠。
*   **无感连接**: 插件端通过高性能 Socket 通信与后端交互，支持实时获取游戏内所有魔杖、法术数据。

### 2. 本地魔杖仓库 (Wand Warehouse)
*   **持久化存储**: 内置强大的本地仓库系统，支持将各种设计的魔杖存储在浏览器中（localStorage）。同时支持**一键导出备份与导入**，确保数据在浏览器缓存清理后仍可恢复。
*   **目录树管理**: 支持创建多级文件夹，通过拖拽轻松整理你的魔杖收藏。
*   **智能标签与搜索**: 支持手动标签、智能标签、名称/拼音搜索，也可以按时间、名称、容量、实际法术数量、法杖属性、标签数量等维度排序。
*   **批量整理**: 支持多选、拖拽移动、导入/导出整个仓库或单个文件夹，适合长期积累法杖方案。

### 3. 多模组生态兼容
*   **深度集成**: 支持一键从 `Wand Editor` 和 `Spell Lab Shugged` 的存档设置中获取并导入已存储的魔杖。
*   **Mod 法术实时抓取**: 通过 Socket 实时同步游戏运行时已加载的所有 Mod 法术数据，确保法术图标与属性的绝对准确。
*   **模拟器注入**: 后端支持将 Mod 的 `ModLuaFileAppend` 逻辑注入到本地评估引擎中，实现对 Mod 法术的精确属性模拟与递归计算。
*   **Mod 环境管理**: 支持保存/导入 Mod 环境包，查看哪些 Mod 新增或修改了法术，并在前端切换启用状态。

### 4. Noita Wiki 深度集成
*   **模版解析**: 直接粘贴 Noita Wiki 的 `{{Wand2 ...}}` 或旧版 `{{Wand ...}}` 模版代码，TWWE 即可瞬间将其还原为可视化魔杖。
*   **油猴脚本增强**: 提供 `noita_wiki_simulator.user.js` 脚本，安装后可在 Noita Wiki 的法杖面板旁直接显示“[在模拟器中打开]”按钮，实现一键跳转。

### 5. 高效率的交互设计
*   **高频偏好排序**: 法术选择器会自动统计所有工作流中法术的使用频率，将常用法术优先排布。
*   **拼音搜索**: 支持法术名的全拼与首字母缩写搜索，快速精准定位。
*   **法术标记规则**: 可用内置或自定义规则标记法术序列，用于识别常见组合、调试特定结构或突出重点槽位。
*   **图片导出**: 支持导出纯法术图、带法杖属性的截图，便于记录方案或在社区讨论时分享。
*   **深度键盘快捷键**:
    *   `Ctrl + C` / `V` / `X`: **智能上下文操作**。默认对鼠标悬停的单个槽位进行复制/粘贴/剪切；若当前有选中的法术组，则对整个选中区域进行批量操作。
    *   `Ctrl + Z` / `Y`: 无限步的撤销与重做。
    *   `Ctrl + A`: 全选当前魔杖内的所有法术。
    *   `Ctrl + H` / `B`: 快速开启或关闭历史记录/魔杖仓库面板。
    *   `Space`: 在当前位置插入一个空格子。
    *   `Delete` / `Backspace`: 删除悬停或选中的法术。在设置中开启“**删除空格子**”后，按 `Delete` 键可直接删除法术及其所在的格子（降低法杖容量）。
    *   `Alt (按住)`: 实时显示法术槽位的逻辑顺序数字。
*   **鼠标指令与模式**:
    *   **箭头模式 (Arrow)**: **默认模式** (选择模式)。支持点击或拖拽鼠标进行**框选**，快速选中多个法术。
    *   **手形模式 (Hand)**: 抓取模式。支持点击或拖拽单个法术。
    *   `中键点击`: 标记/取消标记法术槽位（用于高亮显示或特定调试）。
    *   `Alt + 左键点击`: 快速切换法术剩余次数（0 或 满）；若是条件法术（如低血量触发），则直接切换对应的模拟环境开关。
*   **画布/网格编辑**: 支持普通列表式编辑，也支持更适合大容量法杖的网格/画布显示模式，减少超长法杖在界面中的滚动负担。

### 6. 双引擎评估计算
*   **本地高性能模式**: 调用高度优化的本地 `wand_eval_tree` 进程，支持数百万级递归的超复杂法术计算，模拟真实开火逻辑，性能极强。
*   **静态兼容模式 (WASM)**: 前端集成 Lua WASM 引擎，用于脱离后端环境（如 GitHub Pages）时的基础评估，性能适合轻量验证。

## 🏗️ 架构说明

TWWE 采用模块化解耦架构，确保前端 UI、后端服务与游戏逻辑之间的高效协作。

```text
TheWebWandEngine/
├── backend/                # Python 后端模块
│   ├── server.py           # Flask 服务核心，处理 API 与 Socket 桥接
│   ├── import_helper.lua   # 辅助 Lua 脚本，用于解析游戏数据
│   └── requirements.txt    # Python 依赖清单
├── frontend/               # React 前端模块 (Vite + TS + Tailwind)
│   ├── src/
│   │   ├── components/     # UI 组件 (原子化设计)
│   │   │   ├── OverlayManager.tsx  # 全局弹窗/模态框统一管理器
│   │   │   └── WandWorkspace.tsx   # 法杖编辑区核心画布
│   │   ├── hooks/          # 领域逻辑层 (Custom Hooks)
│   │   │   ├── useGameSync.ts      # 游戏实时同步逻辑
│   │   │   ├── useInteraction.ts   # 复杂的拖拽与多选逻辑
│   │   │   └── useGlobalEvents.ts  # 全局快捷键与生命周期管理
│   │   ├── lib/            # 工具库、搜索算法与模拟器适配器
│   │   └── types.ts        # 全局 TypeScript 类型定义
│   └── vite.config.js      # 前端构建配置
├── wand_sync/              # Noita 游戏插件 (Mod)
│   ├── init.lua            # Mod 入口，实现与后端的 Socket 通信
│   └── mod.xml             # Mod 元数据
├── wand_eval_tree/         # 核心评估引擎 (Lua)
│   ├── src/                # 递归计算与法杖逻辑模拟核心
│   └── main.lua            # 引擎入口
├── bin/                    # 运行时二进制文件 (如 LuaJIT)
└── build_portable.py       # 自动化打包与发布脚本
```

### 🔄 工作流简述
1.  **数据流**: 游戏通过 `wand_sync` Mod 将魔杖数据通过 Socket 发送给 `backend`。
2.  **状态管理**: `backend` 缓存并转发数据，`frontend` 通过 `useGameSync` Hook 实时监听并响应。
3.  **计算逻辑**: 当魔杖改变时，前端通过 `useWandEvaluator` 调用 Web Worker (WASM) 或后端 `wand_eval_tree` 进行递归模拟。
4.  **UI 渲染**: 采用 React 的声明式渲染，结合 Tailwind CSS 提供像素级的流畅交互。

---


## 🚀 快速开始

### 1. 在线使用
您可以直接访问 [GitHub Pages 在线版](https://asmallhamis.github.io/TheWebWandEngine/)。
> [!NOTE]
> 在线版运行在静态模式（WASM）下，无法连接本地游戏，且计算性能受浏览器限制。如需即时同步、高性能模拟，请下载下方本地版。

### 2. 下载本地版
从 [GitHub Releases](https://github.com/Asmallhamis/TheWebWandEngine/releases/latest) 下载最新的绿色便携版：
1. 运行 `TheWebWandEngine.exe` (或 `Start_TheWebWandEngine.bat`)。
2. 程序会自动在默认浏览器中打开 UI（默认端口 `17471`）。

### 3. 游戏内同步
将插件文件夹 `wand_sync` 复制到 Noita 的 `mods` 目录下并在游戏中启用。
> [!IMPORTANT]
> 必须在游戏设置中开启“**允许不安全脚本 (Enable unsafe mods)**”以支持 Socket 通信。

## 🛠️ 开发与构建 (进阶)

### 1. 环境准备
- **Python 3.8+** 与 **Node.js 16+**。
- **LuaJIT**: 确保 `bin/` 目录下存在 `luajit.exe`（本地评估引擎驱动）。
- **资源文件**: 将游戏解包后的 `data` 文件夹重命名为 `noitadata` 放在根目录，可获得最完整的法术图标与翻译支持。

### 2. 本地运行
```bash
# 后端
pip install -r requirements.txt
python backend/server.py

# 前端
cd frontend && npm install && npm run dev
```

默认情况下，后端只监听 `127.0.0.1` 以避免局域网或网页跨站误调用本地 API。若开发时需要用手机访问电脑 IP 进行验证，可显式开启局域网调试：

```bash
set TWWE_ALLOW_LAN=1
python backend/server.py
```

### 3. 打包脚本
- **`build_portable.bat`**: 生成单文件便携 EXE。
- **`build_gh_pages.bat`**: 构建 GitHub Pages 静态网页版。
- **`verify_static_site.bat`**: 构建并启动本地静态服务器进行验证（模拟 GitHub Pages 环境）。

### 4. 手动构建与发布 (进阶)
如果你需要手动构建或在 Linux 环境下操作：
1. **创建虚拟环境**: `python -m venv .venv`
2. **激活虚拟环境**: 
   - Windows: `.venv\Scripts\activate`
   - Linux: `source .venv/bin/activate`
3. **生成可执行文件**: 运行 `python build_portable.py`。生成的单文件可执行程序将位于 `dist/TheWebWandEngine`。

## ⚖️ 开源协议与第三方声明 (Credits)

### 核心引擎
本项目集成了以下开源组件：
- **[wand_eval_tree](https://github.com/NathanSnail/wand_eval_tree)** (by NathanSnail): 核心 Lua 模拟引擎。
  - **修改说明**: 本仓库包含该引擎的修改版本，修复了特定属性下的负数解析问题，并增加了对标准 JSON 数据导出的支持。
  - **协议**: [GPL-3.0](./wand_eval_tree/LICENSE.txt)

### 致谢 (Acknowledgments)
在开发过程中，以下项目提供了巨大的灵感和参考：
- **[Component Explorer](https://github.com/dextercd/Noita-Component-Explorer)**: 核心组件字段解析参考。
- **[Spell Lab Shugged](https://github.com/shoozzzh/Spell-Lab-Shugged)**: 优秀的法杖编辑工具，为本项目提供了 UI 交互灵感。
- **[Wand Editor](https://github.com/KagiamamaHIna/Wand-Editor)**: 优秀的法杖编辑工具，本项目参考了其 UI 设计并使用了部分代码。
- **[WandDBG](https://github.com/kaliuresis/WandDBG)**: 著名的 Noita 魔杖调试器。本项目在核心评估器逻辑及法术触发可视化方案的设计上深度借鉴了该项目的思路。
- **[KuroLeaf's Noita Aliases](https://noita.wiki.gg/zh/wiki/User:KuroLeaf/aliases.csv)**: 拼音搜索的别名对照数据支持。
- **[salinecitrine/noita-wand-simulator](https://github.com/salinecitrine/noita-wand-simulator)**: 本项目中 A/D（A=Action，D=Draw）节点来源标记机制的设计研究，学习并参考了该项目的 action source 思路。
- **AI 辅助编程**: 本项目的大部分代码（包括前端 React 架构、后端 Python 服务及部分 Lua 逻辑）由 AI 辅助编写而成。

## 📝 许可证
本项目遵守 **GPL-3.0** 开源协议。

---
*声明：本项目与 Nolla Games 无官方关联。请尊重原版游戏版权。*
