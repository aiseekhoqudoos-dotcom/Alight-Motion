import React, { useEffect, useRef, useState } from 'react';
import {
  Anchor,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Diamond,
  Download,
  Droplet,
  Eraser,
  Gauge,
  Layers,
  Link2,
  Loader2,
  MoreHorizontal,
  Move,
  PaintBucket,
  Palette,
  Pipette,
  Plus,
  RotateCcw,
  RotateCw,
  Scaling,
  Scissors,
  Search,
  Shapes,
  Sparkles,
  Spline,
  Square,
  Star,
  Trash2,
  Unlink2,
  Upload,
  Volume2,
  VolumeX,
  Wand2,
  Waves,
  X,
} from 'lucide-react';
import {
  AxisLockMode,
  BlendMode,
  EasingCurve,
  EffectInstance,
  EffectType,
  Keyframe,
  Layer,
  LayerPreset,
  LayerStyleClipboard,
  NumericAnimatableProp,
} from '../types/editor';
import {
  BLEND_CATEGORIES,
  EFFECT_CATALOG,
  EffectCategory,
  LAYER_PRESET_CATALOG,
  SHAPE_CATALOG,
  createEffectInstance,
} from '../engine/presets';
import { evaluateLayerTransform, evaluateProperty } from '../engine/easing';
import { EasingGraphEditor } from './EasingGraphEditor';
import { AlightRulerControl } from './AlightRulerControl';

export type BottomDockPanel =
  | 'menu'
  | 'color'
  | 'border'
  | 'blending'
  | 'transform'
  | 'editShape'
  | 'presets'
  | 'effects'
  | 'easing';

interface BottomControlDockProps {
  layer: Layer;
  allLayers: Layer[];
  currentTime: number;
  activePanel: BottomDockPanel;
  axisLock: AxisLockMode;
  copiedEffects: EffectInstance[];
  copiedStyle: LayerStyleClipboard | null;
  copiedKeyframes: Partial<Record<NumericAnimatableProp, Keyframe<number>[]>> | null;
  copiedCurve: EasingCurve | null;
  customPresets: LayerPreset[];
  onChangeAxisLock: (mode: AxisLockMode) => void;
  onChangePanel: (panel: BottomDockPanel) => void;
  onDeselectLayer: () => void;
  onUpdateLayer: (layerId: string, updater: (l: Layer) => Layer) => void;
  onToggleKeyframe: (layerId: string, prop: NumericAnimatableProp) => void;
  onSeek: (time: number) => void;
  onTrimLeft: () => void;
  onSplit: () => void;
  onTrimRight: () => void;
  onOpenAIForLayer: () => void;
  onQuickAISmoothLayer?: (layerId: string) => Promise<string | null>;
  onOpenAIMode?: (mode: 'smooth' | 'effects' | 'layer') => void;
  onCopyEffects: (effects: EffectInstance[]) => void;
  onPasteEffects: (layerId: string) => void;
  onCopyStyle: (layer: Layer) => void;
  onPasteStyle: (layerId: string) => void;
  onCopyKeyframes: (layer: Layer) => void;
  onPasteKeyframes: (layerId: string) => void;
  onCopyCurve: (curve: EasingCurve) => void;
  onApplyPreset: (layerId: string, preset: LayerPreset) => void;
  onSaveCustomPreset: (layer: Layer) => void;
  onDeleteCustomPreset: (presetId: string) => void;
  onExportLayerXML: (layer: Layer) => void;
  onImportPresetXML: (file: File) => void;
}

const COLOR_SWATCHES = [
  '#EF4444', '#F59E0B', '#FDE047', '#22C55E', '#06B6D4', '#3B82F6', '#D946EF',
  '#FFFFFF', '#D1D5DB', '#9CA3AF', '#4B5563', '#090B10', '#7DD3FC', '#86EFAC',
];

const EFFECT_CATEGORIES: Array<'All' | EffectCategory> = [
  'All',
  'Color & Light',
  'Drawing & Edge',
  'Blur',
  'Distortion/Warp',
  'Procedural',
  '3D',
  'Move/Transform',
  'Repeat',
  'Matte/Mask/Key',
  'Opacity/Visibility',
  'Text',
];

