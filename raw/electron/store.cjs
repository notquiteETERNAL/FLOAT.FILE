const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const MAX_RECENT = 10;
let recent = [];

function readJson(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), name), "utf8"));
  } catch {
    return null;
  }
}

function writeJson(name, data) {
  try {
    const file = path.join(app.getPath("userData"), name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFile(file, JSON.stringify(data), () => {});
  } catch {}
}

function loadRecent() {
  const saved = readJson("recent.json");
  recent = Array.isArray(saved) ? saved.filter((p) => typeof p === "string").slice(0, MAX_RECENT) : [];
}

function saveRecent() {
  writeJson("recent.json", recent);
}

module.exports = {
  readJson,
  writeJson,
  loadRecent,
  getRecent: () => recent,
  addRecent(filePath) {
    recent = [filePath, ...recent.filter((p) => p !== filePath)].slice(0, MAX_RECENT);
    saveRecent();
  },
  removeRecent(filePath) {
    recent = recent.filter((p) => p !== filePath);
    saveRecent();
  },
  clearRecent() {
    recent = [];
    saveRecent();
  },
};
