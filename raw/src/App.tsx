import { useEffect, useRef, useState } from "react";
import logo from "./assets/float-file-logo.png";
import Grips from "./Grips";
import { CloseIcon, LockIcon, MinimizeIcon, MinusIcon, PinIcon, PlusIcon, SpotIcon } from "./Icons";

const SPOTS = [
  { id: "center", title: "Center of the screen", x: 9.5, y: 10 },
  { id: "top-left", title: "Top left corner", x: 5, y: 7 },
  { id: "top-right", title: "Top right corner", x: 14, y: 7 },
  { id: "bottom-left", title: "Bottom left corner", x: 5, y: 13 },
  { id: "bottom-right", title: "Bottom right corner", x: 14, y: 13 },
];

const OPACITY_STEP = 5;
export default function App() {
  const api = window.floatFile;
  const inputRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const [isPinned, setIsPinned] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [bindLabel, setBindLabel] = useState("Ctrl+Alt+L");
  const [notice, setNotice] = useState({ text: "", isError: false });
  const [active, setActive] = useState({ has: false, opacity: 100 });
  const [opacityText, setOpacityText] = useState("100");

  useEffect(() => {
    api?.setPinned(isPinned);
  }, [api, isPinned]);

  const showNotice = (text: string, isError = false, duration = 4000) => {
    window.clearTimeout(noticeTimer.current);
    setNotice({ text, isError });
    if (duration) noticeTimer.current = window.setTimeout(() => setNotice({ text: "", isError: false }), duration);
  };

  useEffect(() => {
    void api?.getBind().then(setBindLabel);
    const stopError = api?.onError((message) => showNotice(message, true));
    const stopBind = api?.onBind(({ capturing, label, message }) => {
      setBindLabel(label);
      if (capturing) showNotice("Press the new keybind (Esc to cancel)", false, 0);
      else showNotice(message, false, 3000);
    });
    return () => {
      stopError?.();
      stopBind?.();
      window.clearTimeout(noticeTimer.current);
    };
  }, [api]);

  useEffect(() => {
    void api?.getLocked().then(setIsLocked);
    return api?.onLock(setIsLocked);
  }, [api]);

  useEffect(() => {
    void api?.getActive().then(setActive);
    return api?.onActive(setActive);
  }, [api]);

  useEffect(() => {
    setOpacityText(String(active.opacity));
  }, [active.opacity]);

  useEffect(() => {
    const release = () => api?.dragStop();
    window.addEventListener("mouseup", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("mouseup", release);
      window.removeEventListener("blur", release);
    };
  }, [api]);

  const startDrag = (e: React.MouseEvent) => {
    if (e.button === 0) api?.dragStart();
  };

  const changeOpacity = (value: number) => {
    api?.setOpacity(Math.min(100, Math.max(0, value)));
  };

  const onOpacityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, "").slice(0, 3);
    if (digits !== "") digits = String(Math.min(100, Number(digits)));
    setOpacityText(digits);
    if (digits !== "") changeOpacity(Number(digits));
  };

  return (
    <main
      className={`panel ${isDragging ? "is-dragging" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
      }}
      onDrop={(e) => {
        // the preload script picks up the files, this just resets the highlight
        e.preventDefault();
        setIsDragging(false);
      }}
    >
      <header className="toolbar">
        <div className="brand" onMouseDown={startDrag}>
          <img className="brand-logo" src={logo} alt="" draggable={false} />
          <strong>FLOAT.FILE</strong>
        </div>
        <div className="drag-spacer" onMouseDown={startDrag} />

        <div className="controls">
          <div className="toggle-pair">
            <button
              className={isPinned ? "is-active" : ""}
              type="button"
              aria-pressed={isPinned}
              title={isPinned ? "Always on top: on" : "Always on top: off"}
              onClick={() => setIsPinned((current) => !current)}
            >
              <PinIcon filled={isPinned} />
            </button>
            <button
              className={isLocked ? "is-active" : ""}
              type="button"
              aria-pressed={isLocked}
              title={`Click-through: ${isLocked ? "on" : "off"} (${bindLabel})`}
              onClick={() => api?.setLocked(!isLocked)}
              onContextMenu={(e) => {
                e.preventDefault();
                const box = e.currentTarget.getBoundingClientRect();
                api?.showLockMenu(box.left, box.bottom + 4);
              }}
            >
              <LockIcon locked={isLocked} />
            </button>
          </div>
          <button className="icon-btn" type="button" title="Minimize" onClick={() => api?.minimize()}>
            <MinimizeIcon />
          </button>
          <button className="icon-btn close" type="button" title="Close" onClick={() => api?.close()}>
            <CloseIcon />
          </button>
        </div>
      </header>

      <section className="stage">
        <button className="media-picker" type="button" onClick={() => inputRef.current?.click()}>
          <span className="add-icon">
            <PlusIcon />
          </span>
          <span className="picker-text">
            <strong>{isDragging ? "Drop to float" : "Select or drop files"}</strong>
            <small>Any file type · opens as a floating window</small>
          </span>
        </button>

        <button
          className="recent-btn"
          type="button"
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            api?.showRecent(box.left, box.bottom + 4);
          }}
        >
          Recent files
        </button>

        <div className="tools">
          {SPOTS.map((spot) => (
            <button
              key={spot.id}
              className="icon-btn"
              type="button"
              title={spot.title}
              disabled={!active.has}
              onClick={() => api?.snap(spot.id)}
            >
              <SpotIcon x={spot.x} y={spot.y} />
            </button>
          ))}

          <div className="opacity-group">
            <button
              className="icon-btn"
              type="button"
              title="More opaque"
              disabled={!active.has}
              onClick={() => changeOpacity(active.opacity + OPACITY_STEP)}
            >
              <PlusIcon />
            </button>
            <label className="opacity-field" title="Opacity">
              <input
                value={opacityText}
                inputMode="numeric"
                maxLength={3}
                disabled={!active.has}
                onChange={onOpacityInput}
                onBlur={() => setOpacityText(String(active.opacity))}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
              <span>%</span>
            </label>
            <button
              className="icon-btn"
              type="button"
              title="More transparent"
              disabled={!active.has}
              onClick={() => changeOpacity(active.opacity - OPACITY_STEP)}
            >
              <MinusIcon />
            </button>
          </div>
        </div>

        {notice.text && <p className={`notice ${notice.isError ? "is-error" : ""}`}>{notice.text}</p>}
      </section>

      <input ref={inputRef} className="visually-hidden" type="file" multiple />

      <Grips />
    </main>
  );
}
