import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Flag,
  Grid3X3,
  Pause,
  Play,
  Plus,
  Redo2,
  Repeat,
  Scissors,
  SkipBack,
  SkipForward,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { formatTimecode } from '../engine/easing';

interface TransportBarProps {
  isPlaying: boolean;
  isLooping: boolean;
  currentTime: number;
  duration: number;
  fps: number;
  showGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasSelectedLayer: boolean;
  selectedCount: number;
  canSplitAtPlayhead: boolean;
  pxPerSec: number;
  onChangeZoom: (nextPxPerSec: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onToggleGrid: () => void;
  onPrevKeyframe: () => void;
  onNextKeyframe: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicateSelected: () => void;
  onToggleBeatMarker: () => void;
  onOpenAddDrawer: () => void;
  // Moved up from Timeline bottom so Timeline stays super clean
  onTrimLeft: () => void;
  onSplitAtPlayhead: () => void;
  onTrimRight: () => void;
  onMoveLayerUp: () => void;
  onMoveLayerDown: () => void;
  onDeleteSelected: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  isLooping,
  currentTime,
  duration,
  fps,
  showGrid,
  canUndo,
  canRedo,
  hasSelectedLayer,
  selectedCount,
  canSplitAtPlayhead,
  pxPerSec,
  onChangeZoom,
  onTogglePlay,
  onToggleLoop,
  onToggleGrid,
  onPrevKeyframe,
  onNextKeyframe,
  onUndo,
  onRedo,
  onDuplicateSelected,
  onToggleBeatMarker,
  onOpenAddDrawer,
  onTrimLeft,
  onSplitAtPlayhead,
  onTrimRight,
  onMoveLayerUp,
  onMoveLayerDown,
  onDeleteSelected,
}) => {
  const zoomPct = Math.round((pxPerSec / 96) * 100);

  return (
    <div className="bg-[#1A1E2B] border-y border-white/[0.08] shrink-0">
      {/* Row 1: Transport Playback + Undo/Redo + Timecode + Add */}
      <div className="h-10 px-2 sm:px-3 flex items-center justify-between gap-1.5 overflow-x-auto">
        {/* Left: Undo / Redo / Beat */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="w-8 h-8 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="w-8 h-8 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleBeatMarker}
            title="Toggle Beat Marker at Playhead"
            className="h-8 px-1.5 sm:px-2 rounded flex items-center gap-1 text-xs text-slate-300 hover:text-[#E84A6F] hover:bg-white/[0.05] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Beat</span>
          </button>
        </div>

        {/* Center: Play / Pause / Keyframe Jump / Timecode */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onPrevKeyframe}
            title="Previous Keyframe / Start"
            className="w-8 h-8 rounded flex items-center justify-center text-slate-200 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className={`w-9 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              isPlaying
                ? 'bg-[#2BE0A5] text-[#0E131D]'
                : 'bg-white/[0.1] text-white hover:bg-white/[0.16]'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onToggleLoop}
            title="Toggle Loop Playback"
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors cursor-pointer ${
              isLooping
                ? 'text-[#2BE0A5] bg-[#2BE0A5]/15'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Repeat className="w-4 h-4" />
          </button>

          <button
            onClick={onNextKeyframe}
            title="Next Keyframe / End"
            className="w-8 h-8 rounded flex items-center justify-center text-slate-200 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <div className="ml-1 px-2 py-1 rounded bg-[#12151E] border border-white/[0.07] font-mono-tabular text-[11px] sm:text-xs text-slate-200 whitespace-nowrap">
            {formatTimecode(currentTime, fps)}
            <span className="text-slate-500 hidden sm:inline ml-1">
              / {formatTimecode(duration, fps)}
            </span>
          </div>
        </div>

        {/* Right: Grid + Duplicate + Add Layer */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleGrid}
            title="Toggle Safe Grid"
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors cursor-pointer ${
              showGrid
                ? 'text-[#2BE0A5] bg-[#2BE0A5]/15'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenAddDrawer}
            className="h-8 px-2.5 sm:px-3 rounded-full bg-[#2BE0A5] hover:bg-[#23C790] text-[#0E131D] text-xs font-bold flex items-center gap-1 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden xs:inline sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* Row 2: Trim Left | Split/Cut | Trim Right | Track Up/Down | Duplicate | Delete | Timeline Zoom */}
      <div className="h-9 px-2 sm:px-3 border-t border-white/[0.06] bg-[#161925] flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onTrimLeft}
            disabled={!hasSelectedLayer}
            title="Trim Layer Start to Playhead"
            className="h-7 px-2 rounded bg-[#222637] hover:bg-[#2C3147] text-xs font-medium text-slate-200 disabled:opacity-30 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="font-mono-tabular text-[11px] text-[#38B2CE]">|&lt;</span>
            <span className="hidden sm:inline">Trim L</span>
          </button>

          <button
            onClick={onSplitAtPlayhead}
            disabled={!canSplitAtPlayhead}
            title="Split Layer at Playhead"
            className="h-7 px-2.5 rounded bg-[#222637] hover:bg-[#2BE0A5]/20 hover:text-[#2BE0A5] border border-white/[0.06] text-xs font-semibold text-white disabled:opacity-30 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5 text-[#2BE0A5]" />
            <span>Split</span>
          </button>

          <button
            onClick={onTrimRight}
            disabled={!hasSelectedLayer}
            title="Trim Layer End to Playhead"
            className="h-7 px-2 rounded bg-[#222637] hover:bg-[#2C3147] text-xs font-medium text-slate-200 disabled:opacity-30 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="hidden sm:inline">Trim R</span>
            <span className="font-mono-tabular text-[11px] text-[#38B2CE]">&gt;|</span>
          </button>

          <div className="h-4 w-px bg-white/10 mx-0.5 shrink-0" />

          <button
            onClick={onMoveLayerUp}
            disabled={selectedCount !== 1}
            title="Move Layer Up"
            className="w-7 h-7 rounded bg-[#222637] hover:bg-[#2C3147] text-slate-200 disabled:opacity-30 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveLayerDown}
            disabled={selectedCount !== 1}
            title="Move Layer Down"
            className="w-7 h-7 rounded bg-[#222637] hover:bg-[#2C3147] text-slate-200 disabled:opacity-30 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onDuplicateSelected}
            disabled={!hasSelectedLayer}
            title="Duplicate Layer"
            className="w-7 h-7 rounded bg-[#222637] hover:bg-[#2C3147] text-slate-200 disabled:opacity-30 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <CopyPlus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onDeleteSelected}
            disabled={!hasSelectedLayer}
            title="Delete Selected Layer(s)"
            className="w-7 h-7 rounded bg-[#222637] hover:bg-rose-500/20 text-rose-400 disabled:opacity-30 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Alight-style Timeline Zoom Stepper */}
        <div className="flex items-center gap-1 shrink-0 bg-[#12151E] border border-white/[0.07] rounded-lg px-1.5 py-0.5">
          <button
            onClick={() => onChangeZoom(Math.max(40, pxPerSec - 24))}
            title="Zoom Out Timeline"
            className="w-6 h-6 rounded hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeZoom(96)}
            title="Reset Timeline Zoom"
            className="px-1.5 text-[10px] font-mono-tabular text-[#2BE0A5] cursor-pointer whitespace-nowrap"
          >
            {zoomPct}%
          </button>
          <button
            onClick={() => onChangeZoom(Math.min(260, pxPerSec + 24))}
            title="Zoom In Timeline"
            className="w-6 h-6 rounded hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
