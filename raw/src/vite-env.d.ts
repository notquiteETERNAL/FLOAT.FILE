/// <reference types="vite/client" />

interface Window {
  floatFile?: {
    setPinned: (pinned: boolean) => void;
    minimize: () => void;
    close: () => void;
    dragStart: () => void;
    resizeStart: (dir: string) => void;
    dragStop: () => void;
    ready: (width: number, height: number, lockAspect: boolean) => void;
    setLocked: (locked: boolean) => void;
    getLocked: () => Promise<boolean>;
    onLock: (cb: (locked: boolean) => void) => () => void;
    showLockMenu: (x: number, y: number) => void;
    getBind: () => Promise<string>;
    onBind: (cb: (state: { capturing: boolean; label: string; message: string }) => void) => () => void;
    showRecent: (x: number, y: number) => void;
    snap: (spot: string) => void;
    setOpacity: (value: number) => void;
    getActive: () => Promise<{ has: boolean; opacity: number }>;
    onActive: (cb: (info: { has: boolean; opacity: number }) => void) => () => void;
    onOpacity: (cb: (value: number) => void) => () => void;
    readText: () => Promise<{ text: string; truncated: boolean }>;
    onTogglePlay: (cb: () => void) => () => void;
    onError: (cb: (message: string) => void) => () => void;
  };
}
