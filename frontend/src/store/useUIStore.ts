import { create } from 'zustand';
import { AppNotification, HoveredSpellSlot, SpellAreaSelection, SpellDragSource } from '../types';

type HoveredSlot = HoveredSpellSlot | null;
type HoverResolver = (clientX: number, clientY: number) => HoveredSlot;

interface UIState {
    mobileModifiers: {
        alt: boolean;
        ctrl: boolean;
        shift: boolean;
    };
    isMobileToolbarVisible: boolean;

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
    selection: SpellAreaSelection | null;
    dragSource: SpellDragSource | null;
    hoveredSlot: HoveredSlot;
    hoverResolvers: Record<string, HoverResolver>;

    // Actions
    setIsSettingsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    setIsWarehouseOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    toggleMobileModifier: (key: 'alt' | 'ctrl' | 'shift') => void;
    clearMobileModifiers: () => void;
    consumeMobileModifiers: () => void;
    setIsMobileToolbarVisible: (open: boolean | ((prev: boolean) => boolean)) => void;
    setIsHistoryOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    setIsModManagerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    setNotification: (notification: AppNotification | null) => void;
    setModBundleInfo: (info: { active: number; total: number; bundleId: string | null }) => void;
    setSettingsCategoryOverride: (category: 'general' | 'appearance' | 'wand' | 'cast' | 'sync' | 'spell_types' | 'data' | null) => void;
    setSettingsExpandedBundleId: (id: string | null) => void;

    setSelection: (s: SpellAreaSelection | null) => void;
    setDragSource: (s: SpellDragSource | null) => void;
    setHoveredSlot: (s: HoveredSlot) => void;
    markModeActive: boolean;
    wikiModeActive: boolean;
    registerHoverResolver: (id: string, resolver: HoverResolver) => void;
    unregisterHoverResolver: (id: string) => void;
    resolveHoveredSlotAtPoint: (clientX: number, clientY: number) => HoveredSlot;

    // Helpers
    showNotification: (msg: string, type?: string, duration?: number) => void;
    closeAllModals: () => void;
    setMarkModeActive: (active: boolean | ((prev: boolean) => boolean)) => void;
    toggleMarkMode: () => void;
    setWikiModeActive: (active: boolean | ((prev: boolean) => boolean)) => void;
    toggleWikiMode: () => void;
    consumeWikiMode: () => void;
    consumeMarkMode: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
    mobileModifiers: { alt: false, ctrl: false, shift: false },
    isMobileToolbarVisible: true,
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
    markModeActive: false,
    wikiModeActive: false,
    hoverResolvers: {},

    setIsSettingsOpen: (open) => set((state) => ({ isSettingsOpen: typeof open === 'function' ? open(state.isSettingsOpen) : open })),
    setIsWarehouseOpen: (open) => set((state) => ({ isWarehouseOpen: typeof open === 'function' ? open(state.isWarehouseOpen) : open })),
    setIsHistoryOpen: (open) => set((state) => ({ isHistoryOpen: typeof open === 'function' ? open(state.isHistoryOpen) : open })),
    toggleMobileModifier: (key) => set((state) => ({
        mobileModifiers: { ...state.mobileModifiers, [key]: !state.mobileModifiers[key] }
    })),
    clearMobileModifiers: () => set({ mobileModifiers: { alt: false, ctrl: false, shift: false } }),
    consumeMobileModifiers: () => {
        const { mobileModifiers } = get();
        if (mobileModifiers.alt || mobileModifiers.ctrl || mobileModifiers.shift) {
            set({ mobileModifiers: { alt: false, ctrl: false, shift: false } });
        }
    },
    setIsMobileToolbarVisible: (open) => set((state) => ({
        isMobileToolbarVisible: typeof open === 'function' ? open(state.isMobileToolbarVisible) : open
    })),
    setMarkModeActive: (active) => set((state) => ({ markModeActive: typeof active === 'function' ? active(state.markModeActive) : active })),
    toggleMarkMode: () => set((state) => ({ markModeActive: !state.markModeActive })),
    setWikiModeActive: (active) => set((state) => ({ wikiModeActive: typeof active === 'function' ? active(state.wikiModeActive) : active })),
    toggleWikiMode: () => set((state) => ({ wikiModeActive: !state.wikiModeActive })),
    consumeWikiMode: () => {
        if (get().wikiModeActive) {
            set({ wikiModeActive: false });
        }
    },
    consumeMarkMode: () => {
        if (get().markModeActive) {
            set({ markModeActive: false });
        }
    },
    setIsModManagerOpen: (open) => set((state) => ({ isModManagerOpen: typeof open === 'function' ? open(state.isModManagerOpen) : open })),
    setNotification: (notification) => set({ notification }),
    setModBundleInfo: (modBundleInfo) => set({ modBundleInfo }),
    setSettingsCategoryOverride: (category) => set({ settingsCategoryOverride: category }),
    setSettingsExpandedBundleId: (id) => set({ settingsExpandedBundleId: id }),

    setSelection: (selection) => set({ selection }),
    setDragSource: (dragSource) => set({ dragSource }),
    setHoveredSlot: (hoveredSlot) => set({ hoveredSlot }),
    registerHoverResolver: (id, resolver) => set((state) => ({ hoverResolvers: { ...state.hoverResolvers, [id]: resolver } })),
    unregisterHoverResolver: (id) => set((state) => {
        const next = { ...state.hoverResolvers };
        delete next[id];
        return { hoverResolvers: next };
    }),
    resolveHoveredSlotAtPoint: (clientX, clientY) => {
        const resolvers = Object.values(get().hoverResolvers);
        for (let i = resolvers.length - 1; i >= 0; i--) {
            const hit = resolvers[i](clientX, clientY);
            if (hit) return hit;
        }
        return null;
    },

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
