import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Clapperboard,
  CopyPlus,
  FlipHorizontal2,
  FlipVertical2,
  FolderPlus,
  Layers,
  Maximize2,
  MonitorPlay,
  MoreVertical,
  Plus,
  Redo2,
  RotateCcw,
  Scan,
  Settings,
  Share,
  Sparkles,
  Trash2,
  Type as TypeIcon,
  Undo2,
  Ungroup,
  Video,
  Wand2,
} from 'lucide-react';
import { Layer, ProjectConfig } from '../types/editor';
import { BottomDockPanel } from './BottomControlDock';
import { AIMotionMode } from './AIMotionModal';

interface TopBarProps {
  project: ProjectConfig;
  canUndo: boolean;
  canRedo: boolean;
  selectedLayers: Layer[];
  activeBottomPanel: BottomDockPanel;
  onBackClick: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRenameProject: (name: string) => void;
  onOpenNewProject: () => void;
  onOpenSettings: () => void;
  onOpenPreview: () => void;
  onOpenAI: () => void;
  onOpenAIMode?: (mode: AIMotionMode) => void;
  onOpenExport: () => void;
  onDeleteSelected: () => void;
  // Three-dot menu actions
  onFillComposition: () => void;
  onFitComposition: () => void;
  onCenterStage: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onResetTransform: () => void;
  onMaskSelected: () => void;
  onGroupSelected: () => void;
  onGroupAndMaskSelected: () => void;
  onUngroupSelected: () => void;
  onDuplicateSelected: () => void;
  copiedEffectsCount?: number;
  onCopyEffects?: () => void;
  onPasteEffects?: () => void;
}

const PANEL_TITLES: Record<BottomDockPanel, string> = {
  menu: '',
  color: 'Color & Fill',
  border: 'Border & Shadow',
  blending: 'Blending & Opacity',
  transform: 'Move & Transform',
  editShape: 'Edit Shape',
  presets: 'Presets',
  effects: 'Effects',
  easing: 'Easing Curve',
};

