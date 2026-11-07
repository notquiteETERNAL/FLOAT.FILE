const { app, BrowserWindow, Menu, ipcMain, screen, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const store = require("./store.cjs");
const keybind = require("./keybind.cjs");
const { getKind } = require("./kind.cjs");

const APP_NAME = "FLOAT.FILE";
const DIST = path.join(__dirname, "..", "dist");
const ICON = path.join(DIST, "icon.png");
const MAX_TEXT_BYTES = 1024 * 1024;
const MIN_FLOAT = 40;
const SPOTS = new Set(["center", "top-left", "top-right", "bottom-left", "bottom-right"]);

let launcher = null;
let pinned = true;
let locked = false;
let cascade = 0;
const floats = []; // oldest first, the last one is the "selected" file
const moving = new Map();

app.setName(APP_NAME);
app.setAppUserModelId(APP_NAME);

/* ---------- helpers ---------- */

const windowFrom = (event) => BrowserWindow.fromWebContents(event.sender);

function toLauncher(channel, payload) {
  if (launcher && !launcher.isDestroyed()) launcher.webContents.send(channel, payload);
}

function setPinned(win, flag) {
  if (win && !win.isDestroyed()) win.setAlwaysOnTop(flag, "screen-saver");
}

function popup(win, items, pos) {
  const at = pos ? { x: Math.round(pos.x), y: Math.round(pos.y) } : {};
  Menu.buildFromTemplate(items).popup({ window: win, ...at });
}

function createWindow(options) {
  const win = new BrowserWindow({
    title: APP_NAME,
    icon: ICON,
    frame: false,
    transparent: true,
    thickFrame: false,
    hasShadow: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: false,
    },
    ...options,
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  setPinned(win, pinned);
  return win;
}

/* ---------- selected file, lock ---------- */

function activeFloat() {
  for (let i = floats.length - 1; i >= 0; i--) {
    if (!floats[i].isDestroyed()) return floats[i];
  }
  return null;
}

function activeInfo() {
  const win = activeFloat();
  return { has: Boolean(win), opacity: win ? win.__float.opacity : 100 };
}

function notifyActive() {
  toLauncher("active:changed", activeInfo());
}

function setActive(win) {
  if (floats[floats.length - 1] === win) return;
  const i = floats.indexOf(win);
  if (i !== -1) floats.splice(i, 1);
  floats.push(win);
  notifyActive();
}

function setLocked(flag) {
  locked = flag;
  for (const win of floats) if (!win.isDestroyed()) win.setIgnoreMouseEvents(locked);
  toLauncher("lock:changed", locked);
}

/* ---------- windows ---------- */

function createLauncher() {
  launcher = createWindow({ width: 440, height: 224, minWidth: 420, minHeight: 224 });
  launcher.loadFile(path.join(DIST, "index.html"));
  launcher.once("ready-to-show", () => launcher.show());
  launcher.on("closed", () => {
    launcher = null;
    app.quit();
  });
}

function showFloat(win) {
  if (locked) win.showInactive();
  else win.show();
}

async function openFloat(filePath) {
  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    store.removeRecent(filePath);
    return "Couldn't read that file.";
  }
  if (!stat.isFile()) return "Folders aren't supported.";
  store.addRecent(filePath);

  const kind = await getKind(filePath);
  const win = createWindow({ width: 360, height: 260, minWidth: MIN_FLOAT, minHeight: MIN_FLOAT });
  win.__float = { filePath, kind, natural: null, opacity: 100 };
  if (locked) win.setIgnoreMouseEvents(true);
  setActive(win);
  win.on("focus", () => setActive(win));

  win.loadFile(path.join(DIST, "float.html"), {
    query: {
      src: pathToFileURL(filePath).href,
      name: path.basename(filePath),
      kind,
      size: String(stat.size),
    },
  });

  // if the page never reports its size, show the window anyway
  const showAnyway = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) showFloat(win);
  }, 4000);

  win.on("closed", () => {
    clearTimeout(showAnyway);
    stopMoving(win);
    const i = floats.indexOf(win);
    if (i !== -1) floats.splice(i, 1);
    notifyActive();
  });
  win.webContents.on("context-menu", () => showFloatMenu(win));
  return null;
}

