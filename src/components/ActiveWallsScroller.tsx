import { useRef, useState, useMemo, useCallback } from "react";

/**
 * Horizontal strip that shows all 888 (or fewer) wall slots.
 * Each square is clickable → returns its `wallNumber` (1-based) to the parent.
 */
export default function ActiveWallsScroller({
  setChosenWall,
  total = 888, // configurable in case supply changes
}: {
  setChosenWall: (n: number) => void;
  total?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollStart, setScrollStart] = useState(0);

  /* golden-angle hues for a nice rainbow */
  const squares = useMemo(
    () =>
      Array.from({ length: total }).map((_, i) => ({
        id: i + 1,
        color: `hsl(${(i * 137.508) % 360} 80% 60%)`,
      })),
    [total]
  );

  /* drag-to-scroll (mobile-friendly) */
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setStartX(e.pageX - (ref.current?.offsetLeft ?? 0));
    setScrollStart(ref.current?.scrollLeft ?? 0);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !ref.current) return;
    const x = e.pageX - ref.current.offsetLeft;
    ref.current.scrollLeft = scrollStart - (x - startX);
  };
  const endDrag = () => setDragging(false);

  /* wheel (trackpads) maps vertical wheel to horizontal scroll */
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (ref.current) ref.current.scrollLeft += e.deltaY;
  }, []);

  return (
    <div
      className="h-40 w-full bg-gray-800/50 overflow-hidden select-none"
      onMouseLeave={endDrag}
    >
      <div
        ref={ref}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        className="flex h-full items-center gap-3 overflow-x-auto scrollbar-hide px-4"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {squares.map(({ id, color }) => (
          <button
            key={id}
            onClick={() => setChosenWall(id)}
            style={{ backgroundColor: color }}
            className="flex-shrink-0 w-24 h-24 rounded-lg shadow-md
                       text-white font-semibold text-xl
                       flex items-center justify-center
                       hover:scale-105 transition-transform
                       scroll-snap-align: center;"
          >
            {id}
          </button>
        ))}
      </div>
    </div>
  );
}
