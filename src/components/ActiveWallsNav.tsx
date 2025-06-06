// src/components/ActiveWallNav.tsx
import { ActivatedWall } from "../types/Wall";

export default function ActiveWallNav({
  walls,
  onSelect,
}: {
  walls: ActivatedWall[];
  onSelect: (w: ActivatedWall) => void;
}) {
  if (!walls.length) return null;

  return (
    <nav className="flex gap-3 overflow-x-auto px-4 py-2 bg-gray-800 border-b border-gray-700">
      {walls.map((w) => (
        <button
          key={w.pda}
          onClick={() => onSelect(w)}
          className="group relative focus:outline-none"
        >
          <div className="relative">
            <img
              src={w.pfp ?? "/fallback-pfp.png"}
              alt={w.username}
              title={w.username}
              className="h-10 w-10 rounded-full shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:ring-2 group-hover:ring-purple-500"
            />
            <div className="absolute inset-0 rounded-full bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
          </div>
        </button>
      ))}
    </nav>
  );
}
