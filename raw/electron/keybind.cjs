const { globalShortcut } = require("electron");
const store = require("./store.cjs");

// uiohook only watches keys, so the keybind still works normally in other programs
let hook = null;
try {
  hook = require("uiohook-napi");
} catch {}

const CAPTURE_TIMEOUT = 10000;
const MODIFIER_KEYS = new Set(["Ctrl", "CtrlRight", "Alt", "AltRight", "Shift", "ShiftRight", "Meta", "MetaRight"]);
const keyNames = new Map(hook ? Object.entries(hook.UiohookKey).map(([name, code]) => [code, name]) : []);

let bind = null;
let capturing = false;
let captureTimer = null;
let toggle = () => {};
let notify = () => {};

const defaultBind = () => ({ code: hook?.UiohookKey.L ?? 0x26, ctrl: true, alt: true, shift: false, meta: false });

function label() {
  if (!hook) return "Ctrl+Alt+L";
  const parts = [];
  if (bind.ctrl) parts.push("Ctrl");
  if (bind.alt) parts.push("Alt");
  if (bind.shift) parts.push("Shift");
  if (bind.meta) parts.push("Win");
  parts.push(keyNames.get(bind.code) ?? `Key ${bind.code}`);
  return parts.join("+");
}

function send(message = "") {
  notify({ capturing, label: label(), message });
}

function endCapture(message) {
  clearTimeout(captureTimer);
  capturing = false;
  send(message);
}

function startCapture() {
  if (!hook) return send("Custom keybinds aren't available");
  capturing = true;
  clearTimeout(captureTimer);
  captureTimer = setTimeout(() => endCapture("Cancelled"), CAPTURE_TIMEOUT);
  send();
}

function captureKey(e) {
  const name = keyNames.get(e.keycode);
  if (name === "Escape") return endCapture("Cancelled");
  if (MODIFIER_KEYS.has(name)) return;
  bind = { code: e.keycode, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
  store.writeJson("settings.json", { keybind: bind });
  endCapture(`Keybind set to ${label()}`);
}

function reset() {
  bind = defaultBind();
  store.writeJson("settings.json", { keybind: bind });
  send("Keybind reset");
}

function matches(e) {
  return (
    e.keycode === bind.code &&
    e.ctrlKey === bind.ctrl &&
    e.altKey === bind.alt &&
    e.shiftKey === bind.shift &&
    e.metaKey === bind.meta
  );
}

function init({ onToggle, onState }) {
  toggle = onToggle;
  notify = onState;

  bind = defaultBind();
  const saved = store.readJson("settings.json")?.keybind;
  if (saved && Number.isInteger(saved.code)) {
    bind = { code: saved.code, ctrl: !!saved.ctrl, alt: !!saved.alt, shift: !!saved.shift, meta: !!saved.meta };
  }

  if (!hook) {
    globalShortcut.register("CommandOrControl+Alt+L", toggle);
    return;
  }

  // keys already down are skipped so holding the combo doesn't flip the lock over and over
  const held = new Set();
  hook.uIOhook.on("keyup", (e) => held.delete(e.keycode));
  hook.uIOhook.on("keydown", (e) => {
    if (held.has(e.keycode)) return;
    held.add(e.keycode);
    if (capturing) captureKey(e);
    else if (matches(e)) toggle();
  });
  hook.uIOhook.start();
}

function stop() {
  globalShortcut.unregisterAll();
  hook?.uIOhook.stop();
}

module.exports = { init, stop, label, startCapture, reset };
