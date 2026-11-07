const DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

// invisible handles along the window edges and corners, resizing is done by the main process
export default function Grips({ onStart }: { onStart?: (e: React.MouseEvent) => void }) {
  const api = window.floatFile;

  return (
    <>
      {DIRECTIONS.map((dir) => (
        <div
          key={dir}
          className={`grip grip-${dir}`}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            onStart?.(e);
            api?.resizeStart(dir);
          }}
          onMouseUp={(e) => e.stopPropagation()}
        />
      ))}
    </>
  );
}
