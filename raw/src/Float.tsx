import { useEffect, useRef, useState } from "react";
import Grips from "./Grips";

type Kind = "image" | "video" | "audio" | "pdf" | "text" | "other";

const params = new URLSearchParams(window.location.search);
const src = params.get("src") ?? "";
const name = params.get("name") ?? "";
const size = Number(params.get("size") ?? 0);
const startKind = (params.get("kind") ?? "other") as Kind;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

export default function Float() {
  const api = window.floatFile;
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const readySent = useRef(false);
  const [kind, setKind] = useState<Kind>(startKind);
  const [text, setText] = useState<{ text: string; truncated: boolean } | null>(null);
  const [playing, setPlaying] = useState(true);

  const ready = (width: number, height: number, lockAspect: boolean) => {
    if (readySent.current) return;
    readySent.current = true;
    api?.ready(width, height, lockAspect);
  };

  const togglePlay = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  useEffect(() => {
    if (kind === "pdf") ready(620, 800, false);
    else if (kind === "audio") ready(380, 120, false);
    else if (kind === "other") ready(360, 200, false);
    else if (kind === "text") {
      void api?.readText().then((result) => {
        setText(result);
        ready(640, 460, false);
      });
    }
  }, [kind]);

  useEffect(() => api?.onTogglePlay(togglePlay), [api]);

  useEffect(
    () =>
      api?.onOpacity((value) => {
        document.documentElement.style.opacity = String(value / 100);
      }),
    [api],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") api?.close();
      if (e.key === " " && mediaRef.current) {
        e.preventDefault();
        togglePlay();
      }
    };
    const release = () => {
      if (!pressRef.current) return;
      pressRef.current = null;
      api?.dragStop();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mouseup", release);
      window.removeEventListener("blur", release);
    };
  }, [api]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    pressRef.current = { x: e.screenX, y: e.screenY };
    api?.dragStart();
  };

  // a press that barely moved counts as a click
  const onMouseUp = (e: React.MouseEvent) => {
    const start = pressRef.current;
    if (!start || !mediaRef.current) return;
    if (Math.hypot(e.screenX - start.x, e.screenY - start.y) < 4) togglePlay();
  };

  const body = () => {
    switch (kind) {
      case "image":
        return (
          <img
            className="float-media"
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              ready(w || 480, h || 360, true);
            }}
            onError={() => setKind("other")}
          />
        );
      case "video":
        return (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            className="float-media"
            src={src}
            autoPlay
            loop
            onLoadedMetadata={(e) => {
              const { videoWidth: w, videoHeight: h } = e.currentTarget;
              ready(w || 480, h || 360, Boolean(w && h));
            }}
            onError={() => setKind("other")}
          />
        );
      case "audio":
        return (
          <div className="float-card">
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={src}
              autoPlay
              loop
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => setKind("other")}
            />
            <span className="ext-badge">{playing ? "Playing" : "Paused"}</span>
            <strong>{name}</strong>
            <small>Click to play / pause</small>
          </div>
        );
      case "pdf":
        return (
          <>
            <iframe className="float-media float-frame" src={src} title="FLOAT.FILE" />
            <div className="pdf-grip" />
          </>
        );
      case "text":
        return (
          <pre className="float-text">
            {text?.text}
            {text?.truncated && "\n\n… (showing the first 1 MB)"}
          </pre>
        );
      default:
        return (
          <div className="float-card">
            <span className="ext-badge">{(name.split(".").pop() ?? "file").slice(0, 5)}</span>
            <strong>{name}</strong>
            <small>{formatSize(size)} · no preview available for this file type</small>
          </div>
        );
    }
  };

  return (
    <div className="float-root" onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
      {body()}
      <Grips onStart={(e) => (pressRef.current = { x: e.screenX, y: e.screenY })} />
    </div>
  );
}