type TransformSubMode = 'position' | 'rotation' | 'scale' | 'skew' | 'anchor';
type RotationAxis = 'rotation' | 'rotateX' | 'rotateY';

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  layer,
  allLayers,
  currentTime,
  activePanel,
  axisLock,
  copiedEffects,
  copiedStyle,
  copiedKeyframes,
  copiedCurve,
  customPresets,
  onChangeAxisLock,
  onChangePanel,
  onDeselectLayer,
  onUpdateLayer,
  onToggleKeyframe,
  onSeek,
  onTrimLeft,
  onSplit,
  onTrimRight,
  onOpenAIForLayer,
  onQuickAISmoothLayer,
  onOpenAIMode,
  onCopyEffects,
  onPasteEffects,
  onCopyStyle,
  onPasteStyle,
  onCopyKeyframes,
  onPasteKeyframes,
  onCopyCurve,
  onApplyPreset,
  onSaveCustomPreset,
  onDeleteCustomPreset,
  onExportLayerXML,
  onImportPresetXML,
}) => {
  const [transformMode, setTransformMode] = useState<TransformSubMode>('position');
  const [rotationAxis, setRotationAxis] = useState<RotationAxis>('rotation');
  const [scaleLinked, setScaleLinked] = useState(true);

  const [colorSubTab, setColorSubTab] = useState<'none' | 'solid' | 'gradient'>(
    layer.fillGradient?.enabled ? 'gradient' : 'solid'
  );
  const [borderSubTab, setBorderSubTab] = useState<'stroke' | 'shadow'>('stroke');
  const [expandedBlendGroup, setExpandedBlendGroup] = useState<string>('Normal');
  const [showEffectBrowser, setShowEffectBrowser] = useState(false);
  const [effectSearch, setEffectSearch] = useState('');
  const [effectCategory, setEffectCategory] = useState<'All' | EffectCategory>('All');
  const [presetCategory, setPresetCategory] = useState<'All' | LayerPreset['category']>('All');
  const [railMenuOpen, setRailMenuOpen] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [isSmoothingQuick, setIsSmoothingQuick] = useState(false);

  const [easingProp, setEasingProp] = useState<NumericAnimatableProp>('x');
  const [selectedKfIdx, setSelectedKfIdx] = useState(0);
  const [shapeSizeLinked, setShapeSizeLinked] = useState(true);

  const padDragRef = useRef<{
    startX: number;
    startY: number;
    origA: number;
    origB: number;
  } | null>(null);

  const evaluated = evaluateLayerTransform(layer, currentTime);

  const flashFeedback = (msg: string) => {
    setStatusFeedback(msg);
    window.setTimeout(() => setStatusFeedback(null), 2200);
  };

  const runQuickAISmooth = async () => {
    if (!onQuickAISmoothLayer || isSmoothingQuick) return;
    setIsSmoothingQuick(true);
    try {
      const msg = await onQuickAISmoothLayer(layer.id);
      flashFeedback(msg || 'AI Smooth Applied');
    } catch (err) {
      flashFeedback(err instanceof Error ? err.message : 'AI Smooth failed');
    } finally {
      setIsSmoothingQuick(false);
    }
  };

  // Auto-select a property that actually has >= 2 keyframes when switching to Easing panel or layer
  useEffect(() => {
    if (activePanel !== 'easing') return;
    const currentCount = layer.keyframes[easingProp]?.length ?? 0;
    if (currentCount >= 2) return;
    const firstAnimated = (Object.entries(layer.keyframes) as Array<
      [NumericAnimatableProp, Keyframe<number>[] | undefined]
    >).find(([, arr]) => (arr?.length ?? 0) >= 2);
    if (firstAnimated) {
      setEasingProp(firstAnimated[0]);
      setSelectedKfIdx(0);
    }
  }, [activePanel, layer.id, layer.keyframes, easingProp]);

  // Auto-sync active segment index to playhead when inside easing panel
  const propKfs = [...(layer.keyframes[easingProp] || [])].sort(
    (a, b) => a.time - b.time
  );
  useEffect(() => {
    if (propKfs.length < 2) return;
    const spanIdx = propKfs.findIndex(
      (kf, i) => i < propKfs.length - 1 && currentTime >= kf.time && currentTime <= propKfs[i + 1].time
    );
    if (spanIdx >= 0 && spanIdx !== selectedKfIdx) {
      setSelectedKfIdx(spanIdx);
    }
  }, [currentTime, propKfs, selectedKfIdx]);

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
      if (prop in prev.transform || prop === 'rotateX' || prop === 'rotateY') {
        return {
          ...prev,
          transform: { ...prev.transform, [prop]: newValue },
        };
      }
      return { ...prev, [prop]: newValue };
    });
  };

  const activePropForPanel: NumericAnimatableProp =
    activePanel === 'blending'
      ? 'opacity'
      : activePanel === 'border'
        ? 'strokeWidth'
        : transformMode === 'rotation'
          ? rotationAxis
          : transformMode === 'scale'
            ? axisLock === 'y'
              ? 'scaleY'
              : 'scaleX'
            : transformMode === 'skew'
              ? axisLock === 'y'
                ? 'skewY'
                : 'skewX'
              : transformMode === 'anchor'
                ? axisLock === 'y'
                  ? 'anchorY'
                  : 'anchorX'
                : axisLock === 'y'
                  ? 'y'
                  : 'x';

  const hasKeyframeAtPlayhead = (prop: NumericAnimatableProp) =>
    Boolean(layer.keyframes[prop]?.some((k) => Math.abs(k.time - currentTime) < 0.05));

  const clampedPairIdx = Math.max(
    0,
    Math.min(Math.max(0, propKfs.length - 2), selectedKfIdx)
  );
  const activeKfForEasing = propKfs[clampedPairIdx];
  const nextKfForEasing = propKfs[clampedPairIdx + 1];

  const playheadProgress =
    activeKfForEasing && nextKfForEasing && nextKfForEasing.time > activeKfForEasing.time
      ? (currentTime - activeKfForEasing.time) /
        (nextKfForEasing.time - activeKfForEasing.time)
      : null;

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

  const availableParents = allLayers.filter(
    (other) => other.id !== layer.id && other.type !== 'audio' && other.type !== 'camera'
  );

  const fadeFx = layer.effects.find((f) => f.type === 'fadeInOut');

  // PANEL 0: Main Layer Control Grid (matches Alight Motion Screenshot)
  if (activePanel === 'menu') {
    return (
      <div className="relative bg-[#1A1E2B] border-t border-white/[0.08] px-3 py-2.5 flex flex-col gap-2 shrink-0">
        {statusFeedback && (
          <div className="absolute -top-8 right-3 z-40 px-2.5 py-1 rounded bg-[#38B2CE] text-[#0E131D] text-[11px] font-bold shadow-lg">
            {statusFeedback}
          </div>
        )}
        {/* Top Utility Strip */}
        <div className="grid grid-cols-7 gap-1.5 max-w-2xl mx-auto w-full">
          <button
            onClick={() => onChangePanel('easing')}
            title="Easing & Speed Curves"
            className="h-9 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <Gauge className="w-4 h-4" />
          </button>
          <button
            onClick={onTrimLeft}
            title="Trim Left to Playhead"
            className="h-9 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex items-center justify-center text-slate-200 font-mono-tabular text-xs cursor-pointer"
          >
            |&lt;
          </button>
          <button
            onClick={onSplit}
            title="Split at Playhead"
            className="h-9 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <Scissors className="w-4 h-4" />
          </button>
          <button
            onClick={onTrimRight}
            title="Trim Right to Playhead"
            className="h-9 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex items-center justify-center text-slate-200 font-mono-tabular text-xs cursor-pointer"
          >
            &gt;|
          </button>
          <button
            onClick={() =>
              onUpdateLayer(layer.id, (prev) => ({
                ...prev,
                audioVolume: (prev.audioVolume ?? 1) > 0 ? 0 : 1,
              }))
            }
            title="Toggle Mute / Volume"
            className="h-9 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex items-center justify-center text-slate-200 cursor-pointer"
          >
            {(layer.audioVolume ?? 1) === 0 ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={runQuickAISmooth}
            disabled={isSmoothingQuick}
            title="1-Click AI Smooth Curves"
            className="h-9 rounded-lg bg-[#38B2CE]/15 hover:bg-[#38B2CE]/25 border border-[#38B2CE]/40 flex items-center justify-center gap-1 text-[#38B2CE] text-[10px] font-bold cursor-pointer disabled:opacity-50"
          >
            {isSmoothingQuick ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Waves className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Smooth</span>
          </button>
          <button
            onClick={onOpenAIForLayer}
            title="AI Animate Layer"
            className="h-9 rounded-lg bg-[#2BE0A5]/15 hover:bg-[#2BE0A5]/25 border border-[#2BE0A5]/40 flex items-center justify-center text-[#2BE0A5] cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        {/* Row 1: Color & Fill | Border & Shadow | Blending & Opacity */}
        <div className="grid grid-cols-3 gap-1.5 max-w-2xl mx-auto w-full">
          <button
            onClick={() => onChangePanel('color')}
            className="h-14 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex flex-col items-center justify-center gap-1 text-slate-200 hover:text-[#2BE0A5] transition-colors cursor-pointer"
          >
            <PaintBucket className="w-5 h-5" />
            <span className="text-[11px] font-medium">Color &amp; Fill</span>
          </button>
          <button
            onClick={() => onChangePanel('border')}
            className="h-14 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex flex-col items-center justify-center gap-1 text-slate-200 hover:text-[#2BE0A5] transition-colors cursor-pointer"
          >
            <Square className="w-5 h-5" />
            <span className="text-[11px] font-medium">Border &amp; Shadow</span>
          </button>
          <button
            onClick={() => onChangePanel('blending')}
            className="h-14 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex flex-col items-center justify-center gap-1 text-slate-200 hover:text-[#2BE0A5] transition-colors cursor-pointer"
          >
            <Layers className="w-5 h-5" />
            <span className="text-[11px] font-medium">Blending &amp; Opacity</span>
          </button>
        </div>

        {/* Row 2: Move & Transform | Edit Shape/Text | Presets | Effects */}
        <div className="grid grid-cols-4 gap-1.5 max-w-2xl mx-auto w-full">
          <button
            onClick={() => onChangePanel('transform')}
            className="h-14 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex flex-col items-center justify-center gap-1 text-slate-200 hover:text-[#2BE0A5] transition-colors cursor-pointer"
          >
            <Move className="w-5 h-5" />
            <span className="text-[11px] font-medium truncate max-w-full px-1">
              Move &amp; Transform
            </span>
          </button>
          <button
            onClick={() => onChangePanel('editShape')}
            className="h-14 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex flex-col items-center justify-center gap-1 text-slate-200 hover:text-[#2BE0A5] transition-colors cursor-pointer"
          >
            <Shapes className="w-5 h-5" />
            <span className="text-[11px] font-medium truncate max-w-full px-1">
              {layer.type === 'text' ? 'Edit Text' : 'Edit Shape'}
            </span>
          </button>
          <button
            onClick={() => onChangePanel('presets')}
            className="h-14 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex flex-col items-center justify-center gap-1 text-slate-200 hover:text-[#2BE0A5] transition-colors cursor-pointer"
          >
            <Star className="w-5 h-5" />
            <span className="text-[11px] font-medium truncate max-w-full px-1">
              Presets
            </span>
          </button>
          <button
            onClick={() => onChangePanel('effects')}
            className="h-14 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.06] flex flex-col items-center justify-center gap-1 text-slate-200 hover:text-[#2BE0A5] transition-colors cursor-pointer"
          >
            <Wand2 className="w-5 h-5" />
            <span className="text-[11px] font-medium">Effects</span>
          </button>
        </div>
      </div>
    );
  }

  // SUB-PANELS: Left Rail (← | ◆+ | Curve | •••) + Main Bottom Content
  return (
    <div className="relative h-[242px] sm:h-[258px] bg-[#1A1E2B] border-t border-white/[0.08] flex shrink-0 overflow-hidden">
      {/* Status Feedback Pill */}
      {statusFeedback && (
        <div className="absolute top-2 right-3 z-40 px-2.5 py-1 rounded bg-[#2BE0A5] text-[#0E131D] text-[11px] font-bold shadow-lg">
          {statusFeedback}
        </div>
      )}

      {/* Left Rail Quick Clipboard Menu Popover */}
      {railMenuOpen && (
        <div className="absolute bottom-2 left-14 z-50 w-52 bg-[#1E2231] border border-white/15 rounded-xl shadow-2xl py-1.5 text-xs">
          <button
            onClick={() => {
              onCopyEffects(layer.effects);
              setRailMenuOpen(false);
              flashFeedback(`Copied ${layer.effects.length} effect(s)`);
            }}
            className="w-full px-3 py-2 flex items-center gap-2 text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Effects ({layer.effects.length})</span>
          </button>
          <button
            disabled={copiedEffects.length === 0}
            onClick={() => {
              onPasteEffects(layer.id);
              setRailMenuOpen(false);
              flashFeedback(`Pasted ${copiedEffects.length} effect(s)`);
            }}
            className="w-full px-3 py-2 flex items-center gap-2 text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] disabled:opacity-35 cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Paste Effects ({copiedEffects.length})</span>
          </button>
          <div className="my-1 border-t border-white/[0.08]" />
          <button
            onClick={() => {
              onCopyStyle(layer);
              setRailMenuOpen(false);
              flashFeedback('Layer Style copied');
            }}
            className="w-full px-3 py-2 flex items-center gap-2 text-left text-slate-200 hover:bg-white/[0.07] cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Copy Color &amp; Blend Style</span>
          </button>
          <button
            disabled={!copiedStyle}
            onClick={() => {
              onPasteStyle(layer.id);
              setRailMenuOpen(false);
              flashFeedback('Layer Style pasted');
            }}
            className="w-full px-3 py-2 flex items-center gap-2 text-left text-slate-200 hover:bg-white/[0.07] disabled:opacity-35 cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Paste Style</span>
          </button>
          <div className="my-1 border-t border-white/[0.08]" />
          <button
            onClick={() => {
              onCopyKeyframes(layer);
              setRailMenuOpen(false);
              flashFeedback('Keyframes copied');
            }}
            className="w-full px-3 py-2 flex items-center gap-2 text-left text-slate-200 hover:bg-white/[0.07] cursor-pointer"
          >
            <Diamond className="w-3.5 h-3.5" />
            <span>Copy Keyframes</span>
          </button>
          <button
            disabled={!copiedKeyframes}
            onClick={() => {
              onPasteKeyframes(layer.id);
              setRailMenuOpen(false);
              flashFeedback('Keyframes pasted');
            }}
            className="w-full px-3 py-2 flex items-center gap-2 text-left text-slate-200 hover:bg-white/[0.07] disabled:opacity-35 cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Paste Keyframes</span>
          </button>
          <div className="my-1 border-t border-white/[0.08]" />
          <button
            onClick={() => {
              setRailMenuOpen(false);
              onDeselectLayer();
            }}
            className="w-full px-3 py-2 flex items-center gap-2 text-left text-rose-400 hover:bg-rose-500/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Controls</span>
          </button>
        </div>
      )}

      {/* Left Rail (← | ◆+ | Curve | •••) */}
      <div className="w-12 sm:w-14 bg-[#161925] border-r border-white/[0.08] flex flex-col items-center justify-between py-2 shrink-0">
        <button
          onClick={() => {
            setRailMenuOpen(false);
            onChangePanel('menu');
          }}
          title="Back to Layer Controls"
          className="w-9 h-9 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-slate-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => onToggleKeyframe(layer.id, activePropForPanel)}
          title={`Toggle Keyframe on ${activePropForPanel}`}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            hasKeyframeAtPlayhead(activePropForPanel)
              ? 'bg-[#2BE0A5] text-[#0E131D]'
              : 'bg-[#24293B] text-slate-300 hover:text-white'
          }`}
        >
          <Diamond className="w-4 h-4 fill-current" />
        </button>

        <button
          onClick={() => {
            setEasingProp(activePropForPanel);
            onChangePanel(activePanel === 'easing' ? 'transform' : 'easing');
          }}
          title="Easing Curve Graph"
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            activePanel === 'easing'
              ? 'bg-[#2BE0A5]/20 text-[#2BE0A5]'
              : 'bg-[#24293B] text-slate-300 hover:text-white'
          }`}
        >
          <Spline className="w-4 h-4" />
        </button>

        <button
          onClick={() => setRailMenuOpen((v) => !v)}
          title="Copy / Paste Effects, Style & Keyframes"
          className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer ${
            railMenuOpen
              ? 'bg-[#2BE0A5]/20 text-[#2BE0A5]'
              : 'hover:bg-white/[0.08] text-slate-300 hover:text-white'
          }`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Center / Main Sub-Panel Area */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 max-w-4xl mx-auto w-full">
        {/* 1. MOVE & TRANSFORM (Alight Motion Swipe Pad with Clickable X / Y / XY Axis Pills) */}
        {activePanel === 'transform' && (
          <div className="h-full flex gap-2.5">
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              {/* Compact Sub-Options Strip (Parent + Mode-Specific Controls, No Separate Axis Controller) */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {transformMode === 'rotation' ? (
                  <div className="flex items-center gap-1 bg-[#161925] p-0.5 rounded-lg border border-white/[0.06]">
                    {(
                      [
                        ['rotation', 'Rot Z'],
                        ['rotateX', 'Rot X'],
                        ['rotateY', 'Rot Y'],
                      ] as Array<[RotationAxis, string]>
                    ).map(([ax, lbl]) => (
                      <button
                        key={ax}
                        onClick={() => setRotationAxis(ax)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                          rotationAxis === ax
                            ? 'bg-[#38B2CE] text-[#0E131D]'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                ) : transformMode === 'scale' ? (
                  <button
                    onClick={() => {
                      const next = !scaleLinked;
                      setScaleLinked(next);
                      if (next) onChangeAxisLock('both');
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer border ${
                      scaleLinked
                        ? 'bg-[#2BE0A5]/15 border-[#2BE0A5] text-[#2BE0A5]'
                        : 'bg-[#161925] border-white/10 text-slate-300'
                    }`}
                  >
                    {scaleLinked ? <Link2 className="w-3 h-3" /> : <Unlink2 className="w-3 h-3" />}
                    <span>{scaleLinked ? 'Uniform' : 'X / Y Free'}</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">
                    Tap <strong className="text-slate-200">X</strong>,{' '}
                    <strong className="text-slate-200">Y</strong> or{' '}
                    <strong className="text-slate-200">XY</strong> below to lock axis
                  </span>
                )}

                <select
                  value={layer.parentId || ''}
                  onChange={(e) =>
                    onUpdateLayer(layer.id, (prev) => ({
                      ...prev,
                      parentId: e.target.value || null,
                    }))
                  }
                  className="px-2 py-0.5 rounded bg-[#222637] border border-white/[0.08] text-[11px] text-slate-200 outline-none max-w-[130px]"
                  title="Parent Null / Group"
                >
                  <option value="">No Parent</option>
                  {availableParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      ↳ {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Alight Motion Touch Pad */}
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
                          ? rotationAxis === 'rotateX'
                            ? evaluated.rotateX ?? 0
                            : rotationAxis === 'rotateY'
                              ? evaluated.rotateY ?? 0
                              : evaluated.rotation
                          : transformMode === 'scale'
                            ? evaluated.scaleX
                            : transformMode === 'anchor'
                              ? evaluated.anchorX
                              : evaluated.skewX,
                    origB:
                      transformMode === 'position'
                        ? evaluated.y
                        : transformMode === 'scale'
                          ? evaluated.scaleY
                          : transformMode === 'anchor'
                            ? evaluated.anchorY
                            : evaluated.skewY,
                  };
                }}
                onPointerMove={(e) => {
                  const d = padDragRef.current;
                  if (!d) return;
                  const dx = e.clientX - d.startX;
                  const dy = e.clientY - d.startY;
                  if (transformMode === 'position') {
                    if (axisLock !== 'y') updatePropValue('x', Math.round(d.origA + dx * 1.5));
                    if (axisLock !== 'x') updatePropValue('y', Math.round(d.origB + dy * 1.5));
                  } else if (transformMode === 'rotation') {
                    updatePropValue(rotationAxis, Math.round(d.origA + dx * 0.8));
                  } else if (transformMode === 'scale') {
                    if (scaleLinked && axisLock === 'both') {
                      const factor = Math.max(0.05, Number((d.origA + dx * 0.01).toFixed(2)));
                      updatePropValue('scaleX', factor);
                      updatePropValue('scaleY', factor);
                    } else {
                      if (axisLock !== 'y') {
                        updatePropValue(
                          'scaleX',
                          Math.max(0.05, Number((d.origA + dx * 0.01).toFixed(2)))
                        );
                      }
                      if (axisLock !== 'x') {
                        updatePropValue(
                          'scaleY',
                          Math.max(0.05, Number((d.origB - dy * 0.01).toFixed(2)))
                        );
                      }
                    }
                  } else if (transformMode === 'anchor') {
                    if (axisLock !== 'y') updatePropValue('anchorX', Math.round(d.origA + dx * 1.2));
                    if (axisLock !== 'x') updatePropValue('anchorY', Math.round(d.origB + dy * 1.2));
                  } else {
                    if (axisLock !== 'y') updatePropValue('skewX', Math.round(d.origA + dx * 0.4));
                    if (axisLock !== 'x') updatePropValue('skewY', Math.round(d.origB + dy * 0.4));
                  }
                }}
                onPointerUp={() => {
                  padDragRef.current = null;
                }}
                className="flex-1 bg-[#222637] rounded-xl border border-white/[0.08] px-3 py-2 flex flex-col justify-between cursor-move touch-none hover:border-[#2BE0A5]/40"
              >
                {/* Top Row inside Touch Pad: Clickable X / Y / XY Pills + Reset */}
                <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular">
                  {transformMode === 'rotation' ? (
                    <div
                      className="flex items-center gap-1.5"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setRotationAxis('rotation')}
                        className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                          rotationAxis === 'rotation'
                            ? 'bg-[#2BE0A5]/20 border-[#2BE0A5] text-[#2BE0A5] font-bold'
                            : 'bg-[#2B3044] border-transparent text-slate-300'
                        }`}
                      >
                        Z: {Math.round(evaluated.rotation)}°
                      </button>
                      <button
                        type="button"
                        onClick={() => setRotationAxis('rotateX')}
                        className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                          rotationAxis === 'rotateX'
                            ? 'bg-[#38B2CE]/20 border-[#38B2CE] text-[#38B2CE] font-bold'
                            : 'bg-[#2B3044] border-transparent text-slate-300'
                        }`}
                      >
                        RX: {Math.round(evaluated.rotateX ?? 0)}°
                      </button>
                      <button
                        type="button"
                        onClick={() => setRotationAxis('rotateY')}
                        className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                          rotationAxis === 'rotateY'
                            ? 'bg-[#F2A833]/20 border-[#F2A833] text-[#F2A833] font-bold'
                            : 'bg-[#2B3044] border-transparent text-slate-300'
                        }`}
                      >
                        RY: {Math.round(evaluated.rotateY ?? 0)}°
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1.5"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (transformMode === 'scale') setScaleLinked(false);
                          onChangeAxisLock(axisLock === 'x' ? 'both' : 'x');
                        }}
                        title="Click to lock/unlock X-axis only"
                        className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                          axisLock === 'x'
                            ? 'bg-[#2BE0A5] border-[#2BE0A5] text-[#0E131D] font-bold'
                            : axisLock === 'both'
                              ? 'bg-[#2B3044] border-[#2BE0A5]/50 text-[#2BE0A5]'
                              : 'bg-[#161925] border-white/5 text-slate-500'
                        }`}
                      >
                        {transformMode === 'position' && `X: ${Math.round(evaluated.x)}`}
                        {transformMode === 'scale' && `SX: ${Math.round(evaluated.scaleX * 100)}%`}
                        {transformMode === 'skew' && `SKX: ${Math.round(evaluated.skewX)}°`}
                        {transformMode === 'anchor' && `PX: ${Math.round(evaluated.anchorX)}`}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (transformMode === 'scale') setScaleLinked(false);
                          onChangeAxisLock(axisLock === 'y' ? 'both' : 'y');
                        }}
                        title="Click to lock/unlock Y-axis only"
                        className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                          axisLock === 'y'
                            ? 'bg-[#38B2CE] border-[#38B2CE] text-[#0E131D] font-bold'
                            : axisLock === 'both'
                              ? 'bg-[#2B3044] border-[#38B2CE]/50 text-[#38B2CE]'
                              : 'bg-[#161925] border-white/5 text-slate-500'
                        }`}
                      >
                        {transformMode === 'position' && `Y: ${Math.round(evaluated.y)}`}
                        {transformMode === 'scale' && `SY: ${Math.round(evaluated.scaleY * 100)}%`}
                        {transformMode === 'skew' && `SKY: ${Math.round(evaluated.skewY)}°`}
                        {transformMode === 'anchor' && `PY: ${Math.round(evaluated.anchorY)}`}
                      </button>

                      <button
                        type="button"
                        onClick={() => onChangeAxisLock('both')}
                        title="Enable both X and Y movement"
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
                          axisLock === 'both'
                            ? 'bg-white/15 border-white/30 text-white'
                            : 'bg-[#161925] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        XY
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() =>
                      updatePropValue(
                        activePropForPanel,
                        activePropForPanel.startsWith('scale') ? 1 : 0
                      )
                    }
                    title="Reset active axis"
                    className="px-2 py-0.5 rounded bg-[#161925] border border-white/[0.08] text-slate-300 hover:text-white flex items-center gap-1 text-[10px] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Center Alight Motion Touch Pad Hint */}
                <div className="flex-1 flex flex-col items-center justify-center text-center pointer-events-none select-none py-1">
                  <span className="text-xs font-medium text-slate-300">
                    {transformMode === 'position' &&
                      (axisLock === 'x'
                        ? 'Swipe horizontally to move X only'
                        : axisLock === 'y'
                          ? 'Swipe vertically to move Y only'
                          : 'Swipe here to move layer')}
                    {transformMode === 'rotation' && `Swipe horizontally to adjust ${rotationAxis}`}
                    {transformMode === 'scale' &&
                      (axisLock === 'x'
                        ? 'Swipe horizontally to scale X'
                        : axisLock === 'y'
                          ? 'Swipe vertically to scale Y'
                          : 'Swipe here to scale layer')}
                    {transformMode === 'skew' && 'Swipe here to skew layer'}
                    {transformMode === 'anchor' && 'Swipe here to move pivot / anchor'}
                  </span>
                </div>

                {/* Bottom Fine Nudge Row */}
                <div
                  className="flex items-center justify-between gap-2"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] font-mono-tabular text-slate-400 uppercase">
                    Axis: {transformMode === 'rotation' ? rotationAxis : activePropForPanel}
                  </span>
                  <div className="flex items-center gap-1">
                    {[-10, -1, 1, 10].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() => {
                          const prop = activePropForPanel;
                          const cur =
                            prop === 'x'
                              ? evaluated.x
                              : prop === 'y'
                                ? evaluated.y
                                : prop === 'rotation'
                                  ? evaluated.rotation
                                  : prop === 'rotateX'
                                    ? evaluated.rotateX ?? 0
                                    : prop === 'rotateY'
                                      ? evaluated.rotateY ?? 0
                                      : prop === 'scaleX'
                                        ? evaluated.scaleX
                                        : prop === 'scaleY'
                                          ? evaluated.scaleY
                                          : prop === 'anchorX'
                                            ? evaluated.anchorX
                                            : prop === 'anchorY'
                                              ? evaluated.anchorY
                                              : prop === 'skewX'
                                                ? evaluated.skewX
                                                : evaluated.skewY;
                          const step = prop.startsWith('scale') ? delta * 0.02 : delta;
                          updatePropValue(
                            prop,
                            Number((cur + step).toFixed(prop.startsWith('scale') ? 2 : 0))
                          );
                        }}
                        className="px-2 py-0.5 rounded bg-[#161925] hover:bg-white/10 text-slate-200 text-[10px] font-mono-tabular cursor-pointer"
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5-Button Vertical Sub-Tool Rail */}
            <div className="w-11 flex flex-col gap-1 shrink-0">
              {(
                [
                  ['position', Move, 'Position'],
                  ['rotation', RotateCw, 'Rotation Z / X / Y'],
                  ['scale', Scaling, 'Scale'],
                  ['skew', ArrowUpDown, 'Skew'],
                  ['anchor', Anchor, 'Pivot / Anchor'],
                ] as Array<[TransformSubMode, React.FC<{ className?: string }>, string]>
              ).map(([id, Icon, label]) => {
                const active = transformMode === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTransformMode(id)}
                    title={label}
                    className={`flex-1 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#2B3044] border-[#2BE0A5] text-[#2BE0A5]'
                        : 'bg-[#222637] border-white/[0.06] text-slate-300 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. COLOR & FILL */}
        {activePanel === 'color' && (
          <div className="h-full flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-1.5 bg-[#161925] p-1 rounded-lg">
              <button
                onClick={() => {
                  setColorSubTab('none');
                  onUpdateLayer(layer.id, (prev) => ({
                    ...prev,
                    fillColor: 'transparent',
                    fillGradient: prev.fillGradient
                      ? { ...prev.fillGradient, enabled: false }
                      : undefined,
                  }));
                }}
                className={`py-1 rounded flex items-center justify-center gap-1 text-xs font-medium cursor-pointer ${
                  colorSubTab === 'none'
                    ? 'bg-[#2B3044] text-[#2BE0A5]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>None</span>
              </button>
              <button
                onClick={() => {
                  setColorSubTab('solid');
                  onUpdateLayer(layer.id, (prev) => ({
                    ...prev,
                    fillColor:
                      prev.fillColor === 'transparent' ? '#B38CA5' : prev.fillColor || '#B38CA5',
                    fillGradient: prev.fillGradient
                      ? { ...prev.fillGradient, enabled: false }
                      : undefined,
                  }));
                }}
                className={`py-1 rounded flex items-center justify-center gap-1 text-xs font-medium cursor-pointer ${
                  colorSubTab === 'solid'
                    ? 'bg-[#2B3044] text-[#2BE0A5]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PaintBucket className="w-3.5 h-3.5" />
                <span>Solid</span>
              </button>
              <button
                onClick={() => {
                  setColorSubTab('gradient');
                  onUpdateLayer(layer.id, (prev) => ({
                    ...prev,
                    fillGradient: {
                      enabled: true,
                      color1: prev.fillGradient?.color1 || prev.fillColor || '#2BE0A5',
                      color2: prev.fillGradient?.color2 || '#38B2CE',
                      angle: prev.fillGradient?.angle ?? 135,
                    },
                  }));
                }}
                className={`py-1 rounded flex items-center justify-center gap-1 text-xs font-medium cursor-pointer ${
                  colorSubTab === 'gradient'
                    ? 'bg-[#2B3044] text-[#2BE0A5]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Droplet className="w-3.5 h-3.5" />
                <span>Gradient</span>
              </button>
            </div>

            {colorSubTab === 'gradient' ? (
              <div className="bg-[#222637] rounded-lg p-3 border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-200">
                    <span>Color 1</span>
                    <input
                      type="color"
                      value={layer.fillGradient?.color1 || '#2BE0A5'}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          fillGradient: {
                            enabled: true,
                            color1: e.target.value,
                            color2: prev.fillGradient?.color2 || '#38B2CE',
                            angle: prev.fillGradient?.angle ?? 135,
                          },
                        }))
                      }
                      className="w-8 h-7 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-200">
                    <span>Color 2</span>
                    <input
                      type="color"
                      value={layer.fillGradient?.color2 || '#38B2CE'}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          fillGradient: {
                            enabled: true,
                            color1: prev.fillGradient?.color1 || '#2BE0A5',
                            color2: e.target.value,
                            angle: prev.fillGradient?.angle ?? 135,
                          },
                        }))
                      }
                      className="w-8 h-7 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-3 text-xs text-slate-300">
                  <span className="w-24 shrink-0">Gradient Angle</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={layer.fillGradient?.angle ?? 135}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateLayer(layer.id, (prev) => ({
                        ...prev,
                        fillGradient: {
                          enabled: true,
                          color1: prev.fillGradient?.color1 || '#2BE0A5',
                          color2: prev.fillGradient?.color2 || '#38B2CE',
                          angle: val,
                        },
                      }));
                    }}
                    className="flex-1 studio-slider"
                  />
                  <span className="w-12 text-right font-mono-tabular text-[#2BE0A5]">
                    {layer.fillGradient?.angle ?? 135}°
                  </span>
                </label>
              </div>
            ) : (
              <div className="flex-1 flex gap-2.5">
                <div className="flex-1 bg-[#222637] rounded-lg border border-white/[0.06] overflow-hidden flex flex-col">
                  <div
                    style={{
                      backgroundColor:
                        layer.fillColor && layer.fillColor !== 'transparent'
                          ? layer.fillColor
                          : '#33394D',
                    }}
                    className="h-8 px-3 flex items-center justify-between text-xs font-mono-tabular font-bold text-[#0E131D]"
                  >
                    <span className="bg-white/75 px-2 py-0.5 rounded">
                      {(layer.fillColor || '#2BE0A5').toUpperCase()} ({Math.round(evaluated.opacity)}%)
                    </span>
                    <input
                      type="color"
                      value={
                        layer.fillColor && layer.fillColor !== 'transparent'
                          ? layer.fillColor
                          : '#2BE0A5'
                      }
                      onChange={(e) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          fillColor: e.target.value,
                        }))
                      }
                      className="w-6 h-6 rounded cursor-pointer border border-black/20"
                      title="Custom Color Picker"
                    />
                  </div>
                  <div className="flex-1 p-2 grid grid-cols-7 gap-1.5">
                    {COLOR_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => {
                          setColorSubTab('solid');
                          onUpdateLayer(layer.id, (prev) => ({
                            ...prev,
                            fillColor: hex,
                            fillGradient: prev.fillGradient
                              ? { ...prev.fillGradient, enabled: false }
                              : undefined,
                          }));
                        }}
                        style={{ backgroundColor: hex }}
                        className={`rounded-md border transition-transform hover:scale-105 cursor-pointer ${
                          layer.fillColor?.toUpperCase() === hex
                            ? 'ring-2 ring-[#2BE0A5] border-white'
                            : 'border-white/15'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="w-11 flex flex-col gap-1.5 shrink-0">
                  <label
                    title="Pick Custom Color"
                    className="flex-1 rounded-lg bg-[#222637] border border-white/[0.06] flex items-center justify-center text-slate-300 hover:text-[#2BE0A5] cursor-pointer"
                  >
                    <Pipette className="w-4 h-4" />
                    <input
                      type="color"
                      value={
                        layer.fillColor && layer.fillColor !== 'transparent'
                          ? layer.fillColor
                          : '#2BE0A5'
                      }
                      onChange={(e) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          fillColor: e.target.value,
                        }))
                      }
                      className="sr-only"
                    />
                  </label>
                  <button
                    onClick={() => onChangePanel('blending')}
                    title="Opacity & Blending"
                    className="flex-1 rounded-lg bg-[#222637] border border-white/[0.06] flex items-center justify-center text-slate-300 hover:text-[#2BE0A5] cursor-pointer"
                  >
                    <Palette className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. BORDER & SHADOW */}
        {activePanel === 'border' && (
          <div className="h-full flex gap-2.5">
            <div className="flex-1 bg-[#222637] rounded-lg p-3 border border-white/[0.06] flex flex-col justify-between">
              {borderSubTab === 'stroke' ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={layer.strokeColor || '#FFFFFF'}
                        onChange={(e) =>
                          onUpdateLayer(layer.id, (prev) => ({
                            ...prev,
                            strokeColor: e.target.value,
                          }))
                        }
                        className="w-7 h-7 rounded bg-transparent border border-white/20 cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-white">Stroke</span>
                    </div>

                    <button
                      onClick={() =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          strokeWidth: (prev.strokeWidth ?? 0) > 0 ? 0 : 4,
                        }))
                      }
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                        (layer.strokeWidth ?? 0) > 0 ? 'bg-[#2BE0A5]' : 'bg-[#363C54]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          (layer.strokeWidth ?? 0) > 0 ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <AlightRulerControl
                    label="Stroke Width"
                    min={0}
                    max={40}
                    step={0.5}
                    unit="px"
                    value={layer.strokeWidth ?? 0}
                    onChange={(val) => updatePropValue('strokeWidth', val)}
                  />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={layer.shadow?.color?.startsWith('#') ? layer.shadow.color : '#000000'}
                        onChange={(e) =>
                          onUpdateLayer(layer.id, (prev) => ({
                            ...prev,
                            shadow: {
                              enabled: true,
                              color: e.target.value,
                              blur: prev.shadow?.blur ?? 20,
                              offsetX: prev.shadow?.offsetX ?? 0,
                              offsetY: prev.shadow?.offsetY ?? 12,
                            },
                          }))
                        }
                        className="w-7 h-7 rounded bg-transparent border border-white/20 cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-white">Drop Shadow</span>
                    </div>
                    <button
                      onClick={() =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          shadow: {
                            enabled: !(prev.shadow?.enabled ?? false),
                            color: prev.shadow?.color ?? 'rgba(0,0,0,0.7)',
                            blur: prev.shadow?.blur ?? 20,
                            offsetX: prev.shadow?.offsetX ?? 0,
                            offsetY: prev.shadow?.offsetY ?? 12,
                          },
                        }))
                      }
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                        layer.shadow?.enabled ? 'bg-[#2BE0A5]' : 'bg-[#363C54]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          layer.shadow?.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2.5 text-xs text-slate-300">
                      <span className="w-10 shrink-0">Blur</span>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={1}
                        value={layer.shadow?.blur ?? 20}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onUpdateLayer(layer.id, (prev) => ({
                            ...prev,
                            shadow: {
                              enabled: true,
                              color: prev.shadow?.color ?? 'rgba(0,0,0,0.7)',
                              blur: val,
                              offsetX: prev.shadow?.offsetX ?? 0,
                              offsetY: prev.shadow?.offsetY ?? 12,
                            },
                          }));
                        }}
                        className="flex-1 studio-slider"
                      />
                      <span className="w-10 text-right font-mono-tabular text-white">
                        {layer.shadow?.blur ?? 20}px
                      </span>
                    </label>
                    <label className="flex items-center gap-2.5 text-xs text-slate-300">
                      <span className="w-12 shrink-0">Dist Y</span>
                      <input
                        type="range"
                        min={-40}
                        max={60}
                        step={1}
                        value={layer.shadow?.offsetY ?? 12}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onUpdateLayer(layer.id, (prev) => ({
                            ...prev,
                            shadow: {
                              enabled: true,
                              color: prev.shadow?.color ?? 'rgba(0,0,0,0.7)',
                              blur: prev.shadow?.blur ?? 20,
                              offsetX: prev.shadow?.offsetX ?? 0,
                              offsetY: val,
                            },
                          }));
                        }}
                        className="flex-1 studio-slider"
                      />
                      <span className="w-10 text-right font-mono-tabular text-white">
                        {layer.shadow?.offsetY ?? 12}px
                      </span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="w-12 flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => setBorderSubTab('stroke')}
                className={`flex-1 rounded-lg border flex items-center justify-center text-[10px] font-semibold cursor-pointer ${
                  borderSubTab === 'stroke'
                    ? 'bg-[#2B3044] border-[#2BE0A5] text-[#2BE0A5]'
                    : 'bg-[#222637] border-white/[0.06] text-slate-300'
                }`}
              >
                Stroke
              </button>
              <button
                onClick={() => setBorderSubTab('shadow')}
                className={`flex-1 rounded-lg border flex items-center justify-center text-[10px] font-semibold cursor-pointer ${
                  borderSubTab === 'shadow'
                    ? 'bg-[#2B3044] border-[#2BE0A5] text-[#2BE0A5]'
                    : 'bg-[#222637] border-white/[0.06] text-slate-300'
                }`}
              >
                Shadow
              </button>
            </div>
          </div>
        )}

        {/* 4. ENHANCED BLENDING & OPACITY (16 Modes, Quick Opacity Presets, Auto Fade In/Out, Mask Toggle) */}
        {activePanel === 'blending' && (
          <div className="space-y-2">
            {/* Opacity Slider + Quick Presets (Matching Alight Motion) */}
            <div className="bg-[#222637] rounded-lg px-3 py-2.5 border border-white/[0.06] space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-300 shrink-0">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(evaluated.opacity)}
                  onChange={(e) => updatePropValue('opacity', Number(e.target.value))}
                  className="flex-1 studio-slider"
                />
                <span className="px-2 py-0.5 rounded bg-[#161925] border border-white/10 text-xs font-mono-tabular text-[#2BE0A5] w-13 text-center shrink-0">
                  {Math.round(evaluated.opacity)}%
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => updatePropValue('opacity', pct)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular cursor-pointer ${
                        Math.round(evaluated.opacity) === pct
                          ? 'bg-[#2BE0A5] text-[#0E131D] font-bold'
                          : 'bg-[#161925] text-slate-300 hover:text-white'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                {/* Quick Auto Fade In/Out & Mask Alpha Role */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      onUpdateLayer(layer.id, (prev) => {
                        const hasFade = prev.effects.some((e) => e.type === 'fadeInOut');
                        if (hasFade) {
                          return {
                            ...prev,
                            effects: prev.effects.filter((e) => e.type !== 'fadeInOut'),
                          };
                        }
                        return {
                          ...prev,
                          effects: [...prev.effects, createEffectInstance('fadeInOut')],
                        };
                      });
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer border ${
                      fadeFx
                        ? 'bg-[#2BE0A5]/15 border-[#2BE0A5] text-[#2BE0A5]'
                        : 'bg-[#161925] border-white/10 text-slate-300'
                    }`}
                  >
                    Auto Fade {fadeFx ? 'ON' : 'OFF'}
                  </button>

                  <button
                    onClick={() =>
                      onUpdateLayer(layer.id, (prev) => ({
                        ...prev,
                        isMask: !prev.isMask,
                      }))
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer border ${
                      layer.isMask
                        ? 'bg-[#F2A833]/20 border-[#F2A833] text-[#F2A833]'
                        : 'bg-[#161925] border-white/10 text-slate-300'
                    }`}
                  >
                    {layer.isMask ? 'Mask Layer' : 'Normal Alpha'}
                  </button>
                </div>
              </div>

              {fadeFx && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 border-t border-white/[0.06]">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="w-14 shrink-0">Fade In</span>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={Number(fadeFx.params.fadeIn ?? 0.4)}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          effects: prev.effects.map((fx) =>
                            fx.id === fadeFx.id
                              ? { ...fx, params: { ...fx.params, fadeIn: val } }
                              : fx
                          ),
                        }));
                      }}
                      className="flex-1 studio-slider"
                    />
                    <span className="w-10 text-right font-mono-tabular text-[#2BE0A5]">
                      {Number(fadeFx.params.fadeIn ?? 0.4).toFixed(1)}s
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="w-14 shrink-0">Fade Out</span>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={Number(fadeFx.params.fadeOut ?? 0.4)}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          effects: prev.effects.map((fx) =>
                            fx.id === fadeFx.id
                              ? { ...fx, params: { ...fx.params, fadeOut: val } }
                              : fx
                          ),
                        }));
                      }}
                      className="flex-1 studio-slider"
                    />
                    <span className="w-10 text-right font-mono-tabular text-[#2BE0A5]">
                      {Number(fadeFx.params.fadeOut ?? 0.4).toFixed(1)}s
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Blend Categories */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {BLEND_CATEGORIES.map((group) => {
                const isOpen = expandedBlendGroup === group.category;
                const activeInGroup = group.modes.find(
                  (m) => m.value === layer.blendMode
                );
                return (
                  <div
                    key={group.category}
                    className="bg-[#222637] rounded-lg border border-white/[0.06] overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedBlendGroup(isOpen ? '' : group.category)
                      }
                      className="w-full px-3 py-1.5 flex items-center justify-between text-xs text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{group.category}</span>
                      </span>
                      {activeInGroup && (
                        <span className="text-[#2BE0A5] font-semibold">
                          {activeInGroup.label}
                        </span>
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-2.5 pb-2 flex flex-wrap gap-1">
                        {group.modes.map((m) => (
                          <button
                            key={m.value}
                            onClick={() =>
                              onUpdateLayer(layer.id, (prev) => ({
                                ...prev,
                                blendMode: m.value as BlendMode,
                              }))
                            }
                            className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                              layer.blendMode === m.value
                                ? 'bg-[#2BE0A5] text-[#0E131D] font-bold'
                                : 'bg-[#161925] text-slate-300 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. EFFECTS WITH COPY / PASTE / DUPLICATE / REORDER / CATEGORIES */}
        {activePanel === 'effects' && (
          <div className="space-y-2">
            {/* Effects Action Bar */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setShowEffectBrowser((v) => !v)}
                className="flex-1 min-w-[120px] h-9 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.08] text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#2BE0A5]" />
                <span>{showEffectBrowser ? 'Close Browser' : 'Add Effect'}</span>
              </button>

              {onOpenAIMode && (
                <button
                  onClick={() => onOpenAIMode('effects')}
                  title="AI Style & Effects Director"
                  className="h-9 px-2.5 rounded-lg bg-[#2BE0A5]/15 hover:bg-[#2BE0A5]/25 border border-[#2BE0A5]/40 text-xs font-semibold text-[#2BE0A5] flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI FX</span>
                </button>
              )}

              <button
                disabled={layer.effects.length === 0}
                onClick={() => {
                  onCopyEffects(layer.effects);
                  flashFeedback(`Copied ${layer.effects.length} effect(s)`);
                }}
                title="Copy All Effects from this layer"
                className="h-9 px-2.5 rounded-lg bg-[#24293B] hover:bg-[#2E344B] border border-white/[0.08] text-xs font-medium text-slate-200 disabled:opacity-35 flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#38B2CE]" />
                <span>Copy Effects</span>
              </button>

              <button
                disabled={copiedEffects.length === 0}
                onClick={() => {
                  onPasteEffects(layer.id);
                  flashFeedback(`Pasted ${copiedEffects.length} effect(s)`);
                }}
                title="Paste Copied Effects onto this layer"
                className="h-9 px-2.5 rounded-lg bg-[#2BE0A5]/15 hover:bg-[#2BE0A5]/25 border border-[#2BE0A5]/40 text-xs font-semibold text-[#2BE0A5] disabled:opacity-35 flex items-center gap-1 cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Paste ({copiedEffects.length})</span>
              </button>

              {layer.effects.length > 0 && (
                <button
                  onClick={() =>
                    onUpdateLayer(layer.id, (prev) => ({ ...prev, effects: [] }))
                  }
                  title="Clear All Effects"
                  className="h-9 px-2.5 rounded-lg bg-[#24293B] hover:bg-rose-500/20 border border-white/[0.08] text-xs text-rose-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {showEffectBrowser && (
              <div className="bg-[#161925] border border-white/10 rounded-lg p-2.5 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    value={effectSearch}
                    onChange={(e) => setEffectSearch(e.target.value)}
                    placeholder="Search 28+ effects (Drawing Progress, 3D Extrude, Count Up, RGB Split...)"
                    className="w-full bg-[#222637] rounded pl-8 pr-2.5 py-1.5 text-xs text-white outline-none border border-white/10 focus:border-[#2BE0A5]"
                  />
                </div>

                {/* Category Filter Chips matching Screenshot 2 */}
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {EFFECT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setEffectCategory(cat)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap cursor-pointer ${
                        effectCategory === cat
                          ? 'bg-[#2BE0A5] text-[#0E131D]'
                          : 'bg-[#222637] text-slate-300 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {EFFECT_CATALOG.filter((fx) => {
                    const catOk = effectCategory === 'All' || fx.category === effectCategory;
                    const q = effectSearch.toLowerCase();
                    const qOk =
                      !q ||
                      fx.name.toLowerCase().includes(q) ||
                      fx.category.toLowerCase().includes(q) ||
                      fx.description.toLowerCase().includes(q);
                    return catOk && qOk;
                  }).map((fx) => (
                    <button
                      key={fx.type}
                      onClick={() => {
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          effects: [...prev.effects, createEffectInstance(fx.type as EffectType)],
                        }));
                        setShowEffectBrowser(false);
                      }}
                      className="text-left px-2.5 py-2 rounded bg-[#222637] hover:bg-[#2B3044] border border-white/[0.05] cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-white truncate">
                          {fx.name}
                        </span>
                        <span className="text-[10px] text-[#2BE0A5] shrink-0">
                          {fx.category}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {fx.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {layer.effects.map((fx, fxIdx) => (
              <div
                key={fx.id}
                className="bg-[#222637] rounded-lg p-2.5 border border-white/[0.07] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white truncate">
                    {fx.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        onCopyEffects([fx]);
                        flashFeedback(`Copied ${fx.name}`);
                      }}
                      title="Copy Effect"
                      className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-[#38B2CE] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          effects: [
                            ...prev.effects,
                            {
                              ...fx,
                              id: `fx_${Math.random().toString(36).slice(2, 9)}`,
                              params: { ...fx.params },
                            },
                          ],
                        }))
                      }
                      title="Duplicate Effect"
                      className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                    >
                      <CopyPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={fxIdx === 0}
                      onClick={() =>
                        onUpdateLayer(layer.id, (prev) => {
                          const arr = [...prev.effects];
                          [arr[fxIdx - 1], arr[fxIdx]] = [arr[fxIdx], arr[fxIdx - 1]];
                          return { ...prev, effects: arr };
                        })
                      }
                      title="Move Up"
                      className="p-1 rounded hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      disabled={fxIdx === layer.effects.length - 1}
                      onClick={() =>
                        onUpdateLayer(layer.id, (prev) => {
                          const arr = [...prev.effects];
                          [arr[fxIdx], arr[fxIdx + 1]] = [arr[fxIdx + 1], arr[fxIdx]];
                          return { ...prev, effects: arr };
                        })
                      }
                      title="Move Down"
                      className="p-1 rounded hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        const fresh = createEffectInstance(fx.type);
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          effects: prev.effects.map((item) =>
                            item.id === fx.id ? { ...item, params: fresh.params } : item
                          ),
                        }));
                      }}
                      title="Reset Parameters"
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          effects: prev.effects.map((item) =>
                            item.id === fx.id ? { ...item, enabled: !item.enabled } : item
                          ),
                        }))
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        fx.enabled ? 'bg-[#2BE0A5] text-[#0E131D]' : 'bg-[#161925] text-slate-400'
                      }`}
                    >
                      {fx.enabled ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          effects: prev.effects.filter((item) => item.id !== fx.id),
                        }))
                      }
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(fx.params).map(([k, v]) =>
                    typeof v === 'string' ? (
                      <label key={k} className="flex items-center justify-between text-xs text-slate-300">
                        <span className="capitalize">{k}</span>
                        <input
                          type="color"
                          value={v}
                          onChange={(e) =>
                            onUpdateLayer(layer.id, (prev) => ({
                              ...prev,
                              effects: prev.effects.map((item) =>
                                item.id === fx.id
                                  ? { ...item, params: { ...item.params, [k]: e.target.value } }
                                  : item
                              ),
                            }))
                          }
                          className="w-7 h-6 bg-transparent border-0 cursor-pointer"
                        />
                      </label>
                    ) : (
                      <AlightRulerControl
                        key={k}
                        label={k}
                        min={k === 'offsetX' || k === 'offsetY' || k === 'from' ? -200 : 0}
                        max={
                          k === 'hue' || k === 'angle' || k === 'spread'
                            ? 360
                            : k === 'strength'
                              ? 1
                              : k === 'frequency' || k === 'speed' || k === 'intensity'
                                ? 15
                                : k === 'count'
                                  ? 24
                                  : k === 'radius' || k === 'to' || k === 'end' || k === 'start' || k === 'amount' || k === 'brightness' || k === 'contrast' || k === 'saturation'
                                    ? 200
                                    : 150
                        }
                        step={k === 'strength' || k === 'frequency' || k === 'fadeIn' || k === 'fadeOut' ? 0.1 : 1}
                        value={v}
                        onChange={(val) =>
                          onUpdateLayer(layer.id, (prev) => ({
                            ...prev,
                            effects: prev.effects.map((item) =>
                              item.id === fx.id
                                ? {
                                    ...item,
                                    params: { ...item.params, [k]: val },
                                  }
                                : item
                            ),
                          }))
                        }
                      />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 6. PRESETS BROWSER + CUSTOM PRESETS + XML PRESET IMPORT/EXPORT */}
        {activePanel === 'presets' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {(['All', 'Motion', 'Style', 'Text', 'Custom'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setPresetCategory(cat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      presetCategory === cat
                        ? 'bg-[#2BE0A5] text-[#0E131D]'
                        : 'bg-[#222637] text-slate-300 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    onSaveCustomPreset(layer);
                    flashFeedback('Saved as Custom Preset');
                  }}
                  className="px-2.5 py-1 rounded bg-[#2BE0A5]/15 border border-[#2BE0A5]/40 text-[#2BE0A5] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Save Preset</span>
                </button>
                <button
                  onClick={() => onExportLayerXML(layer)}
                  className="px-2.5 py-1 rounded bg-[#222637] hover:bg-[#2B3044] border border-white/10 text-slate-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#F2A833]" />
                  <span>XML</span>
                </button>
                <label className="px-2.5 py-1 rounded bg-[#222637] hover:bg-[#2B3044] border border-white/10 text-slate-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#38B2CE]" />
                  <span>Import XML</span>
                  <input
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImportPresetXML(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {[...customPresets, ...LAYER_PRESET_CATALOG]
                .filter((p) => presetCategory === 'All' || p.category === presetCategory)
                .map((preset) => (
                  <div
                    key={preset.id}
                    className="bg-[#222637] hover:bg-[#2B3044] border border-white/[0.07] rounded-lg p-2.5 flex items-center justify-between gap-2"
                  >
                    <button
                      onClick={() => {
                        onApplyPreset(layer.id, preset);
                        flashFeedback(`Applied "${preset.name}"`);
                      }}
                      className="flex-1 text-left cursor-pointer min-w-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {preset.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#161925] text-[#2BE0A5] shrink-0">
                          {preset.category}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {preset.description}
                      </div>
                    </button>
                    {preset.category === 'Custom' && (
                      <button
                        onClick={() => onDeleteCustomPreset(preset.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer shrink-0"
                        title="Delete Custom Preset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 7. EDIT SHAPE / EDIT TEXT */}
        {activePanel === 'editShape' && (
          <div className="space-y-2.5">
            {layer.type === 'text' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <textarea
                  rows={3}
                  value={layer.text || ''}
                  onChange={(e) =>
                    onUpdateLayer(layer.id, (prev) => ({ ...prev, text: e.target.value }))
                  }
                  className="bg-[#222637] border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#2BE0A5]"
                />
                <div className="space-y-2">
                  <select
                    value={layer.fontFamily || 'Outfit'}
                    onChange={(e) =>
                      onUpdateLayer(layer.id, (prev) => ({ ...prev, fontFamily: e.target.value }))
                    }
                    className="w-full bg-[#222637] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="Outfit">Outfit</option>
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="Oswald">Oswald</option>
                    <option value="Archivo">Archivo</option>
                    <option value="Playfair Display">Playfair Display</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="bg-[#222637] rounded px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between text-xs">
                      <span className="text-slate-400">Size</span>
                      <input
                        type="number"
                        value={layer.fontSize ?? 64}
                        onChange={(e) =>
                          onUpdateLayer(layer.id, (prev) => ({
                            ...prev,
                            fontSize: Number(e.target.value),
                          }))
                        }
                        className="w-14 bg-transparent text-right font-mono-tabular text-white outline-none"
                      />
                    </label>
                    <label className="bg-[#222637] rounded px-2.5 py-1.5 border border-white/[0.06] flex items-center justify-between text-xs">
                      <span className="text-slate-400">Track</span>
                      <input
                        type="number"
                        value={layer.letterSpacing ?? 0}
                        onChange={(e) =>
                          onUpdateLayer(layer.id, (prev) => ({
                            ...prev,
                            letterSpacing: Number(e.target.value),
                          }))
                        }
                        className="w-14 bg-transparent text-right font-mono-tabular text-white outline-none"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => setShapeSizeLinked((v) => !v)}
                    title="Link Width & Height"
                    className={`h-9 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer ${
                      shapeSizeLinked
                        ? 'bg-[#2BE0A5]/20 border-[#2BE0A5] text-[#2BE0A5]'
                        : 'bg-[#222637] border-white/[0.06] text-slate-400'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Link</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <AlightRulerControl
                      label={shapeSizeLinked ? 'Size (W & H)' : 'Width (X)'}
                      min={20}
                      max={1400}
                      step={1}
                      unit="px"
                      value={layer.width ?? 240}
                      onChange={(val) =>
                        onUpdateLayer(layer.id, (prev) => ({
                          ...prev,
                          width: val,
                          height: shapeSizeLinked ? val : prev.height,
                        }))
                      }
                    />
                  </div>
                </div>

                {!shapeSizeLinked && (
                  <AlightRulerControl
                    label="Height (Y)"
                    min={20}
                    max={1400}
                    step={1}
                    unit="px"
                    accentColor="#38B2CE"
                    value={layer.height ?? 240}
                    onChange={(val) =>
                      onUpdateLayer(layer.id, (prev) => ({
                        ...prev,
                        height: val,
                      }))
                    }
                  />
                )}

                {layer.type === 'shape' && (
                  <div className="flex flex-wrap gap-1.5">
                    {SHAPE_CATALOG.map((sc) => (
                      <button
                        key={sc.kind}
                        onClick={() =>
                          onUpdateLayer(layer.id, (prev) => ({
                            ...prev,
                            shapeKind: sc.kind,
                          }))
                        }
                        className={`px-2.5 py-1 rounded text-[11px] border cursor-pointer ${
                          layer.shapeKind === sc.kind
                            ? 'bg-[#2BE0A5]/20 border-[#2BE0A5] text-[#2BE0A5]'
                            : 'bg-[#222637] border-white/[0.06] text-slate-300'
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 8. EASING CURVE GRAPH (Fixed height + Playhead sync + Copy/Paste Curve) */}
        {activePanel === 'easing' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 overflow-x-auto">
                {(
                  [
                    ['x', 'Pos X'],
                    ['y', 'Pos Y'],
                    ['scaleX', 'Scale X'],
                    ['scaleY', 'Scale Y'],
                    ['rotation', 'Rot Z'],
                    ['rotateX', 'Rot X'],
                    ['rotateY', 'Rot Y'],
                    ['opacity', 'Opacity'],
                  ] as Array<[NumericAnimatableProp, string]>
                ).map(([prop, label]) => {
                  const count = layer.keyframes[prop]?.length ?? 0;
                  const active = easingProp === prop;
                  return (
                    <button
                      key={prop}
                      onClick={() => {
                        setEasingProp(prop);
                        setSelectedKfIdx(0);
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                        active
                          ? 'bg-[#2BE0A5] text-[#0E131D] font-bold'
                          : count >= 2
                            ? 'bg-[#24293B] text-slate-100 border border-[#2BE0A5]/40'
                            : 'bg-[#161925] text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{label}</span>
                      {count > 0 && (
                        <span className="font-mono-tabular text-[9px] opacity-80">
                          ({count})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {propKfs.slice(0, -1).map((kf, idx) => (
                  <button
                    key={kf.id}
                    onClick={() => {
                      setSelectedKfIdx(idx);
                      onSeek((kf.time + propKfs[idx + 1].time) / 2);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular cursor-pointer ${
                      clampedPairIdx === idx
                        ? 'bg-[#38B2CE] text-[#0E131D] font-bold'
                        : 'bg-[#222637] text-slate-300'
                    }`}
                  >
                    {kf.time.toFixed(1)}s→{propKfs[idx + 1].time.toFixed(1)}s
                  </button>
                ))}

                {onQuickAISmoothLayer && (
                  <button
                    onClick={runQuickAISmooth}
                    disabled={isSmoothingQuick}
                    title="1-Click AI Smooth Keyframes"
                    className="px-2 py-0.5 rounded bg-[#38B2CE]/20 hover:bg-[#38B2CE]/30 border border-[#38B2CE]/50 text-[#38B2CE] text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isSmoothingQuick ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Waves className="w-3 h-3" />
                    )}
                    <span>AI Smooth</span>
                  </button>
                )}

                {onOpenAIMode && (
                  <button
                    onClick={() => onOpenAIMode('smooth')}
                    title="Open Full AI Smoothing Profiles"
                    className="px-1.5 py-0.5 rounded bg-[#222637] hover:bg-[#2B3044] border border-white/10 text-slate-300 text-[10px] font-semibold cursor-pointer"
                  >
                    Profiles
                  </button>
                )}
              </div>
            </div>

            {propKfs.length >= 2 && activeKfForEasing ? (
              <EasingGraphEditor
                curve={activeKfForEasing.easing}
                playheadProgress={playheadProgress}
                copiedCurve={copiedCurve}
                onCopyCurve={onCopyCurve}
                onChange={handleEasingChange}
              />
            ) : (
              <div className="bg-[#222637] rounded-lg p-3 border border-white/[0.06] flex items-center justify-between gap-3">
                <span className="text-xs text-slate-300">
                  Add 2 keyframes on <strong>{easingProp}</strong> to shape the bezier easing curve.
                </span>
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
                      const delta = easingProp.startsWith('scale')
                        ? 0.25
                        : easingProp.startsWith('rot')
                          ? 45
                          : easingProp === 'opacity'
                            ? -50
                            : 120;
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
                  className="px-3 py-1.5 rounded bg-[#2BE0A5] text-[#0E131D] text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Create Curve
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
