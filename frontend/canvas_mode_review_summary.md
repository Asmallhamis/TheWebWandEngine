# Canvas Mode Improvements Summary

## Objective
This document summarizes the recent architectural and feature improvements made to the Canvas Mode of the application. These changes aimed to improve usability, prevent user errors, and streamline the editing experience for wand attributes and spells.

## 1. Feature Highlights & Changes
- **Customizable Grid Layout:** Added `defaultCanvasCellsPerRow` and `maxCanvasCellsPerRow` in global settings, and `canvas_cells_per_row` locally on wands. This replaces fixed grid layouts with dynamic, user-controlled column limits.
- **Default Wands on Canvas:** `PinnedWandEditor` (the main grid) and a newly extracted `PinnedWandAttributes` are now rendered by default for every wand. The manual "Pin to Canvas" feature was removed from the dock.
- **Wand Attributes Node:** Introduced a dedicated draggable node in Canvas mode to edit wand stats (mana, recharge, capacities, etc.) without affecting the spell layout. It re-uses `<WandEditor>` with a `hideSpells={true}` constraint.
- **Auto-Evaluation:** Wands are now automatically evaluated upon entering canvas mode if they hadn't been processed in the tree view, ensuring all visual nodes appear instantly without manual interaction.
- **Editor Lock Toggle:** Users can now toggle an `enableCanvasEditorLock` setting. If disabled, editors are freely interactive without the extra visual clutter of lock/unlock buttons.

## 2. Modified Files
- `src/types.ts` & `src/hooks/useSettings.ts`: Added state models and default values for the new preferences.
- `src/components/SettingsModal.tsx`: Grouped the new canvas mode settings into a visually distinct block (Fuchsia borders/background).
- `src/components/CanvasWorkspace.tsx`: Overhauled structure to iterate wands and render all Editor, Stats, Tree, and Attribute nodes. Fixed scaling widths, syntax bugs, subtitle separation, and canvas-interaction interference.
- `src/components/WandEditor.tsx`: Interfaced `hideSpells` and handled layout adjustments.
- `src/components/SpellDock.tsx`: Removed the manual Pin feature logic.
- `src/locales/zh.json` & `en.json`: Translated all newly introduced variables and keys.

## 3. Key Lessons Learned (Guide for AI / Developers)
- **`react-zoom-pan-pinch` Pitfall:** Any UI elements containing interactive inputs (sliders, text boxes, buttons) inside a pan/zoom wrapper *must* be decorated with the `cancel-pan` CSS class (or securely inherit it from a wrapper). Without it, user interactions like interacting with an input will falsely trigger a canvas drag/pan event, making elements uneditable. 
- **Editing Node Headers:** In the `<DraggableNode>` component, never concatenate a mutable variable (e.g. `wandName`) with a static suffix string (e.g. ` - Editor`) inside the input state. When the user saves, the callback submits the suffix as part of the new name, causing cumulative duplication (e.g., `Wand - Editor - Editor`). Always explicitly separate the strings into `title` and `subtitle` props!
- **Component Re-usability:** Instead of reinventing a bespoke properties editor component for the Canvas, it is much simpler and safer to pass `hideSpells={true}` and `hideAlwaysCast={true}` into the existing, thoroughly tested `<WandEditor>`. This honors a single source of truth for attribute syncing and UI.
- **EvalResults Data Lifecycle:** By default, visual analysis nodes (Stats, Tree) rely on `evalResults`. In the conventional view, this is populated manually when expanding an accordion list item. When jumping straight into Canvas Mode, we bypass that flow; thus, it's critical to iterate over wands and invoke a silent `requestEvaluation` on mount to pre-fetch the visual trees.
