import React, { useEffect, useRef, useState } from 'react';
import {
  CheckSquare,
  CopyPlus,
  FolderPlus,
  Layers,
  PenTool,
  Trash2,
  X,
} from 'lucide-react';
import { AxisLockMode, Layer, ProjectConfig, VectorPoint } from '../types/editor';
import {
  getLayerBounds,
  getLayerWorldTransform,
  renderProjectFrame,
} from '../engine/compositor';
import { evaluateLayerTransform } from '../engine/easing';

interface StageViewportProps {
  project: ProjectConfig;
  layers: Layer[];
  currentTime: number;
  selectedLayerIds: string[];
  showGrid: boolean;
  drawingMode: 'none' | 'freehand' | 'vector';
  selectionMode?: boolean;
  axisLock?: AxisLockMode;
  onChangeAxisLock?: (mode: AxisLockMode) => void;
  onExitSelectionMode?: () => void;
  onSelectLayers: (ids: string[]) => void;
  onUpdateLayerTransform: (
    layerId: string,
    patch: Partial<{
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
      rotation: number;
    }>
  ) => void;
  onFinishDrawing: (points: VectorPoint[], mode: 'freehand' | 'vector') => void;
  onCancelDrawing: () => void;
  onGroupSelected: () => void;
  onMaskSelected: () => void;
  onGroupAndMaskSelected: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  canvasRefOut?: React.RefObject<HTMLCanvasElement | null>;
}

