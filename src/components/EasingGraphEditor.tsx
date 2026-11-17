import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardPaste, Copy } from 'lucide-react';
import { EasingCurve } from '../types/editor';
import { EASING_PRESETS, evaluateEasing } from '../engine/easing';

interface EasingGraphEditorProps {
  curve: EasingCurve;
  playheadProgress?: number | null;
  copiedCurve?: EasingCurve | null;
  onCopyCurve?: (curve: EasingCurve) => void;
  onChange: (curve: EasingCurve) => void;
}

export const EasingGraphEditor: React.FC<EasingGraphEditorProps> = ({
  curve,
  playheadProgress = null,
  copiedCurve = null,
  onCopyCurve,
  onChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<'p1' | 'p2' | null>(null);

  // Compact SVG box sized so overshoot [-0.45..1.45] fits without clipping inside bottom dock
  const SVG_W = 240;
  const SVG_H = 164;
  const PAD_X = 24;
  const PAD_Y = 28;
  const BOX_W = SVG_W - PAD_X * 2;
  const BOX_H = SVG_H - PAD_Y * 2;

  const toSvgX = (x: number) => PAD_X + x * BOX_W;
  const toSvgY = (y: number) => PAD_Y + (1 - y) * BOX_H;

  useEffect(() => {
    if (!draggingHandle) return;

    const handleWindowMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg || curve.type !== 'bezier') return;

      let rawX: number;
      let rawY: number;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const local = pt.matrixTransform(ctm.inverse());
        rawX = local.x;
        rawY = local.y;
      } else {
        const rect = svg.getBoundingClientRect();
        rawX = ((e.clientX - rect.left) / rect.width) * SVG_W;
        rawY = ((e.clientY - rect.top) / rect.height) * SVG_H;
      }

      const normX = Math.max(0, Math.min(1, (rawX - PAD_X) / BOX_W));
      const normY = Math.max(-0.45, Math.min(1.45, 1 - (rawY - PAD_Y) / BOX_H));

      if (draggingHandle === 'p1') {
        onChange({
          ...curve,
          p1x: Number(normX.toFixed(2)),
          p1y: Number(normY.toFixed(2)),
        });
      } else {
        onChange({
          ...curve,
          p2x: Number(normX.toFixed(2)),
          p2y: Number(normY.toFixed(2)),
        });
      }
    };

    const handleWindowUp = () => setDraggingHandle(null);

    window.addEventListener('pointermove', handleWindowMove);
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('pointercancel', handleWindowUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowMove);
      window.removeEventListener('pointerup', handleWindowUp);
      window.removeEventListener('pointercancel', handleWindowUp);
    };
  }, [draggingHandle, curve, onChange, BOX_H, BOX_W]);

  const buildCurvePath = () => {
    const samples = 64;
    const pts: string[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const y = evaluateEasing(curve, t);
      const sx = toSvgX(t);
      const sy = toSvgY(y);
      pts.push(`${i === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const stepValue = curve.type === 'steps' ? curve.steps : 4;
  const clampedPlayhead =
    playheadProgress !== null && playheadProgress >= 0 && playheadProgress <= 1
      ? playheadProgress
      : null;

  return (
    <div className="flex gap-2.5 items-stretch">
      {/* Main Dark Grid Graph (matches Screenshots 1 & 7) */}
      <div className="flex-1 bg-[#2B3042] rounded-lg border border-white/[0.08] px-2.5 py-1.5 flex flex-col items-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full max-w-[260px] h-[142px] touch-none select-none overflow-visible"
        >
          {/* Fine Graph Grid */}
          {Array.from({ length: 9 }).map((_, idx) => {
            const x = PAD_X + (idx / 8) * BOX_W;
            const y = PAD_Y + (idx / 8) * BOX_H;
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={PAD_Y}
                  x2={x}
                  y2={PAD_Y + BOX_H}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
                <line
                  x1={PAD_X}
                  y1={y}
                  x2={PAD_X + BOX_W}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {/* Vertical dashed midpoint line */}
          <line
            x1={toSvgX(0.5)}
            y1={PAD_Y}
            x2={toSvgX(0.5)}
            y2={PAD_Y + BOX_H}
            stroke="rgba(255,255,255,0.32)"
            strokeDasharray="3 3"
            strokeWidth="1.2"
          />

          {/* Baseline box [0..1] */}
          <rect
            x={PAD_X}
            y={PAD_Y}
            width={BOX_W}
            height={BOX_H}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="1"
          />

          {/* Glowing Mint Easing Curve */}
          <path
            d={buildCurvePath()}
            fill="none"
            stroke="#2BE0A5"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Live Playhead Progress Indicator */}
          {clampedPlayhead !== null && (
            <circle
              cx={toSvgX(clampedPlayhead)}
              cy={toSvgY(evaluateEasing(curve, clampedPlayhead))}
              r="5"
              fill="#FDE047"
              stroke="#12151E"
              strokeWidth="1.5"
            />
          )}

          {/* Start & End Mint Nodes */}
          <circle cx={toSvgX(0)} cy={toSvgY(0)} r="3.5" fill="#2BE0A5" />
          <circle cx={toSvgX(1)} cy={toSvgY(1)} r="3.5" fill="#2BE0A5" />

          {/* Bezier Control Stems & White Handles */}
          {curve.type === 'bezier' && (
            <>
              <line
                x1={toSvgX(0)}
                y1={toSvgY(0)}
                x2={toSvgX(curve.p1x)}
                y2={toSvgY(curve.p1y)}
                stroke="#FFFFFF"
                strokeWidth="2.4"
              />
              <line
                x1={toSvgX(1)}
                y1={toSvgY(1)}
                x2={toSvgX(curve.p2x)}
                y2={toSvgY(curve.p2y)}
                stroke="#FFFFFF"
                strokeWidth="2.4"
              />

              <circle
                cx={toSvgX(curve.p1x)}
                cy={toSvgY(curve.p1y)}
                r="10"
                fill={draggingHandle === 'p1' ? '#2BE0A5' : '#FFFFFF'}
                stroke="#1A1E2B"
                strokeWidth="2"
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraggingHandle('p1');
                }}
              />
              <circle
                cx={toSvgX(curve.p2x)}
                cy={toSvgY(curve.p2y)}
                r="10"
                fill={draggingHandle === 'p2' ? '#2BE0A5' : '#FFFFFF'}
                stroke="#1A1E2B"
                strokeWidth="2"
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraggingHandle('p2');
                }}
              />
            </>
          )}
        </svg>

        {/* Footer Value Readout / Steps Stepper + Copy/Paste Curve */}
        {curve.type === 'steps' ? (
          <div className="w-full flex items-center justify-between pt-1 mt-0.5 border-t border-white/[0.07]">
            <button
              onClick={() =>
                onChange({ type: 'steps', steps: Math.max(2, stepValue - 1) })
              }
              className="w-7 h-6 rounded bg-[#363C54] hover:bg-[#434B68] flex items-center justify-center text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-semibold tracking-wider text-slate-300 font-mono-tabular">
              STEPS ({stepValue})
            </span>
            <button
              onClick={() =>
                onChange({ type: 'steps', steps: Math.min(24, stepValue + 1) })
              }
              className="w-7 h-6 rounded bg-[#363C54] hover:bg-[#434B68] flex items-center justify-center text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between gap-2 text-[10px] font-mono-tabular text-slate-300 pt-1 border-t border-white/[0.07]">
            <span>
              P1 ({curve.p1x.toFixed(2)}, {curve.p1y.toFixed(2)})
            </span>
            <div className="flex items-center gap-1">
              {onCopyCurve && (
                <button
                  onClick={() => onCopyCurve(curve)}
                  title="Copy Curve"
                  className="px-1.5 py-0.5 rounded bg-[#1E2231] hover:bg-white/10 text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              )}
              {copiedCurve && (
                <button
                  onClick={() => onChange(copiedCurve)}
                  title="Paste Curve"
                  className="px-1.5 py-0.5 rounded bg-[#2BE0A5]/20 text-[#2BE0A5] hover:bg-[#2BE0A5]/30 flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  <span>Paste</span>
                </button>
              )}
            </div>
            <span>
              P2 ({curve.p2x.toFixed(2)}, {curve.p2y.toFixed(2)})
            </span>
          </div>
        )}
      </div>

      {/* Right Rail Quick Curve Presets (Screenshots 1 & 7) */}
      <div className="w-11 flex flex-col gap-1 justify-between">
        {EASING_PRESETS.map((preset) => {
          const active =
            preset.curve.type === curve.type &&
            (curve.type === 'steps' ||
              (preset.curve.type === 'bezier' &&
                Math.abs(preset.curve.p1x - curve.p1x) < 0.02 &&
                Math.abs(preset.curve.p1y - curve.p1y) < 0.02 &&
                Math.abs(preset.curve.p2x - curve.p2x) < 0.02 &&
                Math.abs(preset.curve.p2y - curve.p2y) < 0.02));
          return (
            <button
              key={preset.id}
              onClick={() => onChange(preset.curve)}
              title={preset.label}
              className={`flex-1 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                active
                  ? 'bg-[#2BE0A5]/15 border-[#2BE0A5] text-[#2BE0A5]'
                  : 'bg-[#222637] border-white/[0.08] text-slate-300 hover:border-white/25'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4">
                <path
                  d={(() => {
                    const pts: string[] = [];
                    for (let i = 0; i <= 12; i++) {
                      const t = i / 12;
                      const y = evaluateEasing(preset.curve, t);
                      const sx = 3 + t * 18;
                      const sy = 20 - Math.max(-0.15, Math.min(1.15, y)) * 16;
                      pts.push(`${i === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`);
                    }
                    return pts.join(' ');
                  })()}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
};
