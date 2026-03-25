/**
 * Spell icon image cache for Canvas 2D rendering.
 * Loads spell icons as HTMLImageElement and caches them globally.
 * Triggers a callback when any new icon finishes loading so the canvas can repaint.
 */

import { getIconUrl } from '../lib/evaluatorAdapter';

const iconCache = new Map<string, HTMLImageElement>();
const loadingSet = new Set<string>();
const failedSet = new Set<string>();
const listenersMap = new Map<string, Set<() => void>>();

function addListener(url: string, listener?: () => void) {
  if (!listener) return;
  const listeners = listenersMap.get(url) ?? new Set<() => void>();
  listeners.add(listener);
  listenersMap.set(url, listeners);
}

function flushListeners(url: string) {
  const listeners = listenersMap.get(url);
  if (!listeners) return;
  listenersMap.delete(url);
  listeners.forEach(listener => listener());
}

/**
 * Get a cached HTMLImageElement for the given icon path.
 * Returns null if not yet loaded. Starts loading if needed and calls
 * `onLoad` when the image becomes available.
 */
export function getCachedIcon(
  iconPath: string,
  isConnected: boolean,
  onLoad?: () => void
): HTMLImageElement | null {
  if (!iconPath) return null;

  const url = getIconUrl(iconPath, isConnected);
  if (!url) return null;

  const cached = iconCache.get(url);
  if (cached) return cached;

  if (failedSet.has(url)) return null;
  addListener(url, onLoad);
  if (loadingSet.has(url)) return null;

  // Start loading
  loadingSet.add(url);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    loadingSet.delete(url);
    iconCache.set(url, img);
    flushListeners(url);
  };
  img.onerror = () => {
    loadingSet.delete(url);
    failedSet.add(url);
    flushListeners(url);
  };
  img.src = url;
  return null;
}

/**
 * Preload multiple icon paths at once. Calls `onBatchDone` once all pending
 * images in this batch have loaded (or failed).
 */
export function preloadIcons(
  iconPaths: string[],
  isConnected: boolean,
  onBatchDone?: () => void
): void {
  let pending = 0;
  const done = () => {
    pending--;
    if (pending <= 0) onBatchDone?.();
  };

  for (const path of iconPaths) {
    if (!path) continue;
    const url = getIconUrl(path, isConnected);
    if (!url || iconCache.has(url) || failedSet.has(url) || loadingSet.has(url)) continue;

    pending++;
    loadingSet.add(url);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadingSet.delete(url);
      iconCache.set(url, img);
      flushListeners(url);
      done();
    };
    img.onerror = () => {
      loadingSet.delete(url);
      failedSet.add(url);
      flushListeners(url);
      done();
    };
    img.src = url;
  }

  if (pending === 0) onBatchDone?.();
}

/** Get the global cache for direct lookups */
export function getIconCache(): Map<string, HTMLImageElement> {
  return iconCache;
}