function showFloatMenu(win) {
  const info = win.__float;
  const items = [
    {
      label: "Always on top",
      type: "checkbox",
      checked: win.isAlwaysOnTop(),
      click: (item) => setPinned(win, item.checked),
    },
  ];
  if (info.kind === "video" || info.kind === "audio") {
    items.push({ label: "Play / Pause", click: () => win.webContents.send("float:toggle-play") });
  }
  if (info.natural) {
    items.push({ label: "Original size", click: () => placeFloat(win, info.natural, false) });
  }
  items.push(
    { type: "separator" },
    { label: "Show in folder", click: () => shell.showItemInFolder(info.filePath) },
    { label: "Close", click: () => win.close() },
  );
  popup(win, items);
}

// sizes the window to the file (shrunk to fit the screen) and keeps it on screen
function placeFloat(win, natural, firstShow) {
  const current = win.getBounds();
  const display = firstShow
    ? screen.getDisplayNearestPoint(
        launcher && !launcher.isDestroyed() ? launcher.getBounds() : screen.getCursorScreenPoint(),
      )
    : screen.getDisplayMatching(current);
  const area = display.workArea;

  const scale = Math.min(1, (area.width * 0.85) / natural.width, (area.height * 0.85) / natural.height);
  const width = Math.max(MIN_FLOAT, Math.round(natural.width * scale));
  const height = Math.max(MIN_FLOAT, Math.round(natural.height * scale));

  let x = current.x;
  let y = current.y;
  if (firstShow) {
    const offset = (cascade++ % 8) * 28;
    x = area.x + Math.round((area.width - width) / 2) + offset;
    y = area.y + Math.round((area.height - height) / 2) + offset;
  }
  x = Math.min(Math.max(x, area.x), area.x + Math.max(0, area.width - width));
  y = Math.min(Math.max(y, area.y), area.y + Math.max(0, area.height - height));

  win.setBounds({ x, y, width, height });
}

/* ---------- moving and resizing ---------- */

function stopMoving(win) {
  clearInterval(moving.get(win));
  moving.delete(win);
}

// follows the cursor and applies `compute(dx, dy)` to the window until the mouse is released
function trackCursor(win, compute) {
  stopMoving(win);
  const start = screen.getCursorScreenPoint();
  let lastX = start.x;
  let lastY = start.y;
  const timer = setInterval(() => {
    if (win.isDestroyed()) return stopMoving(win);
    const p = screen.getCursorScreenPoint();
    if (p.x === lastX && p.y === lastY) return;
    lastX = p.x;
    lastY = p.y;
    win.setBounds(compute(p.x - start.x, p.y - start.y));
  }, 8);
  moving.set(win, timer);
}

ipcMain.on("drag:start", (event) => {
  const win = windowFrom(event);
  if (!win) return;
  const b = win.getBounds();
  trackCursor(win, (dx, dy) => ({ x: b.x + dx, y: b.y + dy, width: b.width, height: b.height }));
});

ipcMain.on("drag:stop", (event) => {
  const win = windowFrom(event);
  if (win) stopMoving(win);
});

// transparent windows have no native resize border on Windows, so the edges are handled here
ipcMain.on("resize:start", (event, dir) => {
  const win = windowFrom(event);
  if (!win || typeof dir !== "string" || !/^[nsew]{1,2}$/.test(dir)) return;

  const b = win.getBounds();
  const ratio = b.width / b.height;
  const keepRatio = Boolean(win.__float?.natural?.lockAspect);
  const [minW, minH] = win.getMinimumSize();
  const north = dir.includes("n");
  const south = dir.includes("s");
  const west = dir.includes("w");
  const east = dir.includes("e");
  const minScale = Math.max(MIN_FLOAT / b.width, MIN_FLOAT / b.height);

  trackCursor(win, (dx, dy) => {
    let w = b.width + (east ? dx : 0) - (west ? dx : 0);
    let h = b.height + (south ? dy : 0) - (north ? dy : 0);

    if (keepRatio) {
      if (east || west) {
        if ((north || south) && h / b.height > w / b.width) w = h * ratio;
        else h = w / ratio;
      } else {
        w = h * ratio;
      }
      const scale = Math.max(minScale, w / b.width);
      w = b.width * scale;
      h = b.height * scale;
    } else {
      w = Math.max(minW, w);
      h = Math.max(minH, h);
    }

    w = Math.round(w);
    h = Math.round(h);
    return {
      x: west ? b.x + b.width - w : b.x,
      y: north ? b.y + b.height - h : b.y,
      width: w,
      height: h,
    };
  });
});

