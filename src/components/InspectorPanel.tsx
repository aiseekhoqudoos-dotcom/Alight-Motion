import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Diamond,
  Layers,
  Move,
  Palette,
  Plus,
  Search,
  Sliders,
  Sparkles,
  Spline,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  BlendMode,
  EasingCurve,
  EffectType,
  InspectorTab,
  Keyframe,
  Layer,
  NumericAnimatableProp,
} from '../types/editor';
import {
  BLEND_CATEGORIES,
  EFFECT_CATALOG,
  SHAPE_CATALOG,
  createEffectInstance,
} from '../engine/presets';
import { evaluateLayerTransform, evaluateProperty } from '../engine/easing';
import { EasingGraphEditor } from './EasingGraphEditor';

interface InspectorPanelProps {
  layer: Layer | null;
  allLayers: Layer[];
  currentTime: number;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onUpdateLayer: (layerId: string, updater: (l: Layer) => Layer) => void;
  onToggleKeyframe: (layerId: string, prop: NumericAnimatableProp) => void;
  onSeek: (time: number) => void;
  onOpenAIForLayer: () => void;
}

type TransformSubMode = 'position' | 'rotation' | 'scale' | 'anchor';

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  layer,
  allLayers,
  currentTime,
  activeTab,
  onTabChange,
  onUpdateLayer,
  onToggleKeyframe,
  onSeek,
  onOpenAIForLayer,
}) => {
  const [transformMode, setTransformMode] = useState<TransformSubMode>('position');
  const [easingProp, setEasingProp] = useState<NumericAnimatableProp>('x');
  const [selectedKfIndex, setSelectedKfIndex] = useState(0);
  const [showEffectBrowser, setShowEffectBrowser] = useState(false);
  const [effectSearch, setEffectSearch] = useState('');
  const [wheelLightness, setWheelLightness] = useState(55);

  const padDragRef = useRef<{
    startX: number;
    startY: number;
    origA: number;
    origB: number;
  } | null>(null);

  const evaluated = useMemo(() => {
    if (!layer) return null;
    return evaluateLayerTransform(layer, currentTime);
  }, [layer, currentTime]);

  if (!layer || !evaluated) {
    return (
      <aside className="w-full lg:w-[340px] bg-[#1A1E2B] border-l border-white/[0.08] flex flex-col items-center justify-center p-6 text-center shrink-0">
        <div className="w-12 h-12 rounded-xl bg-[#23283A] border border-white/10 flex items-center justify-center text-slate-400 mb-3">
          <Layers className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-white mb-1">No Layer Selected</p>
        <p className="text-xs text-slate-400 max-w-[220px]">
          Click a shape, text, null, or camera on the stage or timeline to edit keyframes, easing curves, and effects.
        </p>
      </aside>
    );
  }

  const updatePropValue = (prop: NumericAnimatableProp, newValue: number) => {
    onUpdateLayer(layer.id, (prev) => {
      const kfs = prev.keyframes[prop];
      if (kfs && kfs.length > 0) {
        const idx = kfs.findIndex((k) => Math.abs(k.time - currentTime) < 0.05);
        if (idx >= 0) {
          const nextKfs = [...kfs];
          nextKfs[idx] = { ...nextKfs[idx], value: newValue };
          return { ...prev, keyframes: { ...prev.keyframes, [prop]: nextKfs } };
        }
        const added: Keyframe<number> = {
          id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          time: Number(currentTime.toFixed(2)),
          value: newValue,
          easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
        };
        return {
          ...prev,
          keyframes: {
            ...prev.keyframes,
            [prop]: [...kfs, added].sort((a, b) => a.time - b.time),
          },
        };
      }

      // Update static transform or extra property
      if (prop in prev.transform) {
        return {
          ...prev,
          transform: {
            ...prev.transform,
            [prop]: newValue,
          },
        };
      }
      return { ...prev, [prop]: newValue };
    });
  };

  const hasKeyframeAtPlayhead = (prop: NumericAnimatableProp) => {
    const arr = layer.keyframes[prop];
    return Boolean(arr?.some((k) => Math.abs(k.time - currentTime) < 0.05));
  };

  const jumpKeyframe = (prop: NumericAnimatableProp, dir: -1 | 1) => {
    const arr = [...(layer.keyframes[prop] || [])].sort((a, b) => a.time - b.time);
    if (arr.length === 0) return;
    if (dir < 0) {
      const prev = [...arr].reverse().find((k) => k.time < currentTime - 0.04);
      onSeek(prev ? prev.time : arr[0].time);
    } else {
      const next = arr.find((k) => k.time > currentTime + 0.04);
      onSeek(next ? next.time : arr[arr.length - 1].time);
    }
  };

  const activePropForSubMode: NumericAnimatableProp =
    transformMode === 'position'
      ? 'x'
      : transformMode === 'rotation'
        ? 'rotation'
        : transformMode === 'scale'
          ? 'scaleX'
          : 'anchorX';

  const tabs: Array<{ id: InspectorTab; label: string; icon: React.ReactNode }> = [
    { id: 'transform', label: 'Move', icon: <Move className="w-4 h-4" /> },
    { id: 'easing', label: 'Graph', icon: <Spline className="w-4 h-4" /> },
    { id: 'color', label: 'Color', icon: <Palette className="w-4 h-4" /> },
    { id: 'blending', label: 'Blend', icon: <Layers className="w-4 h-4" /> },
    { id: 'effects', label: 'Effects', icon: <Wand2 className="w-4 h-4" /> },
    { id: 'properties', label: 'Props', icon: <Sliders className="w-4 h-4" /> },
  ];

  const availableParents = allLayers.filter(
    (other) => other.id !== layer.id && other.type !== 'audio' && other.type !== 'camera'
  );

  // Determine easing curve for Easing tab
  const propKfs = [...(layer.keyframes[easingProp] || [])].sort(
    (a, b) => a.time - b.time
  );
  const clampedPairIdx = Math.max(
    0,
    Math.min(Math.max(0, propKfs.length - 2), selectedKfIndex)
  );
  const activeKfForEasing = propKfs[clampedPairIdx];

  const handleEasingChange = (nextCurve: EasingCurve) => {
    if (!activeKfForEasing) return;
    onUpdateLayer(layer.id, (prev) => {
      const arr = [...(prev.keyframes[easingProp] || [])].sort(
        (a, b) => a.time - b.time
      );
      if (!arr[clampedPairIdx]) return prev;
      arr[clampedPairIdx] = { ...arr[clampedPairIdx], easing: nextCurve };
      return {
        ...prev,
        keyframes: { ...prev.keyframes, [easingProp]: arr },
      };
    });
  };

  const handleColorWheelPick = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = e.clientX - rect.left - cx;
    const dy = e.clientY - rect.top - cy;
    const dist = Math.min(cx, Math.hypot(dx, dy));
    const sat = Math.round((dist / cx) * 100);
    let hue = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
    if (hue < 0) hue += 360;
    const hex = hslToHex(hue, sat, wheelLightness);
    onUpdateLayer(layer.id, (prev) => ({ ...prev, fillColor: hex }));
  };

  const filteredEffects = EFFECT_CATALOG.filter(
    (fx) =>
      fx.name.toLowerCase().includes(effectSearch.toLowerCase()) ||
      fx.category.toLowerCase().includes(effectSearch.toLowerCase())
  );

  return (
    <aside className="w-full lg:w-[348px] bg-[#1A1E2B] border-l border-white/[0.08] flex flex-col shrink-0 min-h-0">
      {/* Header: Layer Name + AI Animate Button */}
      <div className="px-3 py-2.5 border-b border-white/[0.08] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <input
            value={layer.name}
            onChange={(e) =>
              onUpdateLayer(layer.id, (prev) => ({ ...prev, name: e.target.value }))
            }
            className="bg-transparent text-sm font-semibold text-white outline-none border-b border-transparent focus:border-[#2BE0A5] truncate w-40"
          />
          <div className="text-[11px] text-slate-400 capitalize">
            {layer.type} layer · {layer.startTime.toFixed(1)}s–{layer.endTime.toFixed(1)}s
          </div>
        </div>

        <button
          onClick={onOpenAIForLayer}
          className="h-7 px-2.5 rounded-md bg-[#2BE0A5]/15 border border-[#2BE0A5]/40 text-[#2BE0A5] hover:bg-[#2BE0A5]/25 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Sparkles className="w-3 h-3" />
          <span>AI Animate</span>
        </button>
      </div>

      {/* Category Icon Tab Strip */}
      <div className="grid grid-cols-6 border-b border-white/[0.08] bg-[#161925]">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`py-2 flex flex-col items-center gap-0.5 text-[10px] font-medium border-b-2 transition-colors cursor-pointer ${
                active
                  ? 'border-[#2BE0A5] text-[#2BE0A5] bg-[#2BE0A5]/[0.06]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* TAB 1: MOVE & TRANSFORM (Screenshot 7 Left) */}
        {activeTab === 'transform' && (
          <>
            {/* Sub-Mode Pills */}
            <div className="grid grid-cols-4 gap-1 bg-[#141722] p-1 rounded-lg border border-white/[0.06]">
              {(
                [
                  ['position', 'Pos'],
                  ['rotation', 'Rotate'],
                  ['scale', 'Scale'],
                  ['anchor', 'Pivot'],
                ] as Array<[TransformSubMode, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTransformMode(id)}
                  className={`py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    transformMode === id
                      ? 'bg-[#2B3044] text-[#2BE0A5]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Keyframe Diamond Control Bar */}
            <div className="flex items-center justify-between bg-[#222637] rounded-lg px-2.5 py-2 border border-white/[0.07]">
              <button
                onClick={() => jumpKeyframe(activePropForSubMode, -1)}
                className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center text-slate-300 cursor-pointer"
                title="Previous Keyframe"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (transformMode === 'position') {
                    onToggleKeyframe(layer.id, 'x');
                    onToggleKeyframe(layer.id, 'y');
                  } else if (transformMode === 'scale') {
                    onToggleKeyframe(layer.id, 'scaleX');
                    onToggleKeyframe(layer.id, 'scaleY');
                  } else if (transformMode === 'rotation') {
                    onToggleKeyframe(layer.id, 'rotation');
                  } else {
                    onToggleKeyframe(layer.id, 'anchorX');
                    onToggleKeyframe(layer.id, 'anchorY');
                  }
                }}
                className={`h-7 px-3 rounded-md flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  hasKeyframeAtPlayhead(activePropForSubMode)
                    ? 'bg-[#2BE0A5] text-[#0E131D]'
                    : 'bg-[#2E344B] text-white hover:bg-[#3A415C]'
                }`}
              >
                <Diamond className="w-3.5 h-3.5 fill-current" />
                <span>
                  {hasKeyframeAtPlayhead(activePropForSubMode)
                    ? 'Remove Keyframe'
                    : 'Add Keyframe'}
                </span>
              </button>

              <button
                onClick={() => jumpKeyframe(activePropForSubMode, 1)}
                className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center text-slate-300 cursor-pointer"
                title="Next Keyframe"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Touch Pad ("Swipe here to move layer" from Screenshot 7) */}
            <div
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                padDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origA:
                    transformMode === 'position'
                      ? evaluated.x
                      : transformMode === 'rotation'
                        ? evaluated.rotation
                        : transformMode === 'scale'
                          ? evaluated.scaleX
                          : evaluated.anchorX,
                  origB:
                    transformMode === 'position'
                      ? evaluated.y
                      : transformMode === 'scale'
                        ? evaluated.scaleY
                        : evaluated.anchorY,
                };
              }}
              onPointerMove={(e) => {
                const d = padDragRef.current;
                if (!d) return;
                const dx = e.clientX - d.startX;
                const dy = e.clientY - d.startY;
                if (transformMode === 'position') {
                  updatePropValue('x', Math.round(d.origA + dx * 1.5));
                  updatePropValue('y', Math.round(d.origB + dy * 1.5));
                } else if (transformMode === 'rotation') {
                  updatePropValue('rotation', Math.round(d.origA + dx * 0.8));
                } else if (transformMode === 'scale') {
                  const factor = Math.max(0.05, Number((d.origA + dx * 0.01).toFixed(2)));
                  updatePropValue('scaleX', factor);
                  updatePropValue('scaleY', factor);
                } else {
                  updatePropValue('anchorX', Math.round(d.origA + dx));
                  updatePropValue('anchorY', Math.round(d.origB + dy));
                }
              }}
              onPointerUp={() => {
                padDragRef.current = null;
              }}
              className="h-28 rounded-lg bg-[#23283A] border border-white/[0.08] flex flex-col items-center justify-center gap-1 cursor-move touch-none hover:border-[#2BE0A5]/40 transition-colors"
            >
              <span className="text-xs font-medium text-slate-300">
                Drag here to adjust {transformMode}
              </span>
              <span className="font-mono-tabular text-xs text-[#2BE0A5]">
                {transformMode === 'position' &&
                  `X ${Math.round(evaluated.x)} · Y ${Math.round(evaluated.y)}`}
                {transformMode === 'rotation' && `${Math.round(evaluated.rotation)}°`}
                {transformMode === 'scale' &&
                  `${Math.round(evaluated.scaleX * 100)}% × ${Math.round(evaluated.scaleY * 100)}%`}
                {transformMode === 'anchor' &&
                  `PX ${Math.round(evaluated.anchorX)} · PY ${Math.round(evaluated.anchorY)}`}
              </span>
            </div>

            {/* Precision Tabular Numeric Scrubbers */}
            <div className="grid grid-cols-2 gap-2">
              <label className="bg-[#222637] rounded-md px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Pos X</span>
                <input
                  type="number"
                  value={Math.round(evaluated.x)}
                  onChange={(e) => updatePropValue('x', Number(e.target.value))}
                  className="w-16 bg-transparent text-right font-mono-tabular text-xs text-white outline-none"
                />
              </label>
              <label className="bg-[#222637] rounded-md px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Pos Y</span>
                <input
                  type="number"
                  value={Math.round(evaluated.y)}
                  onChange={(e) => updatePropValue('y', Number(e.target.value))}
                  className="w-16 bg-transparent text-right font-mono-tabular text-xs text-white outline-none"
                />
              </label>

              <label className="bg-[#222637] rounded-md px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Scale X</span>
                <input
                  type="number"
                  step={0.05}
                  value={Number(evaluated.scaleX.toFixed(2))}
                  onChange={(e) => updatePropValue('scaleX', Number(e.target.value))}
                  className="w-16 bg-transparent text-right font-mono-tabular text-xs text-white outline-none"
                />
              </label>
              <label className="bg-[#222637] rounded-md px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Scale Y</span>
                <input
                  type="number"
                  step={0.05}
                  value={Number(evaluated.scaleY.toFixed(2))}
                  onChange={(e) => updatePropValue('scaleY', Number(e.target.value))}
                  className="w-16 bg-transparent text-right font-mono-tabular text-xs text-white outline-none"
                />
              </label>

              <label className="bg-[#222637] rounded-md px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Rotate °</span>
                <input
                  type="number"
                  value={Math.round(evaluated.rotation)}
                  onChange={(e) => updatePropValue('rotation', Number(e.target.value))}
                  className="w-16 bg-transparent text-right font-mono-tabular text-xs text-white outline-none"
                />
              </label>
              <label className="bg-[#222637] rounded-md px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Skew X</span>
                <input
                  type="number"
                  value={Math.round(evaluated.skewX)}
                  onChange={(e) => updatePropValue('skewX', Number(e.target.value))}
                  className="w-16 bg-transparent text-right font-mono-tabular text-xs text-white outline-none"
                />
              </label>
            </div>

            {/* Parenting Selector (Null / Group Rigging) */}
            <div className="bg-[#222637] rounded-lg p-2.5 border border-white/[0.06] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Parent Layer (Rig)</span>
                <span className="text-[11px] text-slate-500">Null / Group</span>
              </div>
              <select
                value={layer.parentId || ''}
                onChange={(e) =>
                  onUpdateLayer(layer.id, (prev) => ({
                    ...prev,
                    parentId: e.target.value || null,
                  }))
                }
                className="w-full bg-[#161925] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#2BE0A5]"
              >
                <option value="">None (Stage Root)</option>
                {availableParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* TAB 2: EASING GRAPH EDITOR (Screenshots 1 & 6) */}
        {activeTab === 'easing' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300">Property</span>
              <select
                value={easingProp}
                onChange={(e) => {
                  setEasingProp(e.target.value as NumericAnimatableProp);
                  setSelectedKfIndex(0);
                }}
                className="bg-[#222637] border border-white/10 rounded px-2.5 py-1 text-xs text-white outline-none"
              >
                <option value="x">Position X</option>
                <option value="y">Position Y</option>
                <option value="scaleX">Scale X</option>
                <option value="scaleY">Scale Y</option>
                <option value="rotation">Rotation</option>
                <option value="opacity">Opacity</option>
                <option value="letterSpacing">Letter Spacing</option>
              </select>
            </div>

            {propKfs.length >= 2 && activeKfForEasing ? (
              <>
                {/* Interval Selector */}
                <div className="flex flex-wrap gap-1">
                  {propKfs.slice(0, -1).map((kf, idx) => (
                    <button
                      key={kf.id}
                      onClick={() => setSelectedKfIndex(idx)}
                      className={`px-2 py-1 rounded text-[11px] font-mono-tabular cursor-pointer ${
                        clampedPairIdx === idx
                          ? 'bg-[#2BE0A5] text-[#0E131D] font-bold'
                          : 'bg-[#222637] text-slate-300 hover:bg-[#2B3044]'
                      }`}
                    >
                      {kf.time.toFixed(1)}s → {propKfs[idx + 1].time.toFixed(1)}s
                    </button>
                  ))}
                </div>

                <EasingGraphEditor
                  curve={activeKfForEasing.easing}
                  onChange={handleEasingChange}
                />
              </>
            ) : (
              <div className="bg-[#222637] rounded-lg p-4 border border-white/[0.07] text-center space-y-2.5">
                <p className="text-xs text-slate-300">
                  Add at least 2 keyframes on <strong className="text-white">{easingProp}</strong> to shape the easing curve between them.
                </p>
                <button
                  onClick={() => {
                    onUpdateLayer(layer.id, (prev) => {
                      const base = evaluateProperty(
                        prev.keyframes[easingProp],
                        (prev.transform as unknown as Record<string, number>)[easingProp] ?? 0,
                        currentTime
                      );
                      const t0 = Math.max(prev.startTime, Number(currentTime.toFixed(2)));
                      const t1 = Math.min(prev.endTime, Number((t0 + 1.2).toFixed(2)));
                      const delta = easingProp === 'scaleX' || easingProp === 'scaleY' ? 0.25 : easingProp === 'rotation' ? 45 : 80;
                      return {
                        ...prev,
                        keyframes: {
                          ...prev.keyframes,
                          [easingProp]: [
                            {
                              id: `kf_${Date.now()}_a`,
                              time: t0,
                              value: base,
                              easing: { type: 'bezier', p1x: 0.34, p1y: 1.45, p2x: 0.64, p2y: 1 },
                            },
                            {
                              id: `kf_${Date.now()}_b`,
                              time: t1 > t0 ? t1 : t0 + 0.5,
                              value: base + delta,
                              easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
                            },
                          ],
                        },
                      };
                    });
                  }}
                  className="px-3 py-1.5 rounded-md bg-[#2BE0A5] text-[#0E131D] text-xs font-bold cursor-pointer"
                >
                  Create 2-Keyframe Animation
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COLOR & FILL (Screenshot 9 Right) */}
        {activeTab === 'color' && (
          <div className="space-y-3">
            {/* Circular Color Wheel */}
            <div className="bg-[#222637] rounded-lg p-3 border border-white/[0.07] flex items-center gap-3">
              <div
                onPointerDown={handleColorWheelPick}
                onPointerMove={(e) => {
                  if (e.buttons === 1) handleColorWheelPick(e);
                }}
                className="w-32 h-32 rounded-full shrink-0 cursor-crosshair relative shadow-inner ring-1 ring-white/20"
                style={{
                  background:
                    'radial-gradient(circle, #ffffff 0%, transparent 72%), conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                }}
              />
              <div className="flex-1 space-y-2">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Lightness</span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={wheelLightness}
                    onChange={(e) => setWheelLightness(Number(e.target.value))}
                    className="studio-slider w-full"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Fill Hex</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={layer.fillColor || '#2BE0A5'}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          fillColor: e.target.value,
                        }))
                      }
                      className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      value={layer.fillColor || '#2BE0A5'}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          fillColor: e.target.value,
                        }))
                      }
                      className="w-full bg-[#161925] border border-white/10 rounded px-2 py-1 font-mono-tabular text-xs text-white uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stroke Controls */}
            <div className="bg-[#222637] rounded-lg p-2.5 border border-white/[0.07] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">Border / Stroke</span>
                <span className="font-mono-tabular text-xs text-[#2BE0A5]">
                  {layer.strokeWidth ?? 0}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={28}
                value={layer.strokeWidth ?? 0}
                onChange={(e) =>
                  onUpdateLayer(layer.id, (prev) => ({
                    ...prev,
                    strokeWidth: Number(e.target.value),
                  }))
                }
                className="studio-slider w-full"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">Stroke Color</span>
                <input
                  type="color"
                  value={layer.strokeColor || '#FFFFFF'}
                  onChange={(e) =>
                    onUpdateLayer(layer.id, (prev) => ({
                      ...prev,
                      strokeColor: e.target.value,
                    }))
                  }
                  className="w-7 h-6 rounded bg-transparent border-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Shadow Toggle */}
            <div className="bg-[#222637] rounded-lg p-2.5 border border-white/[0.07] flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">Drop Shadow</span>
              <button
                onClick={() =>
                  onUpdateLayer(layer.id, (prev) => ({
                    ...prev,
                    shadow: {
                      enabled: !(prev.shadow?.enabled ?? false),
                      color: prev.shadow?.color ?? 'rgba(0,0,0,0.65)',
                      blur: prev.shadow?.blur ?? 18,
                      offsetX: prev.shadow?.offsetX ?? 0,
                      offsetY: prev.shadow?.offsetY ?? 10,
                    },
                  }))
                }
                className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                  layer.shadow?.enabled
                    ? 'bg-[#2BE0A5] text-[#0E131D]'
                    : 'bg-[#161925] text-slate-300'
                }`}
              >
                {layer.shadow?.enabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: BLENDING & OPACITY (Screenshot 7 Right) */}
        {activeTab === 'blending' && (
          <div className="space-y-3">
            <div className="bg-[#222637] rounded-lg p-3 border border-white/[0.07] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">Opacity</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular text-xs font-semibold text-[#2BE0A5]">
                    {Math.round(evaluated.opacity)}%
                  </span>
                  <button
                    onClick={() => onToggleKeyframe(layer.id, 'opacity')}
                    title="Keyframe Opacity"
                    className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${
                      hasKeyframeAtPlayhead('opacity')
                        ? 'bg-[#2BE0A5] text-[#0E131D]'
                        : 'bg-[#161925] text-slate-300'
                    }`}
                  >
                    <Diamond className="w-3 h-3 fill-current" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(evaluated.opacity)}
                onChange={(e) => updatePropValue('opacity', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            {/* Categorized Blend Modes */}
            <div className="space-y-2.5">
              {BLEND_CATEGORIES.map((group) => (
                <div key={group.category} className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 px-0.5">
                    {group.category}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {group.modes.map((m) => {
                      const active = layer.blendMode === m.value;
                      return (
                        <button
                          key={m.value}
                          onClick={() =>
                            onUpdateLayer(layer.id, (prev) => ({
                              ...prev,
                              blendMode: m.value as BlendMode,
                            }))
                          }
                          className={`rounded-md p-2 border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#2BE0A5]/15 border-[#2BE0A5] text-[#2BE0A5]'
                              : 'bg-[#222637] border-white/[0.06] text-slate-300 hover:border-white/20'
                          }`}
                        >
                          <div className="h-6 rounded mb-1.5 bg-gradient-to-br from-[#2BE0A5] via-[#38B2CE] to-[#F2A833] opacity-85" />
                          <div className="text-[11px] font-medium truncate">{m.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: EFFECTS & BROWSER (Screenshot 9 Left) */}
        {activeTab === 'effects' && (
          <div className="space-y-3">
            <button
              onClick={() => setShowEffectBrowser((v) => !v)}
              className="w-full h-9 rounded-lg bg-[#2BE0A5] hover:bg-[#23C790] text-[#0E131D] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{showEffectBrowser ? 'Close Effect Browser' : 'Add Effect'}</span>
            </button>

            {showEffectBrowser && (
              <div className="bg-[#161925] border border-white/10 rounded-lg p-2.5 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    value={effectSearch}
                    onChange={(e) => setEffectSearch(e.target.value)}
                    placeholder="Search effects..."
                    className="w-full bg-[#222637] rounded pl-8 pr-2.5 py-1.5 text-xs text-white outline-none border border-white/10 focus:border-[#2BE0A5]"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {filteredEffects.map((fx) => (
                    <button
                      key={fx.type}
                      onClick={() => {
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          effects: [...prev.effects, createEffectInstance(fx.type as EffectType)],
                        }));
                        setShowEffectBrowser(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded bg-[#222637] hover:bg-[#2B3044] border border-white/[0.05] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{fx.name}</span>
                        <span className="text-[10px] text-[#2BE0A5]">{fx.category}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{fx.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {layer.effects.length === 0 ? (
              <div className="bg-[#222637] rounded-lg p-4 text-center text-xs text-slate-400 border border-white/[0.06]">
                No active effects on this layer. Click Add Effect to apply Glow, Blur, RGB Split, or Oscillate.
              </div>
            ) : (
              <div className="space-y-2">
                {layer.effects.map((fx) => (
                  <div
                    key={fx.id}
                    className="bg-[#222637] rounded-lg p-2.5 border border-white/[0.07] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">{fx.name}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            onUpdateLayer(layer.id, (prev) => ({
                              ...prev,
                              effects: prev.effects.map((e) =>
                                e.id === fx.id ? { ...e, enabled: !e.enabled } : e
                              ),
                            }))
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            fx.enabled
                              ? 'bg-[#2BE0A5] text-[#0E131D]'
                              : 'bg-[#161925] text-slate-400'
                          }`}
                        >
                          {fx.enabled ? 'ON' : 'OFF'}
                        </button>
                        <button
                          onClick={() =>
                            onUpdateLayer(layer.id, (prev) => ({
                              ...prev,
                              effects: prev.effects.filter((e) => e.id !== fx.id),
                            }))
                          }
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {Object.entries(fx.params).map(([pKey, pVal]) => {
                      if (typeof pVal === 'string') {
                        return (
                          <div key={pKey} className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400 capitalize">{pKey}</span>
                            <input
                              type="color"
                              value={pVal}
                              onChange={(e) =>
                                onUpdateLayer(layer.id, (prev) => ({
                                  ...prev,
                                  effects: prev.effects.map((item) =>
                                    item.id === fx.id
                                      ? { ...item, params: { ...item.params, [pKey]: e.target.value } }
                                      : item
                                  ),
                                }))
                              }
                              className="w-7 h-6 rounded bg-transparent border-0 cursor-pointer"
                            />
                          </div>
                        );
                      }
                      const maxVal =
                        pKey === 'hue'
                          ? 360
                          : pKey === 'brightness' || pKey === 'contrast' || pKey === 'saturation'
                            ? 200
                            : pKey === 'strength'
                              ? 1
                              : pKey === 'frequency' || pKey === 'fadeIn' || pKey === 'fadeOut'
                                ? 5
                                : 80;
                      const step = maxVal <= 5 ? 0.1 : 1;
                      return (
                        <div key={pKey} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 capitalize">{pKey}</span>
                            <span className="font-mono-tabular text-[#2BE0A5]">{pVal}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={maxVal}
                            step={step}
                            value={pVal}
                            onChange={(e) =>
                              onUpdateLayer(layer.id, (prev) => ({
                                ...prev,
                                effects: prev.effects.map((item) =>
                                  item.id === fx.id
                                    ? {
                                        ...item,
                                        params: {
                                          ...item.params,
                                          [pKey]: Number(e.target.value),
                                        },
                                      }
                                    : item
                                ),
                              }))
                            }
                            className="studio-slider w-full"
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: LAYER-SPECIFIC PROPERTIES */}
        {activeTab === 'properties' && (
          <div className="space-y-3">
            {layer.type === 'text' && (
              <>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400">Text Content</span>
                  <textarea
                    rows={3}
                    value={layer.text || ''}
                    onChange={(e) =>
                      onUpdateLayer(layer.id, (prev) => ({ ...prev, text: e.target.value }))
                    }
                    className="w-full bg-[#222637] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-[#2BE0A5]"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400">Font Family</span>
                  <select
                    value={layer.fontFamily || 'Outfit'}
                    onChange={(e) =>
                      onUpdateLayer(layer.id, (prev) => ({
                        ...prev,
                        fontFamily: e.target.value,
                      }))
                    }
                    className="w-full bg-[#222637] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="Outfit">Outfit</option>
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="Oswald">Oswald</option>
                    <option value="Archivo">Archivo</option>
                    <option value="Playfair Display">Playfair Display</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="bg-[#222637] rounded px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Size</span>
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={layer.fontSize ?? 64}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          fontSize: Number(e.target.value),
                        }))
                      }
                      className="w-14 bg-transparent text-right font-mono-tabular text-xs text-white outline-none"
                    />
                  </label>
                  <label className="bg-[#222637] rounded px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Spacing</span>
                    <input
                      type="number"
                      value={layer.letterSpacing ?? 0}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          letterSpacing: Number(e.target.value),
                        }))
                      }
                      className="w-14 bg-transparent text-right font-mono-tabular text-xs text-white outline-none"
                    />
                  </label>
                </div>
              </>
            )}

            {layer.type === 'shape' && (
              <>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400">Shape Geometry</span>
                  <div className="grid grid-cols-4 gap-1">
                    {SHAPE_CATALOG.map((sc) => (
                      <button
                        key={sc.kind}
                        onClick={() =>
                          onUpdateLayer(layer.id, (prev) => ({
                            ...prev,
                            shapeKind: sc.kind,
                          }))
                        }
                        className={`py-1.5 px-1 rounded text-[11px] truncate border cursor-pointer ${
                          layer.shapeKind === sc.kind
                            ? 'bg-[#2BE0A5]/15 border-[#2BE0A5] text-[#2BE0A5]'
                            : 'bg-[#222637] border-white/[0.06] text-slate-300'
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="bg-[#222637] rounded px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Width</span>
                    <input
                      type="number"
                      value={layer.width ?? 240}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          width: Math.max(10, Number(e.target.value)),
                        }))
                      }
                      className="w-14 bg-transparent text-right font-mono-tabular text-xs text-white outline-none"
                    />
                  </label>
                  <label className="bg-[#222637] rounded px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Height</span>
                    <input
                      type="number"
                      value={layer.height ?? 240}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          height: Math.max(10, Number(e.target.value)),
                        }))
                      }
                      className="w-14 bg-transparent text-right font-mono-tabular text-xs text-white outline-none"
                    />
                  </label>
                </div>
                <div className="bg-[#222637] rounded-lg p-2.5 border border-white/[0.06] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Corner Radius</span>
                    <span className="font-mono-tabular text-[#2BE0A5]">
                      {layer.cornerRadius ?? 24}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={150}
                    value={layer.cornerRadius ?? 24}
                    onChange={(e) =>
                      onUpdateLayer(layer.id, (prev) => ({
                        ...prev,
                        cornerRadius: Number(e.target.value),
                      }))
                    }
                    className="studio-slider w-full"
                  />
                </div>
              </>
            )}

            {layer.type === 'audio' && (
              <div className="bg-[#222637] rounded-lg p-3 border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Audio Volume</span>
                  <span className="font-mono-tabular text-[#2BE0A5]">
                    {Math.round((layer.audioVolume ?? 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={layer.audioVolume ?? 1}
                  onChange={(e) =>
                    onUpdateLayer(layer.id, (prev) => ({
                      ...prev,
                      audioVolume: Number(e.target.value),
                    }))
                  }
                  className="studio-slider w-full"
                />
              </div>
            )}

            {(layer.type === 'null' || layer.type === 'camera' || layer.type === 'group') && (
              <div className="bg-[#222637] rounded-lg p-3 border border-white/[0.06] text-xs text-slate-300 space-y-1.5">
                <p className="font-semibold text-white capitalize">{layer.type} Controller</p>
                <p className="text-slate-400">
                  {layer.type === 'camera'
                    ? 'Animating this Camera moves and zooms the entire stage view smoothly.'
                    : 'Parent other layers to this Null/Group in Move & Transform to animate them together.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