export const StageViewport: React.FC<StageViewportProps> = ({
  project,
  layers,
  currentTime,
  selectedLayerIds,
  showGrid,
  drawingMode,
  selectionMode = false,
  axisLock = 'both',
  onChangeAxisLock,
  onExitSelectionMode,
  onSelectLayers,
  onUpdateLayerTransform,
  onFinishDrawing,
  onCancelDrawing,
  onGroupSelected,
  onMaskSelected,
  onGroupAndMaskSelected,
  onDuplicateSelected,
  onDeleteSelected,
  canvasRefOut,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = canvasRefOut ?? internalCanvasRef;

  const [displaySize, setDisplaySize] = useState({ width: 640, height: 360 });
  const [drawPoints, setDrawPoints] = useState<VectorPoint[]>([]);
  const [isDrawingStroke, setIsDrawingStroke] = useState(false);

  const dragStateRef = useRef<{
    mode: 'move' | 'rotate' | 'scale';
    layerId: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startRot: number;
    startScaleX: number;
    startScaleY: number;
    centerClientX: number;
    centerClientY: number;
    startDist: number;
  } | null>(null);

  // Measure container so stage fits cleanly on mobile and desktop
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const isNarrow = rect.width < 540;
      const pad = isNarrow ? 14 : 26;
      const availW = Math.max(150, rect.width - pad);
      const availH = Math.max(130, rect.height - pad);
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
  }, [project.width, project.height]);

  // Render frame on every state/time change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderProjectFrame(ctx, project, layers, currentTime, {
      selectedLayerIds,
      showGizmos: true,
      showGrid,
    });

    // Render active drawing preview overlay
    if (drawingMode !== 'none' && drawPoints.length > 0) {
      ctx.save();
      ctx.translate(project.width / 2, project.height / 2);
      ctx.beginPath();
      ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
      for (let i = 1; i < drawPoints.length; i++) {
        ctx.lineTo(drawPoints[i].x, drawPoints[i].y);
      }
      ctx.strokeStyle = '#2BE0A5';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      if (drawingMode === 'vector') {
        drawPoints.forEach((p) => {
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = '#2BE0A5';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
      ctx.restore();
    }
  }, [project, layers, currentTime, selectedLayerIds, showGrid, drawingMode, drawPoints, canvasRef]);

  const clientToStage = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { sx: 0, sy: 0, cx: 0, cy: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = project.width / rect.width;
    const scaleY = project.height / rect.height;
    const sx = (clientX - rect.left) * scaleX;
    const sy = (clientY - rect.top) * scaleY;
    return {
      sx,
      sy,
      cx: sx - project.width / 2,
      cy: sy - project.height / 2,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { sx, sy, cx, cy } = clientToStage(e.clientX, e.clientY);

    if (drawingMode === 'freehand') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDrawingStroke(true);
      setDrawPoints([{ x: cx, y: cy }]);
      return;
    }

    if (drawingMode === 'vector') {
      setDrawPoints((prev) => [...prev, { x: cx, y: cy }]);
      return;
    }

    // Check handles of currently selected single layer first
    if (selectedLayerIds.length === 1) {
      const selLayer = layers.find((l) => l.id === selectedLayerIds[0]);
      if (selLayer && selLayer.visible && !selLayer.locked) {
        const wt = getLayerWorldTransform(selLayer, layers, currentTime, project);
        const bounds = getLayerBounds(selLayer);
        const rad = (-wt.rotation * Math.PI) / 180;
        const dx = sx - wt.x;
        const dy = sy - wt.y;
        const lx = (dx * Math.cos(rad) - dy * Math.sin(rad)) / (wt.scaleX || 1);
        const ly = (dx * Math.sin(rad) + dy * Math.cos(rad)) / (wt.scaleY || 1);

        const hw = bounds.width / 2;
        const hh = bounds.height / 2;

        // Top rotation handle hit test
        if (Math.hypot(lx - 0, ly - (-hh - 38)) < 24) {
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          const t = evaluateLayerTransform(selLayer, currentTime);
          dragStateRef.current = {
            mode: 'rotate',
            layerId: selLayer.id,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startX: t.x,
            startY: t.y,
            startRot: t.rotation,
            startScaleX: t.scaleX,
            startScaleY: t.scaleY,
            centerClientX: rect.left + (wt.x / project.width) * rect.width,
            centerClientY: rect.top + (wt.y / project.height) * rect.height,
            startDist: 1,
          };
          return;
        }

        // Corner scale handles
        const corners = [
          [-hw, -hh],
          [hw, -hh],
          [hw, hh],
          [-hw, hh],
        ];
        for (const [hx, hy] of corners) {
          if (Math.hypot(lx - hx, ly - hy) < 22) {
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();
            const centerClientX = rect.left + (wt.x / project.width) * rect.width;
            const centerClientY = rect.top + (wt.y / project.height) * rect.height;
            const t = evaluateLayerTransform(selLayer, currentTime);
            dragStateRef.current = {
              mode: 'scale',
              layerId: selLayer.id,
              startClientX: e.clientX,
              startClientY: e.clientY,
              startX: t.x,
              startY: t.y,
              startRot: t.rotation,
              startScaleX: t.scaleX,
              startScaleY: t.scaleY,
              centerClientX,
              centerClientY,
              startDist: Math.max(
                10,
                Math.hypot(e.clientX - centerClientX, e.clientY - centerClientY)
              ),
            };
            return;
          }
        }
      }
    }

    // Hit test layers top-to-bottom
    let hitLayer: Layer | null = null;
    for (const layer of layers) {
      if (
        !layer.visible ||
        layer.type === 'audio' ||
        layer.type === 'camera' ||
        currentTime < layer.startTime ||
        currentTime > layer.endTime
      ) {
        continue;
      }
      const wt = getLayerWorldTransform(layer, layers, currentTime, project);
      const bounds = getLayerBounds(layer);
      const rad = (-wt.rotation * Math.PI) / 180;
      const dx = sx - wt.x;
      const dy = sy - wt.y;
      const lx = (dx * Math.cos(rad) - dy * Math.sin(rad)) / (wt.scaleX || 1);
      const ly = (dx * Math.sin(rad) + dy * Math.cos(rad)) / (wt.scaleY || 1);

      if (
        Math.abs(lx) <= bounds.width / 2 + 12 &&
        Math.abs(ly) <= bounds.height / 2 + 12
      ) {
        hitLayer = layer;
        break;
      }
    }

    if (hitLayer) {
      if (e.shiftKey) {
        const exists = selectedLayerIds.includes(hitLayer.id);
        onSelectLayers(
          exists
            ? selectedLayerIds.filter((id) => id !== hitLayer!.id)
            : [...selectedLayerIds, hitLayer.id]
        );
      } else {
        if (!selectedLayerIds.includes(hitLayer.id)) {
          onSelectLayers([hitLayer.id]);
        }
      }

      if (!hitLayer.locked) {
        e.currentTarget.setPointerCapture(e.pointerId);
        const t = evaluateLayerTransform(hitLayer, currentTime);
        dragStateRef.current = {
          mode: 'move',
          layerId: hitLayer.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startX: t.x,
          startY: t.y,
          startRot: t.rotation,
          startScaleX: t.scaleX,
          startScaleY: t.scaleY,
          centerClientX: 0,
          centerClientY: 0,
          startDist: 1,
        };
      }
    } else {
      onSelectLayers([]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingMode === 'freehand' && isDrawingStroke) {
      const { cx, cy } = clientToStage(e.clientX, e.clientY);
      setDrawPoints((prev) => {
        const last = prev[prev.length - 1];
        if (!last || Math.hypot(cx - last.x, cy - last.y) > 4) {
          return [...prev, { x: cx, y: cy }];
        }
        return prev;
      });
      return;
    }

    const drag = dragStateRef.current;
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleRatioX = project.width / rect.width;
    const scaleRatioY = project.height / rect.height;

    if (drag.mode === 'move') {
      const rawDx = (e.clientX - drag.startClientX) * scaleRatioX;
      const rawDy = (e.clientY - drag.startClientY) * scaleRatioY;
      let dx = rawDx;
      let dy = rawDy;
      if (axisLock === 'x') {
        dy = 0;
      } else if (axisLock === 'y') {
        dx = 0;
      } else if (e.shiftKey) {
        if (Math.abs(rawDx) >= Math.abs(rawDy)) dy = 0;
        else dx = 0;
      }
      onUpdateLayerTransform(drag.layerId, {
        x: Math.round(drag.startX + dx),
        y: Math.round(drag.startY + dy),
      });
    } else if (drag.mode === 'rotate') {
      const a0 = Math.atan2(
        drag.startClientY - drag.centerClientY,
        drag.startClientX - drag.centerClientX
      );
      const a1 = Math.atan2(
        e.clientY - drag.centerClientY,
        e.clientX - drag.centerClientX
      );
      const deltaDeg = ((a1 - a0) * 180) / Math.PI;
      onUpdateLayerTransform(drag.layerId, {
        rotation: Math.round(drag.startRot + deltaDeg),
      });
    } else if (drag.mode === 'scale') {
      const dist = Math.hypot(
        e.clientX - drag.centerClientX,
        e.clientY - drag.centerClientY
      );
      const factor = Math.max(0.1, dist / drag.startDist);
      onUpdateLayerTransform(drag.layerId, {
        scaleX: Number((drag.startScaleX * factor).toFixed(2)),
        scaleY: Number((drag.startScaleY * factor).toFixed(2)),
      });
    }
  };

  const handlePointerUp = () => {
    if (drawingMode === 'freehand' && isDrawingStroke) {
      setIsDrawingStroke(false);
      if (drawPoints.length > 2) {
        onFinishDrawing(drawPoints, 'freehand');
      }
      setDrawPoints([]);
      return;
    }
    dragStateRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-[radial-gradient(circle_at_50%_45%,#1D2233_0%,#12151E_72%)] flex items-center justify-center overflow-hidden min-h-[155px]"
    >
      {/* Subtle Top-Right Composition Info Pill */}
      {selectedLayerIds.length <= 1 && drawingMode === 'none' && (
        <div className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-md bg-[#161925]/85 border border-white/[0.08] text-[10px] font-mono-tabular text-slate-300 pointer-events-none hidden sm:block">
          {project.width}×{project.height} · {project.fps}fps
        </div>
      )}

      {/* Quick On-Stage Axis Lock Toggle when single layer selected outside multi-select */}
      {selectedLayerIds.length === 1 && !selectionMode && onChangeAxisLock && drawingMode === 'none' && (
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-0.5 bg-[#191D2B]/90 border border-white/10 rounded-lg p-0.5 shadow-md">
          {(
            [
              { id: 'both', label: 'XY' },
              { id: 'x', label: 'X-Lock' },
              { id: 'y', label: 'Y-Lock' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              onClick={() => onChangeAxisLock(mode.id)}
              title={`Constrain stage drag to ${mode.label}`}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                axisLock === mode.id
                  ? mode.id === 'x'
                    ? 'bg-rose-500 text-white'
                    : mode.id === 'y'
                      ? 'bg-[#2BE0A5] text-[#0E131D]'
                      : 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      {/* Single Multi-Selection Mint Top Bar (Visible on Long-Press Multi-Pick or 2+ Selected) */}
      {(selectionMode || selectedLayerIds.length > 1) && (
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 bg-[#2BE0A5] text-[#0E131D] rounded-xl px-2.5 py-1.5 flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 sm:gap-2 shadow-xl w-[calc(100%-1rem)] sm:w-auto max-w-[96%]">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                onExitSelectionMode?.();
                onSelectLayers([]);
              }}
              className="w-6 h-6 rounded-md bg-black/10 hover:bg-black/20 flex items-center justify-center cursor-pointer shrink-0"
              title="Exit selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-extrabold whitespace-nowrap shrink-0">
              {selectedLayerIds.length} selected
            </span>
          </div>

          <div className="hidden sm:block h-4 w-px bg-black/20 shrink-0" />

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1 shrink-0">
            <button
              disabled={selectedLayerIds.length < 2}
              onClick={onGroupSelected}
              title="Group Selected Layers"
              className="flex items-center gap-1 text-[11px] sm:text-xs font-bold bg-black/10 hover:bg-black/20 disabled:opacity-35 px-2 py-1 rounded-md cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Group</span>
            </button>
            <button
              disabled={selectedLayerIds.length === 0}
              onClick={onMaskSelected}
              title="Mask Selected Layers"
              className="flex items-center gap-1 text-[11px] sm:text-xs font-bold bg-black/10 hover:bg-black/20 disabled:opacity-35 px-2 py-1 rounded-md cursor-pointer whitespace-nowrap shrink-0"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Mask</span>
            </button>
            <button
              disabled={selectedLayerIds.length < 2}
              onClick={onGroupAndMaskSelected}
              title="Group & Mask Selected Layers"
              className="flex items-center gap-1 text-[11px] sm:text-xs font-bold bg-black/10 hover:bg-black/20 disabled:opacity-35 px-2 py-1 rounded-md cursor-pointer whitespace-nowrap shrink-0"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Group &amp; Mask</span>
            </button>
            <button
              disabled={selectedLayerIds.length === 0}
              onClick={onDuplicateSelected}
              title="Duplicate Selected Layers"
              className="flex items-center gap-1 text-[11px] sm:text-xs font-bold bg-black/10 hover:bg-black/20 disabled:opacity-35 px-2 py-1 rounded-md cursor-pointer whitespace-nowrap shrink-0"
            >
              <CopyPlus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Duplicate</span>
            </button>
            <button
              disabled={selectedLayerIds.length === 0}
              onClick={onDeleteSelected}
              title="Delete Selected Layers"
              className="flex items-center gap-1 text-[11px] sm:text-xs font-bold bg-black/10 hover:bg-rose-600 hover:text-white disabled:opacity-35 px-2 py-1 rounded-md cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Drawing Mode Floating Bar */}
      {drawingMode !== 'none' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-[#1E2231] border border-[#2BE0A5] text-white rounded-lg px-3.5 py-2 flex items-center gap-3 shadow-xl">
          <PenTool className="w-4 h-4 text-[#2BE0A5]" />
          <span className="text-xs font-medium">
            {drawingMode === 'freehand'
              ? 'Drag on canvas to draw freehand stroke'
              : 'Click on canvas to place vector anchor points'}
          </span>
          {drawingMode === 'vector' && drawPoints.length >= 2 && (
            <button
              onClick={() => {
                onFinishDrawing(drawPoints, 'vector');
                setDrawPoints([]);
              }}
              className="px-2.5 py-1 rounded bg-[#2BE0A5] text-[#0E131D] text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          )}
          <button
            onClick={() => {
              setDrawPoints([]);
              onCancelDrawing();
            }}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Actual Stage Canvas with Crisp Studio Frame */}
      <div
        className={`relative rounded-[2px] shadow-[0_16px_56px_rgba(0,0,0,0.75)] ring-1 ring-white/15 overflow-hidden ${
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`w-full h-full block touch-none ${
            drawingMode !== 'none' ? 'cursor-crosshair' : 'cursor-default'
          }`}
        />
      </div>
    </div>
  );
};