/* ---------- launcher controls ---------- */

ipcMain.on("pin:set", (_event, flag) => {
  pinned = Boolean(flag);
  for (const win of BrowserWindow.getAllWindows()) setPinned(win, pinned);
});

ipcMain.handle("lock:get", () => locked);
ipcMain.on("lock:set", (_event, flag) => setLocked(Boolean(flag)));
ipcMain.handle("bind:get", () => keybind.label());

ipcMain.on("lock:menu", (event, pos) => {
  popup(
    windowFrom(event),
    [
      { label: `Keybind: ${keybind.label()}`, enabled: false },
      { type: "separator" },
      { label: "Change keybind…", click: keybind.startCapture },
      { label: "Reset to Ctrl+Alt+L", click: keybind.reset },
    ],
    pos,
  );
});

ipcMain.handle("active:get", () => activeInfo());

ipcMain.on("float:opacity", (_event, value) => {
  const win = activeFloat();
  const percent = Math.round(Number(value));
  if (!win || !Number.isFinite(percent)) return;
  win.__float.opacity = Math.min(100, Math.max(0, percent));
  win.webContents.send("float:opacity", win.__float.opacity);
  notifyActive();
});

ipcMain.on("float:snap", (_event, spot) => {
  const win = activeFloat();
  if (!win || !SPOTS.has(spot)) return;
  const b = win.getBounds();
  const area = screen.getDisplayMatching(b).workArea;
  const middleX = area.x + Math.round((area.width - b.width) / 2);
  const middleY = area.y + Math.round((area.height - b.height) / 2);
  const x = spot.endsWith("left") ? area.x : spot.endsWith("right") ? area.x + area.width - b.width : middleX;
  const y = spot.startsWith("top") ? area.y : spot.startsWith("bottom") ? area.y + area.height - b.height : middleY;
  win.setBounds({ x, y, width: b.width, height: b.height });
});

ipcMain.on("recent:show", (event, pos) => {
  const items = store.getRecent().map((filePath) => {
    const name = path.basename(filePath);
    const label = name.length > 42 ? `${name.slice(0, 41)}…` : name;
    return {
      label: label.replace(/&/g, "&&"),
      click: async () => {
        const error = await openFloat(filePath);
        if (error && !event.sender.isDestroyed()) event.sender.send("file:error", error);
      },
    };
  });
  if (items.length) {
    items.push({ type: "separator" }, { label: "Clear list", click: store.clearRecent });
  } else {
    items.push({ label: "No recent files", enabled: false });
  }
  popup(windowFrom(event), items, pos);
});

ipcMain.on("win:minimize", (event) => windowFrom(event)?.minimize());
ipcMain.on("win:close", (event) => windowFrom(event)?.close());

ipcMain.on("file:open", async (event, paths) => {
  if (!Array.isArray(paths)) return;
  let firstError = null;
  for (const p of paths) {
    if (typeof p !== "string") continue;
    firstError = (await openFloat(p)) || firstError;
  }
  if (firstError && !event.sender.isDestroyed()) event.sender.send("file:error", firstError);
});

/* ---------- floating file pages ---------- */

ipcMain.on("float:ready", (event, size) => {
  const win = windowFrom(event);
  if (!win || !win.__float || win.isVisible()) return;
  const natural = {
    width: Math.max(1, Number(size?.width) || 480),
    height: Math.max(1, Number(size?.height) || 360),
    lockAspect: Boolean(size?.lockAspect),
  };
  win.__float.natural = natural;
  placeFloat(win, natural, true);
  showFloat(win);
});

ipcMain.handle("float:text", async (event) => {
  const info = windowFrom(event)?.__float;
  if (!info) return { text: "", truncated: false };
  const handle = await fs.promises.open(info.filePath, "r");
  try {
    const { size } = await handle.stat();
    const buf = Buffer.alloc(Math.min(size, MAX_TEXT_BYTES));
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    return { text: buf.subarray(0, bytesRead).toString("utf8"), truncated: size > MAX_TEXT_BYTES };
  } finally {
    await handle.close();
  }
});

/* ---------- startup ---------- */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!launcher) return;
    if (launcher.isMinimized()) launcher.restore();
    launcher.focus();
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    store.loadRecent();
    createLauncher();
    keybind.init({
      onToggle: () => setLocked(!locked),
      onState: (state) => toLauncher("bind:state", state),
    });
  });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", keybind.stop);
}