export const TopBar: React.FC<TopBarProps> = ({
  project,
  canUndo,
  canRedo,
  selectedLayers,
  activeBottomPanel,
  onBackClick,
  onUndo,
  onRedo,
  onRenameProject,
  onOpenNewProject,
  onOpenSettings,
  onOpenPreview,
  onOpenAI,
  onOpenAIMode,
  onOpenExport,
  onDeleteSelected,
  onFillComposition,
  onFitComposition,
  onCenterStage,
  onFlipHorizontal,
  onFlipVertical,
  onResetTransform,
  onMaskSelected,
  onGroupSelected,
  onGroupAndMaskSelected,
  onUngroupSelected,
  onDuplicateSelected,
  copiedEffectsCount = 0,
  onCopyEffects,
  onPasteEffects,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onOutside);
    return () => window.removeEventListener('pointerdown', onOutside);
  }, [menuOpen]);

  const commitName = () => {
    setEditingTitle(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== project.name) {
      onRenameProject(trimmed);
    } else {
      setDraftName(project.name);
    }
  };

  const hasSelection = selectedLayers.length > 0;
  const hasMultiSelection = selectedLayers.length >= 2;
  const singleLayer = selectedLayers.length === 1 ? selectedLayers[0] : null;
  const hasSelectedGroup = singleLayer?.type === 'group';

  const contextLabel = singleLayer
    ? activeBottomPanel !== 'menu'
      ? activeBottomPanel === 'editShape' && singleLayer.type === 'text'
        ? 'Edit Text'
        : PANEL_TITLES[activeBottomPanel]
      : singleLayer.name
    : null;

  const runAction = (fn: () => void) => {
    fn();
    setMenuOpen(false);
  };

  return (
    <header className="h-12 bg-[#161925] border-b border-white/[0.08] px-2 sm:px-3 flex items-center justify-between gap-1.5 sm:gap-3 shrink-0 z-30">
      {/* Left: Back (Home / Deselect / Back to Layer Menu) + Title */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <button
          onClick={onBackClick}
          title={
            singleLayer
              ? activeBottomPanel !== 'menu'
                ? 'Back to Layer Controls'
                : 'Done Editing Layer'
              : 'Back to Home Screen'
          }
          className="h-8 px-1.5 sm:px-2 rounded-md flex items-center gap-1.5 text-slate-200 hover:text-white hover:bg-white/[0.06] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {!singleLayer && (
            <span className="text-xs font-medium hidden sm:inline">Home</span>
          )}
        </button>

        <div className="h-4 w-px bg-white/10 shrink-0" />

        {contextLabel ? (
          <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[115px] sm:max-w-[200px]">
            {contextLabel}
          </span>
        ) : editingTitle ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setDraftName(project.name);
                setEditingTitle(false);
              }
            }}
            className="bg-[#23283A] border border-[#2BE0A5]/60 rounded px-2 py-0.5 text-xs sm:text-sm font-semibold text-white outline-none w-32 sm:w-44"
          />
        ) : (
          <button
            onClick={() => {
              setDraftName(project.name);
              setEditingTitle(true);
            }}
            className="text-xs sm:text-sm font-semibold text-white hover:text-[#2BE0A5] transition-colors truncate max-w-[110px] sm:max-w-[180px] cursor-pointer"
            title="Click to rename project"
          >
            {project.name}
          </button>
        )}

        {!singleLayer && (
          <span className="text-xs text-slate-400 font-mono-tabular hidden xl:inline whitespace-nowrap">
            {project.aspectRatio} · {project.fps}fps · {project.width}×{project.height}
          </span>
        )}
      </div>

      {/* Center: Quick Undo/Redo + New */}
      <div className="hidden lg:flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenNewProject}
          title="Create New Project"
          className="h-8 px-2.5 ml-1 rounded-md flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
      </div>

      {/* Right: Contextual Layer Delete (when layer selected) + Preview + AI Motion + Settings + Three-Dot + Export */}
      <div className="flex items-center gap-1.5 shrink-0">
        {singleLayer && (
          <button
            onClick={onDeleteSelected}
            title="Delete Selected Layer"
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpenPreview}
          title="Full-Screen Preview Player"
          className="h-8 px-2.5 rounded-md bg-white/[0.07] hover:bg-white/[0.13] text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <MonitorPlay className="w-3.5 h-3.5 text-[#2BE0A5]" />
          <span className="hidden sm:inline">Preview</span>
        </button>

        <button
          onClick={onOpenAI}
          className="h-8 px-2.5 rounded-md bg-[#2BE0A5]/15 border border-[#2BE0A5]/40 text-[#2BE0A5] hover:bg-[#2BE0A5]/25 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI Motion</span>
        </button>

        <button
          onClick={onOpenSettings}
          title="Project Settings"
          className="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Three-Dot Menu right beside Settings */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            title="Layer & Composition Options"
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              menuOpen
                ? 'bg-[#2BE0A5]/20 text-[#2BE0A5]'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-60 bg-[#1E2231] border border-white/12 rounded-xl shadow-2xl py-1.5 z-50 text-xs">
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400">
                Composition &amp; Framing
              </div>
              <button
                disabled={!hasSelection}
                onClick={() => runAction(onFillComposition)}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Fill Composition Area</span>
              </button>
              <button
                disabled={!hasSelection}
                onClick={() => runAction(onFitComposition)}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Fit to Composition Area</span>
              </button>
              <button
                disabled={!hasSelection}
                onClick={() => runAction(onCenterStage)}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Center on Stage</span>
              </button>

              <div className="my-1 border-t border-white/[0.08]" />
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400">
                Grouping &amp; Masking
              </div>

              <button
                disabled={!hasSelection}
                onClick={() => runAction(onMaskSelected)}
                className="w-full px-3 py-2 flex items-center justify-between text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Mask</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {hasMultiSelection ? 'Clip Pair' : 'Toggle'}
                </span>
              </button>

              <button
                disabled={!hasMultiSelection}
                onClick={() => runAction(onGroupSelected)}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Group</span>
              </button>

              <button
                disabled={!hasMultiSelection}
                onClick={() => runAction(onGroupAndMaskSelected)}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#F2A833]" />
                <span>Group &amp; Mask</span>
              </button>

              {hasSelectedGroup && (
                <button
                  onClick={() => runAction(onUngroupSelected)}
                  className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] cursor-pointer"
                >
                  <Ungroup className="w-3.5 h-3.5" />
                  <span>Ungroup</span>
                </button>
              )}

              <div className="my-1 border-t border-white/[0.08]" />
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400">
                Transform &amp; Layer
              </div>

              <button
                disabled={!hasSelection}
                onClick={() => runAction(onFlipHorizontal)}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-white/[0.07] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                <span>Flip Horizontal</span>
              </button>
              <button
                disabled={!hasSelection}
                onClick={() => runAction(onFlipVertical)}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-white/[0.07] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <FlipVertical2 className="w-3.5 h-3.5" />
                <span>Flip Vertical</span>
              </button>
              <button
                disabled={!hasSelection}
                onClick={() => runAction(onDuplicateSelected)}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-white/[0.07] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <CopyPlus className="w-3.5 h-3.5" />
                <span>Duplicate Layer</span>
              </button>
              {onCopyEffects && (
                <button
                  disabled={!singleLayer || singleLayer.effects.length === 0}
                  onClick={() => runAction(onCopyEffects)}
                  className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-white/[0.07] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-[#2BE0A5]" />
                  <span>Copy Effects</span>
                </button>
              )}
              {onPasteEffects && (
                <button
                  disabled={!hasSelection || copiedEffectsCount === 0}
                  onClick={() => runAction(onPasteEffects)}
                  className="w-full px-3 py-2 flex items-center justify-between text-left text-slate-200 hover:bg-white/[0.07] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#2BE0A5]" />
                    <span>Paste Effects</span>
                  </span>
                  {copiedEffectsCount > 0 && (
                    <span className="text-[10px] text-[#2BE0A5] font-mono-tabular">
                      {copiedEffectsCount}
                    </span>
                  )}
                </button>
              )}
              <button
                disabled={!hasSelection}
                onClick={() => runAction(onResetTransform)}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-white/[0.07] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Transform</span>
              </button>

              {onOpenAIMode && (
                <>
                  <div className="my-1 border-t border-white/[0.08]" />
                  <div className="px-3 py-1 text-[10px] font-semibold text-[#2BE0A5]">
                    AI Studio Choreography
                  </div>
                  <button
                    onClick={() => runAction(() => onOpenAIMode('smooth'))}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#38B2CE]/15 hover:text-[#38B2CE] cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-[#38B2CE]" />
                    <span>AI Motion Smoothing</span>
                  </button>
                  <button
                    onClick={() => runAction(() => onOpenAIMode('camera'))}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#F2A833]/15 hover:text-[#F2A833] cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5 text-[#F2A833]" />
                    <span>AI Auto-Camera &amp; Beats</span>
                  </button>
                  <button
                    disabled={!hasSelection}
                    onClick={() => runAction(() => onOpenAIMode('effects'))}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-[#2BE0A5]" />
                    <span>AI Style &amp; Effects</span>
                  </button>
                  <button
                    onClick={() => runAction(() => onOpenAIMode('typography'))}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#2BE0A5]/15 hover:text-[#2BE0A5] cursor-pointer"
                  >
                    <TypeIcon className="w-3.5 h-3.5 text-[#2BE0A5]" />
                    <span>AI Kinetic Typography</span>
                  </button>
                  <button
                    onClick={() => runAction(() => onOpenAIMode('trailer'))}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-slate-200 hover:bg-[#F2A833]/15 hover:text-[#F2A833] cursor-pointer"
                  >
                    <Clapperboard className="w-3.5 h-3.5 text-[#F2A833]" />
                    <span>AI Motion Trailer</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onOpenExport}
          title="Export Video / Project"
          className="h-8 px-3 rounded-md bg-[#2BE0A5] hover:bg-[#24C992] text-[#0E131D] text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Share className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
