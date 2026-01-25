# The Web Wand Engine (TWWE)

一个基于 Web 的 Noita 法杖评估与同步工具。本项目旨在提供一个直观的界面，帮助玩家分析法杖逻辑，并通过同步插件实现游戏数据的实时联动。

## ✨ 功能特性
- **实时同步**: 通过 `wand_sync` 插件实时获取游戏内法杖数据。
- **逻辑评估**: 基于 Lua 引擎模拟法杖发射序列。
- **现代 UI**: 使用 React + TailwindCSS 构建的响应式前端界面。

## ⚖️ 开源协议与第三方声明 (Credits)

### 核心引擎
本项目集成了以下开源组件：
- **[wand_eval_tree](https://github.com/NathanSnail/wand_eval_tree)** (by NathanSnail): 核心 Lua 模拟引擎。
  - **修改说明**: 本仓库包含该引擎的修改版本，修复了特定属性下的负数解析问题，并增加了对标准 JSON 数据导出的支持。
  - **协议**: [GPL-3.0](./wand_eval_tree-master/LICENSE.txt)

### 致谢 (Acknowledgments)
在开发过程中，以下项目的代码逻辑、数据结构或设计思路为本项目提供了巨大的灵感和参考，特此致谢：
- **[Component Explorer](https://github.com/dextercd/Noita-Component-Explorer)**: 提供了详尽的组件字段解析参考。
- **[Spell Lab Shugged](https://github.com/shoozzzh/Spell-Lab-Shugged)**: 法杖逻辑模拟与 UI 交互的先驱。
- **[Wand Editor](https://github.com/KagiamamaHIna/Wand-Editor)**: 提供了优秀的交互灵感。

本项目遵守 **GPL-3.0** 开源协议。

## 🚀 快速开始

### 1. 下载与安装 (推荐)
直接从 [Releases](https://github.com/NathanSnail/TWWE/releases) 下载最新的绿色便携版：
1. 下载 `TWWE_vX.X.X.zip` 并解压。
2. 将游戏解包后的 `data` 文件夹重命名为 `noitadata` 放在程序根目录下（或者在 `config.json` 中配置路径）。
3. 运行 `TWWE.exe` 即可启动。

### 2. 游戏内同步
将解压包内的 `wand_sync` 文件夹复制到 Noita 的 `mods` 目录下并在游戏中启用。

---

## 🛠️ 开发与构建 (进阶)

如果您想自行编译或参与开发，请参考以下步骤：

### 1. 环境准备
- **Python 3.8+**
- **Node.js 16+**
- **LuaJIT**: 请自行下载 `luajit.exe` 并放置于 `bin/` 目录下。

### 2. 配置说明
程序会优先寻找项目根目录下的 `noitadata` 文件夹。您可以将游戏解包后的 `data` 文件夹重命名为 `noitadata` 放在根目录。

### 3. 安装运行
```bash
# 后端
pip install -r requirements.txt
python backend/server.py

# 前端
cd frontend
npm install
npm run dev
```

### 4. 打包与发布
- **本地打包**: 运行 `build_portable.bat` 生成单文件 EXE。
- **发布到 Release**: 确保安装了 [GitHub CLI](https://cli.github.com/)，然后运行 `publish.bat` 即可一键完成：打包、Git 提交、打标签、上传到 GitHub Release。

---
*声明：本项目与 Nolla Games 无官方关联。请尊重原版游戏版权。*
