# The Web Wand Engine (TWWE)

[中文版](./README.md) | English

A Web-based Noita wand evaluation and synchronization tool. This project aims to provide an intuitive interface for players to analyze wand logic and interact with in-game data in real-time through a dedicated synchronization plugin.

## ✨ Features
- **Real-time Synchronization**: Use the `wand_sync` mod to pull wand data directly from your active Noita session.
- **Logic Evaluation**: A powerful Lua-based engine that simulates wand firing sequences.
- **Modern UI**: A responsive frontend built with React and TailwindCSS.

## ⚖️ License & Credits

### Core Engine
This project integrates the following open-source component:
- **[wand_eval_tree](https://github.com/NathanSnail/wand_eval_tree)** (by NathanSnail): Core Lua simulation engine.
  - **Modifications**: This repository includes a modified version that fixes negative value parsing under specific attributes and adds support for standard JSON data export.
  - **License**: [GPL-3.0](./wand_eval_tree-master/LICENSE.txt)

### Acknowledgments
The development of this project was inspired and assisted by the following projects/resources:
- **[Component Explorer](https://github.com/dextercd/Noita-Component-Explorer)**: Provided detailed reference for component field parsing.
- **[Spell Lab Shugged](https://github.com/shoozzzh/Spell-Lab-Shugged)**: A pioneer in wand logic simulation and UI interaction.
- **[Wand Editor](https://github.com/KagiamamaHIna/Wand-Editor)**: Provided excellent interaction inspiration and some shared code logic.
- **[KuroLeaf's Noita Aliases](https://noita.wiki.gg/zh/wiki/User:KuroLeaf/aliases.csv)**: Provided a comprehensive spell alias mapping table, greatly assisting multi-language localization.

This project is licensed under the **GPL-3.0** License.

## 🚀 Quick Start

### 1. Download & Install (Recommended)
Download the latest portable version from [Releases](https://github.com/NathanSnail/TWWE/releases):
Simply run `TheWebWandEngine.exe` to start.

### 2. In-game Synchronization
Copy the `wand_sync` folder from the package to your Noita `mods` directory and enable it in-game.

---

## 🛠️ Development & Building (Advanced)

If you wish to compile the project yourself or contribute to development:

### 1. Prerequisites
- **Python 3.8+**
- **Node.js 16+**
- **LuaJIT**: Download `luajit.exe` and place it in the `bin/` directory.

### 2. Configuration
The application prioritizes the `noitadata` folder in the project root. You can rename your extracted game `data` folder to `noitadata` and place it there.

### 3. Installation & Running
```bash
# Backend
pip install -r requirements.txt
python backend/server.py

# Frontend
cd frontend
npm install
npm run dev
```

### 4. Build & Release
- **Local Build**: Run `build_portable.bat` to generate a single-file EXE.
- **Publish to Release**: Ensure [GitHub CLI](https://cli.github.com/) is installed, then run `publish.bat` to automate: building, Git committing, tagging, and uploading to GitHub Release.

---
*Disclaimer: This project is not officially affiliated with Nolla Games. Please respect the original game's copyright.*
