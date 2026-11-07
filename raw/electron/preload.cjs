const { contextBridge, ipcRenderer, webUtils } = require("electron");

function getPaths(fileList) {
  return [...(fileList || [])]
    .map((file) => {
      try {
        return webUtils.getPathForFile(file);
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

// the page can't see real file paths, so drops and picks are turned into paths here
window.addEventListener("dragover", (e) => e.preventDefault(), true);

window.addEventListener(
  "drop",
  (e) => {
    e.preventDefault();
    const paths = getPaths(e.dataTransfer?.files);
    if (paths.length) ipcRenderer.send("file:open", paths);
  },
  true,
);

window.addEventListener(
  "change",
  (e) => {
    const el = e.target;
    if (el && el.tagName === "INPUT" && el.type === "file") {
      const paths = getPaths(el.files);
      if (paths.length) ipcRenderer.send("file:open", paths);
    }
  },
  true,
);

function listen(channel, cb) {
  const handler = (_event, ...args) => cb(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("floatFile", {
  setPinned: (pinned) => ipcRenderer.send("pin:set", Boolean(pinned)),
  minimize: () => ipcRenderer.send("win:minimize"),
  close: () => ipcRenderer.send("win:close"),
  dragStart: () => ipcRenderer.send("drag:start"),
  dragStop: () => ipcRenderer.send("drag:stop"),
  resizeStart: (dir) => ipcRenderer.send("resize:start", dir),
  ready: (width, height, lockAspect) => ipcRenderer.send("float:ready", { width, height, lockAspect }),
  setLocked: (flag) => ipcRenderer.send("lock:set", Boolean(flag)),
  getLocked: () => ipcRenderer.invoke("lock:get"),
  onLock: (cb) => listen("lock:changed", cb),
  showLockMenu: (x, y) => ipcRenderer.send("lock:menu", { x, y }),
  getBind: () => ipcRenderer.invoke("bind:get"),
  onBind: (cb) => listen("bind:state", cb),
  showRecent: (x, y) => ipcRenderer.send("recent:show", { x, y }),
  snap: (spot) => ipcRenderer.send("float:snap", spot),
  setOpacity: (value) => ipcRenderer.send("float:opacity", value),
  getActive: () => ipcRenderer.invoke("active:get"),
  onActive: (cb) => listen("active:changed", cb),
  onOpacity: (cb) => listen("float:opacity", cb),
  readText: () => ipcRenderer.invoke("float:text"),
  onTogglePlay: (cb) => listen("float:toggle-play", cb),
  onError: (cb) => listen("file:error", cb),
});
