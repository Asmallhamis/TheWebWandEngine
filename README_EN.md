# The Web Wand Engine (TWWE)

[中文](./README_zh.md) | English

A web-based Noita wand evaluation and synchronization tool. This project aims to provide an intuitive, beautiful, and powerful interface to help players analyze complex wand logic and achieve real-time linkage between web design and in-game data through a highly integrated synchronization system.

## ✨ Core Features

### 1. Bidirectional Game Data Sync
*   **Manual Push/Pull**: Supports one-click synchronization of wands from your current save to the web or pushing web-designed wands to the game (currently, the auto-sync function is not perfect, so manual single-time push/pull is recommended).
*   **Single-Sync Reliability**: Deeply polished push and pull logic ensures that single-time synchronization remains stable and reliable even in complex modded environments.
*   **Seamless Connection**: The plugin interacts with the backend via high-performance Socket communication, supporting real-time acquisition of all in-game wands and spell data.

### 2. Local Wand Warehouse
*   **Persistent Storage**: Built-in powerful local warehouse system allows you to store various wand designs in the browser (localStorage). Also supports **one-click export/import backup**, ensuring data can be recovered even after browser cache cleanup.
*   **Directory Tree Management**: Supports creating multi-level folders and easily organizing your wand collection via drag-and-drop.
*   **Smart Tags & Search**: Automatically generates indexing information for wands in the warehouse, supporting filtering by name and Pinyin.

### 3. Multi-mod Ecosystem Compatibility
*   **Deep Integration**: Supports one-click import of stored wands from `Wand Editor` and `Spell Lab Shugged` save settings.
*   **Real-time Mod Spell Fetching**: Synchronizes all mod spell data loaded at game runtime via Socket, ensuring absolute accuracy of spell icons and attributes.
*   **Simulator Injection**: The backend supports injecting mod `ModLuaFileAppend` logic into the local evaluation engine, achieving precise attribute simulation and recursive calculation for mod spells.

### 4. Noita Wiki Deep Integration
*   **Template Parsing**: Directly paste Noita Wiki `{{Wand2 ...}}` or legacy `{{Wand ...}}` template code, and TWWE will instantly restore it as a visual wand.
*   **Tampermonkey Script Enhancement**: Provides the `noita_wiki_simulator.user.js` script, which adds an "[Open in Simulator]" button next to wand panels on the Noita Wiki for one-click navigation.

### 5. High-Efficiency Interaction Design
*   **Frequency-based Preference Sorting**: The spell selector automatically counts spell usage frequency across all workflows, prioritizing commonly used spells.
*   **Pinyin Search**: Supports spell name search via full Pinyin and initials for fast and precise positioning.
*   **Deep Keyboard Shortcuts**:
    *   `Ctrl + C` / `V` / `X`: **Smart Context-aware Operations**. Defaults to Copy/Paste/Cut for a single slot under the mouse; if a group of spells is selected, it performs batch operations on the entire selection.
    *   `Ctrl + Z` / `Y`: Unlimited Undo and Redo levels.
    *   `Ctrl + A`: Select all spells in the current wand.
    *   `Ctrl + H` / `B`: Quickly toggle the History/Wand Warehouse panels.
    *   `Space`: Insert an empty slot at the current position.
    *   `Delete` / `Backspace`: Delete hovered or selected spells. If "**Delete empty slots**" is enabled in settings, pressing `Delete` will directly remove the spell and its slot (reducing wand capacity).
    *   `Alt (Hold)`: Real-time display of the logical sequence numbers of spell slots.
*   **Mouse Commands & Modes**:
    *   **Arrow Mode**: **Default Mode** (Selection Mode). Supports clicking or dragging the mouse for **box selection** to quickly select multiple spells.
    *   **Hand Mode**: Grabbing Mode. Supports clicking or dragging a single spell.
    *   `Middle Click`: Mark/unmark a spell slot (used for highlighting or specific debugging).
    *   `Alt + Left Click`: Quickly toggle spell remaining uses (0 or Full); if it's one of IF_HP,IF_PROJECTILE,IF_ENEM, it directly toggles the corresponding simulation environment switch.

