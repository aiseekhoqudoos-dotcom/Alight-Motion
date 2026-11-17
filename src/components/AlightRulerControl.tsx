import React, { useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface AlightRulerControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  accentColor?: string;
  onChange: (nextVal: number) => void;
}

export const AlightRulerControl: React.FC<AlightRulerControlProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  accentColor = '#2BE0A5',
  onChange,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const dragRef = useRef<{
    startX: number;
    startVal: number;
    moved: boolean;
  } | null>(null);

  const clampAndStep = (raw: number) => {
    const clamped = Math.max(min, Math.min(max, raw));
    const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 2) : 0;
    const snapped = Math.round(clamped / step) * step;
    return Number(snapped.toFixed(decimals));
  };

  const ratio = Math.max(0, Math.min(1, (value - min) / Math.max(1e-6, max - min)));
  const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 1) : 0;
  const displayVal = Number(value).toFixed(decimals);

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startVal: value,
      moved: false,
    };
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = trackRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 2) d.moved = true;
    const width = Math.max(80, el.getBoundingClientRect().width);
    const span = max - min;
    const next = clampAndStep(d.startVal + (dx / width) * span);
    onChange(next);
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = trackRef.current;
    dragRef.current = null;
    if (d && !d.moved && el) {
      const rect = el.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onChange(clampAndStep(min + clickRatio * (max - min)));
    }
  };

  const commitDraft = () => {
    setEditing(false);
    const parsed = Number(draft);
    if (!Number.isNaN(parsed)) {
      onChange(clampAndStep(parsed));
    }
  };

  return (
    <div
      className="bg-[#1B1F2E] border border-white/[0.07] rounded-lg px-2.5 py-1.5 space-y-1.5 select-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Top Label + Fine Steppers + Numeric Value Pill */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-300 truncate capitalize">
          {label}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChange(clampAndStep(value - step))}
            className="w-6 h-5 rounded bg-[#252A3C] hover:bg-[#313850] text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
            title={`Decrease ${label}`}
          >
            <Minus className="w-3 h-3" />
          </button>

          {editing ? (
            <input
              autoFocus
              type="number"
              step={step}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-16 h-5 px-1 rounded bg-[#12151E] border border-[#2BE0A5] text-center font-mono-tabular text-[11px] text-white outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(displayVal);
                setEditing(true);
              }}
              title="Tap to type exact value"
              style={{ color: accentColor }}
              className="min-w-[48px] h-5 px-1.5 rounded bg-[#12151E] border border-white/[0.08] font-mono-tabular text-[11px] font-semibold text-center cursor-text"
            >
              {displayVal}
              {unit}
            </button>
          )}

          <button
            type="button"
            onClick={() => onChange(clampAndStep(value + step))}
            className="w-6 h-5 rounded bg-[#252A3C] hover:bg-[#313850] text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
            title={`Increase ${label}`}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Alight Motion Style Scrub-Ruler Track */}
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        onPointerCancel={handleTrackPointerUp}
        className="relative h-6 rounded-md bg-[#12151E] border border-white/[0.08] overflow-hidden cursor-ew-resize touch-none flex items-center"
      >
        {/* Subtle progress fill */}
        <div
          style={{
            width: `${ratio * 100}%`,
            backgroundColor: accentColor,
          }}
          className="absolute inset-y-0 left-0 opacity-20 pointer-events-none"
        />

        {/* Notched Ruler Ticks */}
        <div className="absolute inset-0 flex items-end justify-between px-1.5 pb-0.5 pointer-events-none">
          {Array.from({ length: 21 }).map((_, i) => (
            <div
              key={i}
              className={`w-px ${
                i % 5 === 0 ? 'h-3 bg-slate-400/55' : 'h-1.5 bg-slate-600/45'
              }`}
            />
          ))}
        </div>

        {/* Crisp Needle Indicator */}
        <div
          style={{
            left: `calc(${ratio * 100}% - 1.5px)`,
            backgroundColor: accentColor,
            boxShadow: `0 0 8px ${accentColor}`,
          }}
          className="absolute top-0.5 bottom-0.5 w-[3px] rounded-full pointer-events-none"
        />
      </div>
    </div>
  );
};
