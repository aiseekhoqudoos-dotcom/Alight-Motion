import React, { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Repeat,
  RotateCcw,
  X,
} from 'lucide-react';
import { Layer, ProjectConfig } from '../types/editor';
import { renderProjectFrame } from '../engine/compositor';
import { formatTimecode } from '../engine/easing';

interface PreviewScreenModalProps {
  open: boolean;
  project: ProjectConfig;
  layers: Layer[];
  initialTime: number;
  onClose: (lastTime: number) => void;
}

export const PreviewScreenModal: React.FC<PreviewScreenModalProps> = ({
  open,
  project,
  layers,
  initialTime,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);

  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(true);
  const [looping, setLooping] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [displaySize, setDisplaySize] = useState({ width: 800, height: 450 });

  useEffect(() => {
    if (open) {
      setTime(initialTime >= project.duration ? 0 : initialTime);
      setPlaying(true);
    }
  }, [open, initialTime, project.duration]);

  useEffect(() => {
    if (!open) return;
    const el = stageWrapRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const pad = rect.width < 540 ? 16 : 36;
      const availW = Math.max(180, rect.width - pad);
      const availH = Math.max(160, rect.height - pad);
      const aspect = project.width / project.height;

      let w = availW;
      let h = w / aspect;
      if (h > availH) {
        h = availH;
        w = h * aspect;
      }
      setDisplaySize({ width: Math.round(w), height: Math.round(h) });
    };

    updateSize();
    const obs = new ResizeObserver(updateSize);
    obs.observe(el);
    return () => obs.disconnect();
  }, [open, project.width, project.height]);

  useEffect(() => {
    if (!open || !playing) return;
    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setTime((prev) => {
        const next = prev + dt;
        if (next >= project.duration) {
          if (looping) return 0;
          setPlaying(false);
          return project.duration;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [open, playing, looping, speed, project.duration]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderProjectFrame(ctx, project, layers, time, {
      selectedLayerIds: [],
      showGizmos: false,
      showGrid: false,
    });
  }, [open, project, layers, time]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(time);
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, time]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] bg-[radial-gradient(circle_at_50%_40%,#191F30_0%,#090B10_75%)] flex flex-col">
      {/* Top Bar */}
      <div className="h-12 sm:h-14 px-3 sm:px-5 flex items-center justify-between border-b border-white/[0.08] bg-[#12151E]/90 shrink-0 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs sm:text-sm font-bold text-white truncate">
            {project.name}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#1E2231] border border-white/10 text-[10px] sm:text-xs font-mono-tabular text-[#2BE0A5] whitespace-nowrap">
            {project.width}×{project.height} · {project.fps}fps
          </span>
        </div>
        <button
          onClick={() => onClose(time)}
          className="h-8 sm:h-9 px-3 rounded-lg bg-[#23283A] hover:bg-[#2E354D] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Editor</span>
        </button>
      </div>

      {/* Cinema Preview Stage */}
      <div
        ref={stageWrapRef}
        className="flex-1 flex items-center justify-center overflow-hidden min-h-0 relative"
      >
        <div
          className={`relative rounded-[2px] shadow-[0_24px_80px_rgba(0,0,0,0.9)] ring-1 ring-white/15 overflow-hidden ${
            project.background === 'transparent' ? 'checkerboard-bg' : ''
          }`}
          style={{
            width: displaySize.width,
            height: displaySize.height,
          }}
        >
          <canvas
            ref={canvasRef}
            width={project.width}
            height={project.height}
            onClick={() => setPlaying((p) => !p)}
            className="w-full h-full block cursor-pointer"
          />
          {!playing && (
            <button
              onClick={() => setPlaying(true)}
              title="Tap to play"
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors cursor-pointer"
            >
              <span className="w-14 h-14 rounded-full bg-[#2BE0A5]/90 text-[#0E131D] flex items-center justify-center shadow-xl">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Alight-Style Playback Scrubber Bar */}
      <div className="bg-[#12151E]/95 border-t border-white/[0.08] px-3 sm:px-5 py-2.5 sm:py-3 shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="font-mono-tabular text-[11px] sm:text-xs text-[#2BE0A5] w-14 shrink-0">
              {formatTimecode(time, project.fps)}
            </span>
            <input
              type="range"
              min={0}
              max={project.duration}
              step={0.01}
              value={time}
              onChange={(e) => {
                setPlaying(false);
                setTime(Number(e.target.value));
              }}
              className="flex-1 studio-slider"
            />
            <span className="font-mono-tabular text-[11px] sm:text-xs text-slate-400 w-14 text-right shrink-0">
              {formatTimecode(project.duration, project.fps)}
            </span>
          </div>

          {/* Transport Buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {[0.5, 1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-1 rounded text-[11px] font-mono-tabular transition-colors cursor-pointer ${
                    speed === s
                      ? 'bg-[#2BE0A5] text-[#0E131D] font-bold'
                      : 'bg-[#1D2231] text-slate-300 hover:text-white'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTime(0)}
                title="Restart"
                className="w-9 h-9 rounded-lg bg-[#1D2231] hover:bg-[#282F44] text-slate-200 flex items-center justify-center cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setPlaying((p) => !p)}
                className="w-12 h-9 rounded-lg bg-[#2BE0A5] hover:bg-[#23C790] text-[#0E131D] flex items-center justify-center cursor-pointer"
              >
                {playing ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={() => setLooping((l) => !l)}
                title="Loop"
                className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer ${
                  looping
                    ? 'bg-[#2BE0A5]/20 text-[#2BE0A5]'
                    : 'bg-[#1D2231] text-slate-400 hover:text-white'
                }`}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            <div className="w-16 hidden sm:block" />
          </div>
        </div>
      </div>
    </div>
  );
};