### 6. Dual-Engine Evaluation
*   **Local High-Performance Mode**: Calls a highly optimized local `wand_eval_tree` process, supporting complex spell calculations with millions of recursions, simulating real firing logic with extreme performance.
*   **Static Compatibility Mode (WASM)**: The frontend integrates a Lua WASM engine for basic evaluation when detached from the backend environment (e.g., GitHub Pages), suitable for lightweight validation.

## 🚀 Quick Start

### 1. Online Use
You can access the [GitHub Pages Online Version](https://asmallhamis.github.io/TheWebWandEngine/) directly.
> [!NOTE]
> The online version runs in static mode (WASM), cannot connect to the local game, and calculation performance is limited by the browser. For real-time sync and high-performance simulation, please download the local version below.

### 2. Download Local Version
Download the latest green portable version from [GitHub Releases](https://github.com/Asmallhamis/TheWebWandEngine/releases/latest):
1. Run `TheWebWandEngine.exe` (or `Start_TheWebWandEngine.bat`).
2. The program will automatically open the UI in your default browser (default port `17471`).

### 3. In-game Sync
Copy the plugin folder `wand_sync` to Noita's `mods` directory and enable it in-game.
> [!IMPORTANT]
> You must enable "**Enable unsafe mods**" in the game settings to support Socket communication.

## 🛠️ Development & Building (Advanced)

### 1. Environment Preparation
- **Python 3.8+** and **Node.js 16+**.
- **LuaJIT**: Ensure `luajit.exe` exists in the `bin/` directory (powers the local evaluation engine).
- **Resource Files**: Rename the unpacked game `data` folder to `noitadata` and place it in the root directory for full spell icon and translation support.

### 2. Local Running
```bash
# Backend
pip install -r requirements.txt
python backend/server.py

# Frontend
cd frontend && npm install && npm run dev
```

### 3. Packaging Scripts
- **`build_portable.bat`**: Generates a single-file portable EXE.
- **`build_gh_pages.bat`**: Builds the GitHub Pages static web version.
- **`verify_static_site.bat`**: Builds and starts a local static server for verification (simulating the GitHub Pages environment).

### 4. Manual Build & Publish (Advanced)
If you need to build manually or operate in a Linux environment:
1. **Create Virtual Environment**: `python -m venv .venv`
2. **Activate Virtual Environment**: 
   - Windows: `.venv\Scripts\activate`
   - Linux: `source .venv/bin/activate`
3. **Generate Executable**: Run `python build_portable.py`. The generated single-file executable will be located in `dist/TheWebWandEngine`.

## ⚖️ Credits & Third-party Declarations

### Core Engine
This project integrates the following open-source components:
- **[wand_eval_tree](https://github.com/NathanSnail/wand_eval_tree)** (by NathanSnail): Core Lua simulation engine.
  - **Modification Notes**: This repository contains a modified version of the engine, fixing negative number parsing in specific attributes and adding support for standard JSON data export.
  - **License**: [GPL-3.0](./wand_eval_tree/LICENSE.txt)

### Acknowledgments
The following projects provided significant inspiration and reference during development:
- **[Component Explorer](https://github.com/dextercd/Noita-Component-Explorer)**: Reference for core component field parsing.
- **[Spell Lab Shugged](https://github.com/shoozzzh/Spell-Lab-Shugged)**: Excellent wand editing tool that inspired many UI interactions.
- **[Wand Editor](https://github.com/KagiamamaHIna/Wand-Editor)**: Excellent wand editing tool; this project referenced its UI design and used some of its code.
- **[KuroLeaf's Noita Aliases](https://noita.wiki.gg/zh/wiki/User:KuroLeaf/aliases.csv)**: Alias data support for Pinyin search.
- **AI-Assisted Development**: Most of the code in this project (including the frontend React architecture, backend Python services, and some Lua logic) was generated or co-authored with AI.

## 📝 License
This project is licensed under the **GPL-3.0** License.

---
*Disclaimer: This project has no official affiliation with Nolla Games. Please respect the original game's copyright.*
