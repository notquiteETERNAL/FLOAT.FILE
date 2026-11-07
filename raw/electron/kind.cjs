const fs = require("node:fs");
const path = require("node:path");

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg", "apng"]);
const VIDEO_EXT = new Set(["mp4", "webm", "ogv", "mov", "m4v", "mkv"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus"]);

async function looksLikeText(filePath) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    if (bytesRead === 0) return true;
    const head = buf.subarray(0, bytesRead);
    if (head.includes(0)) return false;
    try {
      // drop the last few bytes in case a character got cut in half
      new TextDecoder("utf-8", { fatal: true }).decode(head.subarray(0, Math.max(0, bytesRead - 3)));
      return true;
    } catch {
      return false;
    }
  } finally {
    await handle.close();
  }
}

async function getKind(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  try {
    return (await looksLikeText(filePath)) ? "text" : "other";
  } catch {
    return "other";
  }
}

module.exports = { getKind };
