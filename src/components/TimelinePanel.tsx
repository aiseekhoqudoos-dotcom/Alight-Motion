import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  Eye,
  EyeOff,
  Folder,
  GripVertical,
  Layers,
  Link2,
  Music,
  Plus,
  Shapes,
  SquareSlash,
  Type,
  X,
} from 'lucide-react';
import { Layer, ProjectConfig } from '../types/editor';
import { formatTimecode, getLayerKeyframeTimes } from '../engine/easing';

interface TimelinePanelProps {
  project: ProjectConfig;
  layers: Layer[];
  currentTime: number;
  selectedLayerIds: string[];
  selectionMode: boolean;
  pxPerSec: number;
  compact?: boolean;
  onSeek: (time: number) => void;
  onSelectLayer: (layerId: string, multi?: boolean) => void;
  onEnsureLayerSelected: (layerId: string) => void;
  onEnterSelectionMode: () => void;
  onExitSelectionMode: () => void;
  onToggleVisibility: (layerId: string) => void;
  onUpdateLayerTiming: (layerId: string, startTime: number, endTime: number) => void;
  onReorderLayer: (fromIndex: number, toIndex: number) => void;
  onOpenAddDrawer?: () => void;
}

const ROW_HEIGHT = 40;

function getLayerTrackColors(layer: Layer): {
  bg: string;
  border: string;
  text: string;
} {
  if (layer.isMask) {
    return {
      bg: 'bg-[#46516E]',
      border: 'border-[#F2A833]',
      text: 'text-white',
    };
  }
  switch (layer.type) {
    case 'shape':
    case 'vector':
    case 'freehand':
      return {
        bg: 'bg-[#36A8C4]',
        border: 'border-[#5CD2EE]',
        text: 'text-[#0B1620]',
      };
    case 'text':
      return {
        bg: 'bg-[#F2A833]',
        border: 'border-[#FFD076]',
        text: 'text-[#1E1404]',
      };
    case 'null':
      return {
        bg: 'bg-[#B9C1D6]',
        border: 'border-[#DCE2F2]',
        text: 'text-[#151A26]',
      };
    case 'camera':
      return {
        bg: 'bg-[#2BE0A5]',
        border: 'border-[#7DF3CC]',
        text: 'text-[#0A1A14]',
      };
    case 'group':
      return {
        bg: layer.maskMode === 'clip' ? 'bg-[#E59524]' : 'bg-[#34C696]',
        border: layer.maskMode === 'clip' ? 'border-[#FFD076]' : 'border-[#6BE4BC]',
        text: 'text-[#0A1A14]',
      };
    case 'media':
      return {
        bg: 'bg-[#8679E6]',
        border: 'border-[#B2A9F5]',
        text: 'text-white',
      };
    case 'audio':
      return {
        bg: 'bg-[#E86F68]',
        border: 'border-[#F7A39E]',
        text: 'text-[#1F0A09]',
      };
  }
}

