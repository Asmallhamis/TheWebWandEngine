import { create } from 'zustand';
import { AppNotification } from '../types';

interface UIState {
    // Modal States
    isSettingsOpen: boolean;
    isWarehouseOpen: boolean;
    isHistoryOpen: boolean;
    isModManagerOpen: boolean;

    // Notification State
    notification: AppNotification | null;

    // Category Overrides for Settings
    settingsCategoryOverride: 'general' | 'appearance' | 'wand' | 'cast' | 'sync' | 'spell_types' | 'data' | null;
    settingsExpandedBundleId: string | null;
    modBundleInfo: { active: number; total: number; bundleId: string | null };

    // Interaction States
    selection: { wandSlot: string, indices: number[], startIdx: number } | null;
    dragSource: { wandSlot: string, idx: number, sid: string } | null;
    hoveredSlot: { wandSlot: string, idx: number, isRightHalf: boolean } | null;

    // Actions
    setIsSettingsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    setIsWarehouseOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    setIsHistoryOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    setIsModManagerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    setNotification: (notification: AppNotification | null) => void;
    setModBundleInfo: (info: { active: number; total: number; bundleId: string | null }) => void;
    setSettingsCategoryOverride: (category: 'general' | 'appearance' | 'wand' | 'cast' | 'sync' | 'spell_types' | 'data' | null) => void;
    setSettingsExpandedBundleId: (id: string | null) => void;

    setSelection: (s: { wandSlot: string, indices: number[], startIdx: number } | null) => void;
    setDragSource: (s: { wandSlot: string, idx: number, sid: string } | null) => void;
    setHoveredSlot: (s: { wandSlot: string, idx: number, isRightHalf: boolean } | null) => void;

    // Helpers
    showNotification: (msg: string, type?: string, duration?: number) => void;
    closeAllModals: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    isSettingsOpen: false,
    isWarehouseOpen: false,
    isHistoryOpen: false,
    isModManagerOpen: false,
    notification: null,
    settingsCategoryOverride: null,
    settingsExpandedBundleId: null,
    modBundleInfo: { active: 0, total: 0, bundleId: null },
    selection: null,
    dragSource: null,
    hoveredSlot: null,

    setIsSettingsOpen: (open) => set((state) => ({ isSettingsOpen: typeof open === 'function' ? open(state.isSettingsOpen) : open })),
    setIsWarehouseOpen: (open) => set((state) => ({ isWarehouseOpen: typeof open === 'function' ? open(state.isWarehouseOpen) : open })),
    setIsHistoryOpen: (open) => set((state) => ({ isHistoryOpen: typeof open === 'function' ? open(state.isHistoryOpen) : open })),
    setIsModManagerOpen: (open) => set((state) => ({ isModManagerOpen: typeof open === 'function' ? open(state.isModManagerOpen) : open })),
    setNotification: (notification) => set({ notification }),
    setModBundleInfo: (modBundleInfo) => set({ modBundleInfo }),
    setSettingsCategoryOverride: (category) => set({ settingsCategoryOverride: category }),
    setSettingsExpandedBundleId: (id) => set({ settingsExpandedBundleId: id }),

    setSelection: (selection) => set({ selection }),
    setDragSource: (dragSource) => set({ dragSource }),
    setHoveredSlot: (hoveredSlot) => set({ hoveredSlot }),

    showNotification: (msg, type = 'info', duration = 3000) => {
        set({ notification: { msg, type: type as any } });
        if (duration > 0) {
            setTimeout(() => {
                set((state) => {
                    if (state.notification?.msg === msg) {
                        return { notification: null };
                    }
                    return state;
                });
            }, duration);
        }
    },

    closeAllModals: () => set({
        isSettingsOpen: false,
        isWarehouseOpen: false,
        isHistoryOpen: false,
        isModManagerOpen: false
    }),
}));