function getLayerSmallIcon(layer: Layer) {
  if (layer.isMask) return <Layers className="w-3.5 h-3.5 text-[#F2A833]" />;
  switch (layer.type) {
    case 'camera':
      return <Camera className="w-3.5 h-3.5 text-[#2BE0A5]" />;
    case 'text':
      return <Type className="w-3.5 h-3.5 text-[#F2A833]" />;
    case 'null':
      return <SquareSlash className="w-3.5 h-3.5 text-slate-300" />;
    case 'group':
      return (
        <Folder
          className={`w-3.5 h-3.5 ${
            layer.maskMode === 'clip' ? 'text-[#F2A833]' : 'text-[#2BE0A5]'
          }`}
        />
      );
    case 'audio':
      return <Music className="w-3.5 h-3.5 text-[#E86F68]" />;
    default:
      return <Shapes className="w-3.5 h-3.5 text-[#38B2CE]" />;
  }
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  project,
  layers,
  currentTime,
  selectedLayerIds,
  selectionMode,
  pxPerSec,
  compact = false,
  onSeek,
  onSelectLayer,
  onEnsureLayerSelected,
  onEnterSelectionMode,
  onExitSelectionMode,
  onToggleVisibility,
  onUpdateLayerTiming,
  onReorderLayer,
  onOpenAddDrawer,
}) => {
  const [draggingRowIdx, setDraggingRowIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

  const trackScrollRef = useRef<HTMLDivElement | null>(null);
  const leftListRef = useRef<HTMLDivElement | null>(null);
  const trackRowsRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const longPressTimerRef = useRef<number | null>(null);
  const pendingPressRef = useRef<{
    layerId: string;
    index: number;
    startClientX: number;
    startClientY: number;
    triggered: boolean;
  } | null>(null);

  const dragBarRef = useRef<{
    layerId: string;
    mode: 'move' | 'trim-left' | 'trim-right';
    startClientX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const timelineWidth = Math.max(600, project.duration * pxPerSec + 120);

  const clientXToTime = (clientX: number): number => {
    const el = trackScrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    return Math.max(0, Math.min(project.duration, x / pxPerSec));
  };

  const clientYToDropIndex = (clientY: number): number => {
    const el = trackRowsRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const relY = clientY - rect.top;
      return Math.max(0, Math.min(layers.length, Math.round(relY / ROW_HEIGHT)));
    }
    const leftEl = leftListRef.current;
    if (leftEl) {
      const rect = leftEl.getBoundingClientRect();
      const relY = clientY - rect.top + leftEl.scrollTop;
      return Math.max(0, Math.min(layers.length, Math.round(relY / ROW_HEIGHT)));
    }
    return 0;
  };

  const startLongPress = (
    layerId: string,
    index: number,
    clientX: number,
    clientY: number,
    immediateDrag = false
  ) => {
    clearLongPress();
    pendingPressRef.current = {
      layerId,
      index,
      startClientX: clientX,
      startClientY: clientY,
      triggered: immediateDrag,
    };

    if (immediateDrag) {
      dragBarRef.current = null;
      setDraggingRowIdx(index);
      setDropTargetIdx(index);
      return;
    }

    longPressTimerRef.current = window.setTimeout(() => {
      if (!pendingPressRef.current) return;
      pendingPressRef.current.triggered = true;
      dragBarRef.current = null;
      onEnterSelectionMode();
      onEnsureLayerSelected(layerId);
      setDraggingRowIdx(index);
      setDropTargetIdx(index);
    }, 360);
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScrubbing(true);
    onSeek(clientXToTime(e.clientX));
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    onSeek(clientXToTime(e.clientX));
  };

  const handlePanelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pending = pendingPressRef.current;
    const drag = dragBarRef.current;

    if (pending && !pending.triggered) {
      const dist = Math.hypot(
        e.clientX - pending.startClientX,
        e.clientY - pending.startClientY
      );
      // Cancel long-press immediately once horizontal bar drag begins so clip never snaps back
      if ((drag && Math.abs(e.clientX - drag.startClientX) > 6) || dist > 10) {
        clearLongPress();
        pendingPressRef.current = null;
      }
    }

    // Active vertical track-reorder drag across any track
    if (draggingRowIdx !== null) {
      const targetIdx = clientYToDropIndex(e.clientY);
      setDropTargetIdx(targetIdx);
      return;
    }

    // Horizontal clip move / trim (allows moving split clips freely forward beyond current project duration)
    if (!drag) return;
    const dt = (e.clientX - drag.startClientX) / pxPerSec;
    const minLen = 0.2;

    if (drag.mode === 'move') {
      const len = Math.max(minLen, drag.origEnd - drag.origStart);
      const newStart = Math.max(0, Math.min(120 - len, drag.origStart + dt));
      onUpdateLayerTiming(
        drag.layerId,
        Number(newStart.toFixed(2)),
        Number((newStart + len).toFixed(2))
      );
    } else if (drag.mode === 'trim-left') {
      const newStart = Math.max(0, Math.min(drag.origEnd - minLen, drag.origStart + dt));
      onUpdateLayerTiming(
        drag.layerId,
        Number(newStart.toFixed(2)),
        drag.origEnd
      );
    } else if (drag.mode === 'trim-right') {
      const newEnd = Math.min(120, Math.max(drag.origStart + minLen, drag.origEnd + dt));
      onUpdateLayerTiming(
        drag.layerId,
        drag.origStart,
        Number(newEnd.toFixed(2))
      );
    }
  };

  const handlePanelPointerUp = () => {
    clearLongPress();
    if (draggingRowIdx !== null && dropTargetIdx !== null) {
      const finalTarget =
        dropTargetIdx > draggingRowIdx ? dropTargetIdx - 1 : dropTargetIdx;
      if (finalTarget !== draggingRowIdx && finalTarget >= 0 && finalTarget < layers.length) {
        onReorderLayer(draggingRowIdx, finalTarget);
      }
    }
    dragBarRef.current = null;
    setDraggingRowIdx(null);
    setDropTargetIdx(null);
    setIsScrubbing(false);
    window.setTimeout(() => {
      pendingPressRef.current = null;
    }, 0);
  };

  // Sync vertical scroll between Left Track List & Right Track Rows
  const handleLeftScroll = () => {
    if (isSyncingScrollRef.current) return;
    if (leftListRef.current && trackScrollRef.current) {
      isSyncingScrollRef.current = true;
      trackScrollRef.current.scrollTop = leftListRef.current.scrollTop;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    }
  };

  const handleRightScroll = () => {
    if (isSyncingScrollRef.current) return;
    if (leftListRef.current && trackScrollRef.current) {
      isSyncingScrollRef.current = true;
      leftListRef.current.scrollTop = trackScrollRef.current.scrollTop;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    }
  };

  const totalTicks = Math.ceil(project.duration * 4);

  return (
    <section
      className={`relative ${
        compact ? 'h-[118px] sm:h-[128px]' : 'h-[205px] sm:h-[236px]'
      } bg-[#161925] flex flex-col shrink-0 select-none transition-[height] duration-150`}
      onPointerMove={handlePanelPointerMove}
      onPointerUp={handlePanelPointerUp}
      onPointerCancel={handlePanelPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Main Split: Left Layer Headers + Right Scrollable Tracks (Single Top Multi-Select Strip Lives in StageViewport) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Track Header Column */}
        <div className="w-[94px] sm:w-[136px] bg-[#191D2B] border-r border-white/[0.08] flex flex-col shrink-0">
          <div className="h-9 border-b border-white/[0.08] px-2 flex items-center justify-between text-[11px] font-medium text-slate-400 shrink-0">
            {selectionMode ? (
              <>
                <span className="text-[#2BE0A5] font-bold">Multi-Pick</span>
                <button
                  onClick={onExitSelectionMode}
                  title="Exit multi-select"
                  className="text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span>Layers</span>
                <span className="font-mono-tabular text-slate-500">{layers.length}</span>
              </>
            )}
          </div>

          <div
            ref={leftListRef}
            onScroll={handleLeftScroll}
            className="flex-1 overflow-y-auto divide-y divide-white/[0.04] relative"
          >
            {layers.map((layer, index) => {
              const isSelected = selectedLayerIds.includes(layer.id);
              const isBeingDragged = draggingRowIdx === index;

              return (
                <div
                  key={layer.id}
                  onPointerDown={(e) => {
                    startLongPress(layer.id, index, e.clientX, e.clientY, false);
                  }}
                  onClick={() => {
                    if (pendingPressRef.current?.triggered) return;
                    onSelectLayer(layer.id, selectionMode);
                  }}
                  title="Hold to multi-select or drag grip to any track"
                  className={`h-10 px-1.5 sm:px-2 flex items-center justify-between gap-1 cursor-pointer transition-colors ${
                    isBeingDragged
                      ? 'bg-[#2BE0A5]/25 ring-1 ring-inset ring-[#2BE0A5]'
                      : isSelected
                        ? 'bg-[#2BE0A5]/12'
                        : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility(layer.id);
                      }}
                      title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        layer.visible
                          ? 'text-slate-200 hover:bg-white/10'
                          : 'text-slate-600 hover:bg-white/10'
                      }`}
                    >
                      {layer.visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span className="shrink-0">{getLayerSmallIcon(layer)}</span>

                    {layer.parentId && (
                      <span title="Parented to Null/Group" className="shrink-0">
                        <Link2 className="w-3 h-3 text-slate-400" />
                      </span>
                    )}
                  </div>

                  {/* Selection check ONLY appears in Long-Press Multi-Select Mode */}
                  {selectionMode ? (
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#2BE0A5] border-[#2BE0A5] text-[#0E131D]'
                          : 'bg-[#23283A] border-white/25 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  ) : (
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        startLongPress(layer.id, index, e.clientX, e.clientY, true);
                      }}
                      title="Drag layer up/down to any track"
                      className="w-6 h-8 flex items-center justify-center text-slate-400 hover:text-[#2BE0A5] cursor-ns-resize touch-none shrink-0"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Scrollable Ruler + Track Bars (hidden scrollbar, full touch & wheel scroll) */}
        <div
          ref={trackScrollRef}
          onScroll={handleRightScroll}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#141722]"
        >
          <div style={{ width: timelineWidth }} className="relative min-h-full">
            {/* Time Ruler with Millimeter Ticks + Beat Markers */}
            <div
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              className="h-9 sticky top-0 z-20 bg-[#191D2B] border-b border-white/[0.08] cursor-ew-resize touch-none"
            >
              {Array.from({ length: totalTicks + 1 }).map((_, idx) => {
                const sec = idx * 0.25;
                const left = sec * pxPerSec;
                const isWholeSec = idx % 4 === 0;
                return (
                  <div
                    key={idx}
                    style={{ left }}
                    className="absolute bottom-0 flex flex-col items-start pointer-events-none"
                  >
                    {isWholeSec && (
                      <span className="text-[10px] font-mono-tabular text-slate-400 -translate-x-1/2 mb-1">
                        {Math.floor(sec)}s
                      </span>
                    )}
                    <div
                      className={`w-px ${
                        isWholeSec ? 'h-2.5 bg-slate-400/70' : 'h-1.5 bg-slate-600/60'
                      }`}
                    />
                  </div>
                );
              })}

              {project.beatMarkers.map((bm, i) => (
                <div
                  key={`${bm}-${i}`}
                  style={{ left: bm * pxPerSec }}
                  className="absolute top-0 bottom-0 w-px bg-[#E84A6F]/80 pointer-events-none"
                >
                  <div className="w-2 h-2 bg-[#E84A6F] rotate-45 -translate-x-[3.5px] translate-y-1" />
                </div>
              ))}

              <div
                style={{ left: currentTime * pxPerSec }}
                className="absolute bottom-0.5 -translate-x-1/2 px-2 py-0.5 rounded bg-[#2A2F42] border border-white/20 text-[10px] sm:text-[11px] font-mono-tabular font-semibold text-white shadow pointer-events-none z-30"
              >
                {formatTimecode(currentTime, project.fps)}
              </div>
            </div>

            {/* Layer Track Rows */}
            <div ref={trackRowsRef} className="relative divide-y divide-white/[0.04]">
              {/* Live Mint Track-Drop Indicator Line during Drag */}
              {draggingRowIdx !== null && dropTargetIdx !== null && (
                <div
                  style={{ top: dropTargetIdx * ROW_HEIGHT - 1.5 }}
                  className="absolute left-0 right-0 h-[3px] bg-[#2BE0A5] shadow-[0_0_12px_#2BE0A5] z-30 pointer-events-none"
                />
              )}

              {layers.map((layer, index) => {
                const isSelected = selectedLayerIds.includes(layer.id);
                const colors = getLayerTrackColors(layer);
                const barLeft = layer.startTime * pxPerSec;
                const barWidth = Math.max(
                  28,
                  (layer.endTime - layer.startTime) * pxPerSec
                );
                const kfTimes = getLayerKeyframeTimes(layer);
                const isBeingDragged = draggingRowIdx === index;

                return (
                  <div
                    key={layer.id}
                    className={`h-10 relative flex items-center transition-colors ${
                      isBeingDragged
                        ? 'bg-[#2BE0A5]/20 opacity-85'
                        : isSelected
                          ? 'bg-[#2BE0A5]/[0.06]'
                          : ''
                    }`}
                  >
                    {project.beatMarkers.map((bm, i) => (
                      <div
                        key={`${bm}-${i}`}
                        style={{ left: bm * pxPerSec }}
                        className="absolute top-0 bottom-0 w-px bg-[#E84A6F]/25 pointer-events-none"
                      />
                    ))}

                    {/* Layer Duration Bar (Supports Horizontal Move + Long-Press Multi-Select & Track Drag) */}
                    <div
                      style={{ left: barLeft, width: barWidth }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        startLongPress(layer.id, index, e.clientX, e.clientY, false);
                        if (!selectionMode) {
                          onSelectLayer(layer.id, e.shiftKey);
                          dragBarRef.current = {
                            layerId: layer.id,
                            mode: 'move',
                            startClientX: e.clientX,
                            origStart: layer.startTime,
                            origEnd: layer.endTime,
                          };
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (pendingPressRef.current?.triggered) return;
                        if (selectionMode) {
                          onSelectLayer(layer.id, true);
                        }
                      }}
                      title="Drag to shift time · Hold to multi-select & drag to any track"
                      className={`absolute h-7 rounded-md ${colors.bg} ${colors.text} border ${
                        isSelected
                          ? 'ring-2 ring-white border-white shadow-md'
                          : colors.border
                      } flex items-center px-2.5 overflow-hidden cursor-grab active:cursor-grabbing touch-none`}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          clearLongPress();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          dragBarRef.current = {
                            layerId: layer.id,
                            mode: 'trim-left',
                            startClientX: e.clientX,
                            origStart: layer.startTime,
                            origEnd: layer.endTime,
                          };
                        }}
                        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-black/25 touch-none"
                      />

                      {layer.type === 'audio' && layer.waveformPeaks && (
                        <div className="absolute inset-0 flex items-center gap-[2px] px-2 opacity-35 pointer-events-none">
                          {layer.waveformPeaks.slice(0, 60).map((pk, idx) => (
                            <div
                              key={idx}
                              style={{ height: `${Math.max(15, pk * 90)}%` }}
                              className="flex-1 bg-current rounded-full"
                            />
                          ))}
                        </div>
                      )}

                      <span className="text-xs font-semibold truncate pointer-events-none relative z-10">
                        {layer.isMask ? `Mask · ${layer.name}` : layer.name}
                      </span>

                      {/* Right Trim Handle */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          clearLongPress();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          dragBarRef.current = {
                            layerId: layer.id,
                            mode: 'trim-right',
                            startClientX: e.clientX,
                            origStart: layer.startTime,
                            origEnd: layer.endTime,
                          };
                        }}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-black/25 touch-none"
                      />
                    </div>

                    {/* White Diamond Keyframe Markers */}
                    {kfTimes.map((kt) => {
                      const isAtPlayhead = Math.abs(kt - currentTime) < 0.04;
                      return (
                        <button
                          key={kt}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSeek(kt);
                          }}
                          style={{ left: kt * pxPerSec }}
                          title={`Keyframe at ${kt.toFixed(2)}s`}
                          className={`absolute z-10 w-3 h-3 -translate-x-1/2 rotate-45 border transition-transform hover:scale-125 cursor-pointer ${
                            isAtPlayhead
                              ? 'bg-[#2BE0A5] border-[#0E131D]'
                              : 'bg-white border-[#1A1E2B]'
                          }`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Crisp White Playhead Line */}
            <div
              style={{ left: currentTime * pxPerSec }}
              className="absolute top-9 bottom-0 w-[2px] bg-white pointer-events-none z-20 shadow-[0_0_8px_rgba(255,255,255,0.45)]"
            />
          </div>
        </div>
      </div>

      {/* Floating Mint + FAB Button at bottom-right when no layer dock is open */}
      {!compact && onOpenAddDrawer && (
        <button
          onClick={onOpenAddDrawer}
          title="Add Layer (Shape, Text, Media, Audio, Object, Drawing)"
          className="absolute bottom-3 right-3.5 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#2BE0A5] hover:bg-[#23C790] text-[#0E131D] shadow-lg shadow-[#2BE0A5]/35 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer z-30"
        >
          <Plus className="w-6 h-6 stroke-[2.6]" />
        </button>
      )}
    </section>
  );
};
