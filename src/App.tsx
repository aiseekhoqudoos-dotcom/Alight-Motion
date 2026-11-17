import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AxisLockMode,
  BlendMode,
  EasingCurve,
  EffectInstance,
  Keyframe,
  Layer,
  LayerPreset,
  LayerStyleClipboard,
  NumericAnimatableProp,
  ProjectConfig,
  ShapeKind,
  VectorPoint,
} from './types/editor';
import {
  createDefaultProject,
  createEffectInstance,
  createTrailerProject,
} from './engine/presets';
import {
  evaluateProperty,
  getLayerKeyframeTimes,
} from './engine/easing';
import { getLayerBounds } from './engine/compositor';
import {
  parseXMLToProjectOrLayers,
  serializeLayerPresetToXML,
} from './engine/xmlEngine';
import { TopBar } from './components/TopBar';
import { StageViewport } from './components/StageViewport';
import { TransportBar } from './components/TransportBar';
import { TimelinePanel } from './components/TimelinePanel';
import { BottomControlDock, BottomDockPanel } from './components/BottomControlDock';
import { HomeScreen, SavedProjectRecord } from './components/HomeScreen';
import { AddLayerDrawer } from './components/AddLayerDrawer';
import {
  AIMotionModal,
  AIMotionMode,
} from './components/AIMotionModal';
import { NewProjectModal } from './components/NewProjectModal';
import { ExportModal } from './components/ExportModal';
import { PreviewScreenModal } from './components/PreviewScreenModal';

interface EditorSnapshot {
  project: ProjectConfig;
  layers: Layer[];
}

const STORAGE_KEY = 'kinetix_projects_v1';
const CUSTOM_PRESETS_KEY = 'kinetix_custom_presets_v1';

function loadInitialSavedProjects(): SavedProjectRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as SavedProjectRecord[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fallback to default project
  }
  const def = createDefaultProject();
  return [
    {
      id: def.project.id,
      updatedAt: Date.now(),
      project: def.project,
      layers: def.layers,
    },
  ];
}

function loadCustomPresets(): LayerPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LayerPreset[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export default function App() {
  const initialRecords = useRef<SavedProjectRecord[]>(loadInitialSavedProjects());
  const firstRecord =
    initialRecords.current[0] ??
    (() => {
      const def = createDefaultProject();
      return {
        id: def.project.id,
        updatedAt: Date.now(),
        project: def.project,
        layers: def.layers,
      };
    })();

  const [screen, setScreen] = useState<'home' | 'editor'>('home');
  const [savedProjects, setSavedProjects] = useState<SavedProjectRecord[]>(
    initialRecords.current
  );
  const [activeProjectId, setActiveProjectId] = useState<string>(firstRecord.id);

  const [project, setProject] = useState<ProjectConfig>(firstRecord.project);
  const [layers, setLayers] = useState<Layer[]>(firstRecord.layers);
  const [past, setPast] = useState<EditorSnapshot[]>([]);
  const [future, setFuture] = useState<EditorSnapshot[]>([]);

  const [currentTime, setCurrentTime] = useState<number>(1.2);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [axisLock, setAxisLock] = useState<AxisLockMode>('both');
  const [pxPerSec, setPxPerSec] = useState<number>(96);

  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [activeBottomPanel, setActiveBottomPanel] = useState<BottomDockPanel>('menu');
  const [drawingMode, setDrawingMode] = useState<'none' | 'freehand' | 'vector'>('none');

  const [copiedEffects, setCopiedEffects] = useState<EffectInstance[]>([]);
  const [copiedStyle, setCopiedStyle] = useState<LayerStyleClipboard | null>(null);
  const [copiedKeyframes, setCopiedKeyframes] = useState<
    Partial<Record<NumericAnimatableProp, Keyframe<number>[]>> | null
  >(null);
  const [copiedCurve, setCopiedCurve] = useState<EasingCurve | null>(null);
  const [customPresets, setCustomPresets] = useState<LayerPreset[]>(loadCustomPresets);

  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [aiModalState, setAiModalState] = useState<{
    open: boolean;
    mode: AIMotionMode;
  }>({ open: false, mode: 'scene' });
  const [projectModalState, setProjectModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
  }>({ open: false, mode: 'create' });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiToast, setAiToast] = useState<string | null>(null);

  const showAiToast = useCallback((msg: string) => {
    setAiToast(msg);
    window.setTimeout(() => {
      setAiToast((cur) => (cur === msg ? null : cur));
    }, 3200);
  }, []);

  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Persist savedProjects and customPresets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProjects));
    } catch {
      // Ignore quota errors
    }
  }, [savedProjects]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets));
    } catch {
      // Ignore quota errors
    }
  }, [customPresets]);

  // Auto-sync active project & layers back into savedProjects while editing
  useEffect(() => {
    if (screen !== 'editor') return;
    const timer = window.setTimeout(() => {
      setSavedProjects((prev) => {
        const idx = prev.findIndex((r) => r.id === activeProjectId);
        const updatedRecord: SavedProjectRecord = {
          id: activeProjectId,
          updatedAt: Date.now(),
          project,
          layers,
        };
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updatedRecord;
          return copy;
        }
        return [updatedRecord, ...prev];
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [screen, activeProjectId, project, layers]);

  // Reset bottom panel and selection mode whenever selection clears
  useEffect(() => {
    if (selectedLayerIds.length !== 1) {
      setActiveBottomPanel('menu');
    }
    if (selectedLayerIds.length === 0) {
      setSelectionMode(false);
    }
  }, [selectedLayerIds]);

  const pushHistory = useCallback(
    (nextProject: ProjectConfig, nextLayers: Layer[]) => {
      setPast((prev) => [...prev.slice(-29), { project, layers }]);
      setFuture([]);
      setProject(nextProject);
      setLayers(nextLayers);
    },
    [project, layers]
  );

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture((f) => [{ project, layers }, ...f]);
    setPast((p) => p.slice(0, -1));
    setProject(previous.project);
    setLayers(previous.layers);
  }, [past, project, layers]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setPast((p) => [...p, { project, layers }]);
    setFuture((f) => f.slice(1));
    setProject(next.project);
    setLayers(next.layers);
  }, [future, project, layers]);

  // Smooth 60fps requestAnimationFrame playback loop
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      setCurrentTime((prev) => {
        const next = prev + dt;
        if (next >= project.duration) {
          if (isLooping) return 0;
          setIsPlaying(false);
          return project.duration;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isLooping, project.duration]);

  // Sync audio layers with playback & playhead
  useEffect(() => {
    const audioLayers = layers.filter((l) => l.type === 'audio' && l.audioUrl);
    const activeIds = new Set(audioLayers.map((l) => l.id));

    // Cleanup removed audio elements
    audioElementsRef.current.forEach((el, id) => {
      if (!activeIds.has(id)) {
        el.pause();
        audioElementsRef.current.delete(id);
      }
    });

    for (const al of audioLayers) {
      let audio = audioElementsRef.current.get(al.id);
      if (!audio && al.audioUrl) {
        audio = new Audio(al.audioUrl);
        audioElementsRef.current.set(al.id, audio);
      }
      if (!audio) continue;
      audio.volume = al.visible ? (al.audioVolume ?? 1) : 0;

      const inRange = currentTime >= al.startTime && currentTime <= al.endTime;
      if (isPlaying && inRange && al.visible) {
        const targetOffset = currentTime - al.startTime;
        if (Math.abs(audio.currentTime - targetOffset) > 0.18) {
          audio.currentTime = Math.max(0, targetOffset);
        }
        if (audio.paused) {
          audio.play().catch(() => {});
        }
      } else {
        if (!audio.paused) audio.pause();
      }
    }
  }, [layers, isPlaying, currentTime]);

  const updateLayer = useCallback(
    (layerId: string, updater: (l: Layer) => Layer, recordHistory = false) => {
      setLayers((prev) => {
        const next = prev.map((l) => (l.id === layerId ? updater(l) : l));
        if (recordHistory) {
          setPast((p) => [...p.slice(-29), { project, layers: prev }]);
          setFuture([]);
        }
        return next;
      });
    },
    [project]
  );

  const handleStageTransformChange = useCallback(
    (
      layerId: string,
      patch: Partial<{
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        rotation: number;
      }>
    ) => {
      updateLayer(layerId, (prev) => {
        let nextKfs = { ...prev.keyframes };
        let nextTransform = { ...prev.transform };

        (Object.entries(patch) as Array<[NumericAnimatableProp, number]>).forEach(
          ([prop, val]) => {
            if (val === undefined) return;
            const kfs = nextKfs[prop];
            if (kfs && kfs.length > 0) {
              const idx = kfs.findIndex((k) => Math.abs(k.time - currentTime) < 0.05);
              if (idx >= 0) {
                const copy = [...kfs];
                copy[idx] = { ...copy[idx], value: val };
                nextKfs[prop] = copy;
              } else {
                const added: Keyframe<number> = {
                  id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  time: Number(currentTime.toFixed(2)),
                  value: val,
                  easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
                };
                nextKfs[prop] = [...kfs, added].sort((a, b) => a.time - b.time);
              }
            } else {
              (nextTransform as unknown as Record<string, number>)[prop] = val;
            }
          }
        );

        return { ...prev, transform: nextTransform, keyframes: nextKfs };
      });
    },
    [currentTime, updateLayer]
  );

  const handleToggleKeyframe = useCallback(
    (layerId: string, prop: NumericAnimatableProp) => {
      updateLayer(
        layerId,
        (prev) => {
          const existing = prev.keyframes[prop] || [];
          const hitIdx = existing.findIndex(
            (k) => Math.abs(k.time - currentTime) < 0.05
          );
          if (hitIdx >= 0) {
            const nextArr = existing.filter((_, i) => i !== hitIdx);
            return {
              ...prev,
              keyframes: { ...prev.keyframes, [prop]: nextArr },
            };
          }
          const fallbackVal =
            (prev.transform as unknown as Record<string, number>)[prop] ??
            (prev as unknown as Record<string, number>)[prop] ??
            0;
          const currentVal = evaluateProperty(existing, fallbackVal, currentTime);
          const newKf: Keyframe<number> = {
            id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            time: Number(currentTime.toFixed(2)),
            value: Number(currentVal.toFixed(2)),
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          };
          return {
            ...prev,
            keyframes: {
              ...prev.keyframes,
              [prop]: [...existing, newKf].sort((a, b) => a.time - b.time),
            },
          };
        },
        true
      );
    },
    [currentTime, updateLayer]
  );

  const selectedLayer =
    selectedLayerIds.length === 1
      ? layers.find((l) => l.id === selectedLayerIds[0]) ?? null
      : null;

  const handleJumpKeyframe = (dir: -1 | 1) => {
    const target = selectedLayer || layers[0];
    if (!target) {
      setCurrentTime(dir < 0 ? 0 : project.duration);
      return;
    }
    const times = getLayerKeyframeTimes(target);
    if (times.length === 0) {
      setCurrentTime(dir < 0 ? target.startTime : target.endTime);
      return;
    }
    if (dir < 0) {
      const prev = [...times].reverse().find((t) => t < currentTime - 0.04);
      setCurrentTime(prev !== undefined ? prev : 0);
    } else {
      const next = times.find((t) => t > currentTime + 0.04);
      setCurrentTime(next !== undefined ? next : project.duration);
    }
  };

  // Layer Creation Handlers
  const insertNewLayer = (newLayer: Layer) => {
    const nextLayers = [newLayer, ...layers];
    pushHistory(project, nextLayers);
    setSelectedLayerIds([newLayer.id]);
  };

  const handleAddShape = (kind: ShapeKind, label: string) => {
    const id = `layer_${Date.now()}`;
    insertNewLayer({
      id,
      name: `${label} ${layers.length + 1}`,
      type: 'shape',
      shapeKind: kind,
      width: 240,
      height: 240,
      cornerRadius: 28,
      pointsCount: 5,
      innerRadiusRatio: 0.58,
      fillColor: '#2BE0A5',
      strokeColor: '#FFFFFF',
      strokeWidth: 0,
      startTime: Number(currentTime.toFixed(2)),
      endTime: project.duration,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {},
      effects: [],
    });
  };

  const handleAddText = (presetText = 'KINETIC') => {
    const id = `layer_${Date.now()}`;
    insertNewLayer({
      id,
      name: `Text ${layers.length + 1}`,
      type: 'text',
      text: presetText,
      fontFamily: 'Outfit',
      fontSize: 72,
      fontWeight: 700,
      textAlign: 'center',
      letterSpacing: 4,
      lineHeight: 1.15,
      fillColor: '#FFFFFF',
      strokeColor: '#12151E',
      strokeWidth: 0,
      startTime: Number(currentTime.toFixed(2)),
      endTime: project.duration,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {},
      effects: [],
    });
    setActiveBottomPanel('editShape');
  };

  const handleAddObject = (kind: 'camera' | 'null' | 'group') => {
    const id = `layer_${Date.now()}`;
    insertNewLayer({
      id,
      name:
        kind === 'camera'
          ? 'Camera'
          : kind === 'null'
            ? `Null ${layers.length + 1}`
            : `Group ${layers.length + 1}`,
      type: kind,
      startTime: 0,
      endTime: project.duration,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      cameraActive: kind === 'camera',
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {},
      effects: [],
    });
  };

  const handleAddMediaFile = (file: File, kind: 'image' | 'video') => {
    const url = URL.createObjectURL(file);
    const id = `layer_${Date.now()}`;
    insertNewLayer({
      id,
      name: file.name.slice(0, 22),
      type: 'media',
      mediaUrl: url,
      mediaKind: kind,
      width: 480,
      height: 360,
      startTime: Number(currentTime.toFixed(2)),
      endTime: project.duration,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {},
      effects: [],
    });
  };

  const handleAddAudioFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    let peaks: number[] = Array.from({ length: 48 }, () => 0.25 + Math.random() * 0.65);

    try {
      const arrBuf = await file.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const decoded = await ctx.decodeAudioData(arrBuf);
      const data = decoded.getChannelData(0);
      const buckets = 56;
      const step = Math.floor(data.length / buckets);
      peaks = [];
      for (let i = 0; i < buckets; i++) {
        let max = 0;
        for (let j = 0; j < step; j++) {
          const val = Math.abs(data[i * step + j] || 0);
          if (val > max) max = val;
        }
        peaks.push(max);
      }
      ctx.close();
    } catch {
      // Fallback waveform peaks already set
    }

    const id = `layer_${Date.now()}`;
    insertNewLayer({
      id,
      name: file.name.slice(0, 22),
      type: 'audio',
      audioUrl: url,
      audioVolume: 0.9,
      waveformPeaks: peaks,
      startTime: 0,
      endTime: project.duration,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {},
      effects: [],
    });
  };

  const handleFinishDrawing = (
    points: VectorPoint[],
    mode: 'freehand' | 'vector'
  ) => {
    const id = `layer_${Date.now()}`;
    insertNewLayer({
      id,
      name: mode === 'freehand' ? 'Freehand Stroke' : 'Vector Path',
      type: mode,
      pathPoints: points,
      closedPath: mode === 'vector' && points.length >= 3,
      fillColor: 'rgba(43, 224, 165, 0.22)',
      strokeColor: '#2BE0A5',
      strokeWidth: 6,
      startTime: Number(currentTime.toFixed(2)),
      endTime: project.duration,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {},
      effects: [],
    });
    setDrawingMode('none');
  };

  const handleAddElementPreset = (presetId: string) => {
    const t0 = Number(currentTime.toFixed(2));
    const t1 = Math.min(project.duration, Number((t0 + 1.1).toFixed(2)));
    const baseTransform = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      skewX: 0,
      skewY: 0,
      anchorX: 0,
      anchorY: 0,
      opacity: 100,
    };

    if (presetId === 'lower-third') {
      const bgId = `layer_lt_bg_${Date.now()}`;
      const txtId = `layer_lt_txt_${Date.now()}`;
      const bg: Layer = {
        id: bgId,
        name: 'Lower Third Pill',
        type: 'shape',
        shapeKind: 'pill',
        width: 460,
        height: 84,
        fillColor: '#2BE0A5',
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: { ...baseTransform, x: -240, y: 190 },
        keyframes: {
          x: [
            { id: `k1_${Date.now()}`, time: t0, value: -760, easing: { type: 'bezier', p1x: 0.34, p1y: 1.38, p2x: 0.64, p2y: 1 } },
            { id: `k2_${Date.now()}`, time: t1, value: -240, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [],
      };
      const txt: Layer = {
        id: txtId,
        name: 'Lower Third Title',
        type: 'text',
        text: 'BREAKING MOTION',
        fontFamily: 'Outfit',
        fontSize: 30,
        fontWeight: 800,
        fillColor: '#0E131D',
        letterSpacing: 2,
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: bgId,
        blendMode: 'normal',
        transform: { ...baseTransform },
        keyframes: {},
        effects: [],
      };
      pushHistory(project, [txt, bg, ...layers]);
      setSelectedLayerIds([bgId]);
    } else if (presetId === 'pulse-radar') {
      const id = `layer_radar_${Date.now()}`;
      insertNewLayer({
        id,
        name: 'Orbital Pulse Ring',
        type: 'shape',
        shapeKind: 'arc',
        width: 320,
        height: 320,
        innerRadiusRatio: 0.84,
        fillColor: '#38B2CE',
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'screen',
        transform: baseTransform,
        keyframes: {
          rotation: [
            { id: `k_r1_${Date.now()}`, time: t0, value: 0, easing: { type: 'bezier', p1x: 0.25, p1y: 0.25, p2x: 0.75, p2y: 0.75 } },
            { id: `k_r2_${Date.now()}`, time: project.duration, value: 360, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('glow')],
      });
    } else if (presetId === 'pop-badge') {
      const id = `layer_badge_${Date.now()}`;
      insertNewLayer({
        id,
        name: 'Overshoot Badge',
        type: 'shape',
        shapeKind: 'star',
        width: 220,
        height: 220,
        pointsCount: 6,
        innerRadiusRatio: 0.6,
        fillColor: '#F2A833',
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          scaleX: [
            { id: `k_sx1_${Date.now()}`, time: t0, value: 0, easing: { type: 'bezier', p1x: 0.34, p1y: 1.5, p2x: 0.64, p2y: 1 } },
            { id: `k_sx2_${Date.now()}`, time: t1, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
          scaleY: [
            { id: `k_sy1_${Date.now()}`, time: t0, value: 0, easing: { type: 'bezier', p1x: 0.34, p1y: 1.5, p2x: 0.64, p2y: 1 } },
            { id: `k_sy2_${Date.now()}`, time: t1, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [],
      });
    } else if (presetId === 'progress-ring') {
      const ringId = `layer_pring_${Date.now()}`;
      const numId = `layer_pnum_${Date.now()}`;
      const drawFx = createEffectInstance('drawingProgress');
      drawFx.params = { start: 0, end: 25 };
      const ring: Layer = {
        id: ringId,
        name: '25% Progress Ring',
        type: 'shape',
        shapeKind: 'ring',
        width: 280,
        height: 280,
        innerRadiusRatio: 0.78,
        fillColor: '#2BE0A5',
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          rotation: [
            { id: `k_pr1_${Date.now()}`, time: t0, value: -90, easing: { type: 'bezier', p1x: 0.22, p1y: 1, p2x: 0.36, p2y: 1 } },
            { id: `k_pr2_${Date.now()}`, time: t1, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [drawFx, createEffectInstance('glow')],
      };
      const countFx = createEffectInstance('countUpDown');
      countFx.params = { startVal: 0, endVal: 25, suffix: '%', decimals: 0 };
      const num: Layer = {
        id: numId,
        name: 'Progress Counter',
        type: 'text',
        text: '25%',
        fontFamily: 'Outfit',
        fontSize: 56,
        fontWeight: 800,
        fillColor: '#FFFFFF',
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: ringId,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {},
        effects: [countFx],
      };
      pushHistory(project, [num, ring, ...layers]);
      setSelectedLayerIds([ringId]);
    } else if (presetId === 'count-stat') {
      const id = `layer_count_${Date.now()}`;
      const countFx = createEffectInstance('countUpDown');
      countFx.params = { startVal: 0, endVal: 100, suffix: '%', decimals: 0 };
      insertNewLayer({
        id,
        name: 'Count-Up Stat',
        type: 'text',
        text: '100%',
        fontFamily: 'Archivo',
        fontSize: 96,
        fontWeight: 800,
        fillColor: '#2BE0A5',
        letterSpacing: 3,
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {},
        effects: [countFx],
      });
    } else if (presetId === 'hud-reticle') {
      const id = `layer_hud_${Date.now()}`;
      insertNewLayer({
        id,
        name: 'HUD Target Reticle',
        type: 'shape',
        shapeKind: 'hudGrid',
        width: 300,
        height: 300,
        fillColor: '#38B2CE',
        strokeColor: '#2BE0A5',
        strokeWidth: 4,
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'screen',
        transform: baseTransform,
        keyframes: {
          rotation: [
            { id: `k_h1_${Date.now()}`, time: t0, value: 0, easing: { type: 'bezier', p1x: 0.25, p1y: 0.25, p2x: 0.75, p2y: 0.75 } },
            { id: `k_h2_${Date.now()}`, time: project.duration, value: 180, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('deepGlow')],
      });
    } else if (presetId === 'timecode-stamp') {
      const id = `layer_tc_${Date.now()}`;
      insertNewLayer({
        id,
        name: 'Timecode Stamp',
        type: 'text',
        text: '00:00:00',
        fontFamily: 'JetBrains Mono',
        fontSize: 48,
        fontWeight: 700,
        fillColor: '#F2A833',
        letterSpacing: 4,
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {},
        effects: [createEffectInstance('timecode')],
      });
    } else if (presetId === 'extrude-badge') {
      const id = `layer_ext_${Date.now()}`;
      insertNewLayer({
        id,
        name: '3D Extrude Burst',
        type: 'shape',
        shapeKind: 'burst',
        width: 240,
        height: 240,
        pointsCount: 8,
        innerRadiusRatio: 0.58,
        fillColor: '#2BE0A5',
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          rotateY: [
            { id: `k_ey1_${Date.now()}`, time: t0, value: -35, easing: { type: 'bezier', p1x: 0.34, p1y: 1.4, p2x: 0.64, p2y: 1 } },
            { id: `k_ey2_${Date.now()}`, time: t1, value: 18, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('extrude3d'), createEffectInstance('deepGlow')],
      });
    } else {
      const id = `layer_rgb_${Date.now()}`;
      insertNewLayer({
        id,
        name: 'RGB Split Title',
        type: 'text',
        text: 'HYPER MOTION',
        fontFamily: 'Archivo',
        fontSize: 78,
        fontWeight: 800,
        fillColor: '#FFFFFF',
        letterSpacing: 6,
        startTime: t0,
        endTime: project.duration,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          scaleX: [
            { id: `k_gx1_${Date.now()}`, time: t0, value: 1.4, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
            { id: `k_gx2_${Date.now()}`, time: t1, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('chromaticAberration')],
      });
    }
  };

  // Timeline / Multi-Selection Actions
  const handleDuplicateSelected = useCallback(() => {
    if (selectedLayerIds.length === 0) return;
    const clones: Layer[] = [];
    selectedLayerIds.forEach((id) => {
      const orig = layers.find((l) => l.id === id);
      if (!orig) return;
      clones.push({
        ...orig,
        id: `layer_copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `${orig.name} Copy`,
        transform: {
          ...orig.transform,
          x: orig.transform.x + 28,
          y: orig.transform.y + 28,
        },
      });
    });
    pushHistory(project, [...clones, ...layers]);
    setSelectedLayerIds(clones.map((c) => c.id));
  }, [selectedLayerIds, layers, project, pushHistory]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedLayerIds.length === 0) return;
    const delSet = new Set(selectedLayerIds);
    const next = layers
      .filter((l) => !delSet.has(l.id))
      .map((l) => (l.parentId && delSet.has(l.parentId) ? { ...l, parentId: null } : l));
    pushHistory(project, next);
    setSelectedLayerIds([]);
  }, [selectedLayerIds, layers, project, pushHistory]);

  const handleGroupSelected = () => {
    if (selectedLayerIds.length < 2) return;
    const groupId = `layer_group_${Date.now()}`;
    const groupLayer: Layer = {
      id: groupId,
      name: `Group (${selectedLayerIds.length})`,
      type: 'group',
      maskMode: 'none',
      startTime: 0,
      endTime: project.duration,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {},
      effects: [],
    };
    const selSet = new Set(selectedLayerIds);
    const updated = layers.map((l) =>
      selSet.has(l.id) ? { ...l, parentId: groupId, isMask: false } : l
    );
    pushHistory(project, [groupLayer, ...updated]);
    setSelectedLayerIds([groupId]);
  };

  const handleGroupAndMaskSelected = () => {
    if (selectedLayerIds.length < 2) return;
    const selectedInOrder = layers.filter((l) => selectedLayerIds.includes(l.id));
    if (selectedInOrder.length < 2) return;
    // Bottom-most selected layer becomes the clipping mask
    const maskLayerId = selectedInOrder[selectedInOrder.length - 1].id;
    const groupId = `layer_mask_grp_${Date.now()}`;
    const groupLayer: Layer = {
      id: groupId,
      name: `Mask Group (${selectedInOrder.length})`,
      type: 'group',
      maskMode: 'clip',
      startTime: 0,
      endTime: project.duration,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {},
      effects: [],
    };
    const selSet = new Set(selectedLayerIds);
    const updated = layers.map((l) =>
      selSet.has(l.id)
        ? { ...l, parentId: groupId, isMask: l.id === maskLayerId }
        : l
    );
    pushHistory(project, [groupLayer, ...updated]);
    setSelectedLayerIds([groupId]);
  };

  const handleMaskSelected = () => {
    if (selectedLayerIds.length >= 2) {
      handleGroupAndMaskSelected();
      return;
    }
    if (selectedLayerIds.length !== 1) return;
    const idx = layers.findIndex((l) => l.id === selectedLayerIds[0]);
    if (idx < 0) return;
    const target = layers[idx];

    // If already inside a mask group, toggle its isMask role
    if (target.parentId) {
      const parent = layers.find((l) => l.id === target.parentId);
      if (parent && parent.type === 'group') {
        const next = layers.map((l) => {
          if (l.id === parent.id) return { ...l, maskMode: 'clip' as const };
          if (l.id === target.id) return { ...l, isMask: !l.isMask };
          return l;
        });
        pushHistory(project, next);
        return;
      }
    }

    // Otherwise pair with the layer directly below it into a Mask Group
    const below = layers[idx + 1];
    if (!below) {
      pushHistory(
        project,
        layers.map((l) => (l.id === target.id ? { ...l, isMask: !l.isMask } : l))
      );
      return;
    }
    const groupId = `layer_mask_${Date.now()}`;
    const groupLayer: Layer = {
      id: groupId,
      name: `Masked · ${target.name}`,
      type: 'group',
      maskMode: 'clip',
      startTime: Math.min(target.startTime, below.startTime),
      endTime: Math.max(target.endTime, below.endTime),
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {},
      effects: [],
    };
    const next = layers.map((l) => {
      if (l.id === target.id) return { ...l, parentId: groupId, isMask: true };
      if (l.id === below.id) return { ...l, parentId: groupId, isMask: false };
      return l;
    });
    pushHistory(project, [groupLayer, ...next]);
    setSelectedLayerIds([groupId]);
  };

  const handleUngroupSelected = () => {
    if (selectedLayerIds.length !== 1) return;
    const grp = layers.find((l) => l.id === selectedLayerIds[0] && l.type === 'group');
    if (!grp) return;
    const childIds: string[] = [];
    const next = layers
      .filter((l) => l.id !== grp.id)
      .map((l) => {
        if (l.parentId === grp.id) {
          childIds.push(l.id);
          return { ...l, parentId: grp.parentId, isMask: false };
        }
        return l;
      });
    pushHistory(project, next);
    setSelectedLayerIds(childIds);
  };

  const handleFillComposition = () => {
    if (selectedLayerIds.length === 0) return;
    const selSet = new Set(selectedLayerIds);
    const next = layers.map((l) => {
      if (!selSet.has(l.id)) return l;
      if (l.type === 'shape' || l.type === 'media') {
        return {
          ...l,
          width: project.width,
          height: project.height,
          transform: {
            ...l.transform,
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
          },
        };
      }
      const bounds = getLayerBounds(l);
      const scale = Math.max(
        project.width / Math.max(1, bounds.width),
        project.height / Math.max(1, bounds.height)
      );
      return {
        ...l,
        transform: {
          ...l.transform,
          x: 0,
          y: 0,
          scaleX: Number(scale.toFixed(2)),
          scaleY: Number(scale.toFixed(2)),
          rotation: 0,
        },
      };
    });
    pushHistory(project, next);
  };

  const handleFitComposition = () => {
    if (selectedLayerIds.length === 0) return;
    const selSet = new Set(selectedLayerIds);
    const next = layers.map((l) => {
      if (!selSet.has(l.id)) return l;
      const bounds = getLayerBounds(l);
      const scale = Math.min(
        project.width / Math.max(1, bounds.width),
        project.height / Math.max(1, bounds.height)
      );
      return {
        ...l,
        transform: {
          ...l.transform,
          x: 0,
          y: 0,
          scaleX: Number(scale.toFixed(2)),
          scaleY: Number(scale.toFixed(2)),
          rotation: 0,
        },
      };
    });
    pushHistory(project, next);
  };

  const handleCenterStage = () => {
    if (selectedLayerIds.length === 0) return;
    const selSet = new Set(selectedLayerIds);
    const next = layers.map((l) =>
      selSet.has(l.id) ? { ...l, transform: { ...l.transform, x: 0, y: 0 } } : l
    );
    pushHistory(project, next);
  };

  const handleFlipHorizontal = () => {
    if (selectedLayerIds.length === 0) return;
    const selSet = new Set(selectedLayerIds);
    const next = layers.map((l) =>
      selSet.has(l.id)
        ? { ...l, transform: { ...l.transform, scaleX: -l.transform.scaleX } }
        : l
    );
    pushHistory(project, next);
  };

  const handleFlipVertical = () => {
    if (selectedLayerIds.length === 0) return;
    const selSet = new Set(selectedLayerIds);
    const next = layers.map((l) =>
      selSet.has(l.id)
        ? { ...l, transform: { ...l.transform, scaleY: -l.transform.scaleY } }
        : l
    );
    pushHistory(project, next);
  };

  const handleResetTransform = () => {
    if (selectedLayerIds.length === 0) return;
    const selSet = new Set(selectedLayerIds);
    const next = layers.map((l) =>
      selSet.has(l.id)
        ? {
            ...l,
            transform: {
              x: 0,
              y: 0,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
              skewX: 0,
              skewY: 0,
              anchorX: 0,
              anchorY: 0,
              opacity: 100,
            },
          }
        : l
    );
    pushHistory(project, next);
  };

  const handleReorderLayer = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= layers.length ||
      toIndex >= layers.length
    ) {
      return;
    }
    const copy = [...layers];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    pushHistory(project, copy);
  };

  const handleSplitAtPlayhead = () => {
    const splitT = Number(currentTime.toFixed(2));
    const targetIds =
      selectedLayerIds.length > 0
        ? selectedLayerIds
        : (() => {
            const under = layers.find(
              (l) => l.visible && splitT > l.startTime + 0.03 && splitT < l.endTime - 0.03
            );
            return under ? [under.id] : [];
          })();

    if (targetIds.length === 0) return;

    const stamp = Date.now();
    const next: Layer[] = [];
    const newRightIds: string[] = [];
    let didSplit = false;

    for (let idx = 0; idx < layers.length; idx++) {
      const l = layers[idx];
      if (
        targetIds.includes(l.id) &&
        splitT > l.startTime + 0.03 &&
        splitT < l.endTime - 0.03
      ) {
        didSplit = true;
        const clonedKfs: Partial<Record<NumericAnimatableProp, Keyframe<number>[]>> = {};
        (Object.entries(l.keyframes) as Array<
          [NumericAnimatableProp, Keyframe<number>[]]
        >).forEach(([prop, arr]) => {
          if (arr && arr.length > 0) {
            clonedKfs[prop] = arr.map((k, ki) => ({
              ...k,
              id: `${k.id}_sp_${stamp}_${idx}_${ki}`,
              easing: { ...k.easing },
            }));
          }
        });
        const clonedEffects = l.effects.map((fx, fi) => ({
          ...fx,
          id: `${fx.id}_sp_${stamp}_${idx}_${fi}`,
          params: { ...fx.params },
        }));

        const rightId = `layer_split_${stamp}_${idx}`;
        newRightIds.push(rightId);

        next.push({
          ...l,
          id: rightId,
          name: `${l.name} (2)`,
          startTime: splitT,
          transform: { ...l.transform },
          keyframes: clonedKfs,
          effects: clonedEffects,
        });
        next.push({
          ...l,
          endTime: splitT,
        });
      } else {
        next.push(l);
      }
    }

    if (didSplit) {
      pushHistory(project, next);
      if (newRightIds.length > 0) {
        setSelectedLayerIds(newRightIds);
      }
    }
  };

  const handleTrimLeft = () => {
    const next = layers.map((l) =>
      selectedLayerIds.includes(l.id) && currentTime < l.endTime - 0.2
        ? { ...l, startTime: Number(currentTime.toFixed(2)) }
        : l
    );
    pushHistory(project, next);
  };

  const handleTrimRight = () => {
    const next = layers.map((l) =>
      selectedLayerIds.includes(l.id) && currentTime > l.startTime + 0.2
        ? { ...l, endTime: Number(currentTime.toFixed(2)) }
        : l
    );
    pushHistory(project, next);
  };

  const handleMoveLayerOrder = (dir: 'up' | 'down') => {
    if (selectedLayerIds.length !== 1) return;
    const idx = layers.findIndex((l) => l.id === selectedLayerIds[0]);
    if (idx < 0) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= layers.length) return;
    const copy = [...layers];
    [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];
    pushHistory(project, copy);
  };

  // Copy / Paste Effects, Style, Keyframes, Presets, and XML Handlers
  const handleCopyEffects = (effects: EffectInstance[]) => {
    setCopiedEffects(
      effects.map((fx) => ({
        ...fx,
        params: { ...fx.params },
      }))
    );
  };

  const handlePasteEffects = (layerId: string) => {
    if (copiedEffects.length === 0) return;
    const cloned = copiedEffects.map((fx, i) => ({
      ...fx,
      id: `fx_paste_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      params: { ...fx.params },
    }));
    updateLayer(
      layerId,
      (prev) => ({
        ...prev,
        effects: [...prev.effects, ...cloned],
      }),
      true
    );
  };

  const handleCopyStyle = (layer: Layer) => {
    setCopiedStyle({
      fillColor: layer.fillColor,
      fillGradient: layer.fillGradient ? { ...layer.fillGradient } : undefined,
      strokeColor: layer.strokeColor,
      strokeWidth: layer.strokeWidth,
      blendMode: layer.blendMode,
      opacity: layer.transform.opacity,
      shadow: layer.shadow ? { ...layer.shadow } : undefined,
    });
  };

  const handlePasteStyle = (layerId: string) => {
    if (!copiedStyle) return;
    updateLayer(
      layerId,
      (prev) => ({
        ...prev,
        fillColor: copiedStyle.fillColor ?? prev.fillColor,
        fillGradient: copiedStyle.fillGradient
          ? { ...copiedStyle.fillGradient }
          : prev.fillGradient,
        strokeColor: copiedStyle.strokeColor ?? prev.strokeColor,
        strokeWidth: copiedStyle.strokeWidth ?? prev.strokeWidth,
        blendMode: copiedStyle.blendMode,
        shadow: copiedStyle.shadow ? { ...copiedStyle.shadow } : prev.shadow,
        transform: {
          ...prev.transform,
          opacity: copiedStyle.opacity,
        },
      }),
      true
    );
  };

  const handleCopyKeyframes = (layer: Layer) => {
    const copy: Partial<Record<NumericAnimatableProp, Keyframe<number>[]>> = {};
    (Object.entries(layer.keyframes) as Array<[NumericAnimatableProp, Keyframe<number>[]]>).forEach(
      ([prop, kfs]) => {
        if (kfs && kfs.length > 0) {
          copy[prop] = kfs.map((k) => ({ ...k, easing: { ...k.easing } }));
        }
      }
    );
    setCopiedKeyframes(copy);
  };

  const handlePasteKeyframes = (layerId: string) => {
    if (!copiedKeyframes) return;
    const stamped: Partial<Record<NumericAnimatableProp, Keyframe<number>[]>> = {};
    (Object.entries(copiedKeyframes) as Array<[NumericAnimatableProp, Keyframe<number>[]]>).forEach(
      ([prop, kfs]) => {
        if (kfs && kfs.length > 0) {
          stamped[prop] = kfs.map((k, i) => ({
            ...k,
            id: `kf_p_${Date.now()}_${prop}_${i}`,
            easing: { ...k.easing },
          }));
        }
      }
    );
    updateLayer(
      layerId,
      (prev) => ({
        ...prev,
        keyframes: { ...prev.keyframes, ...stamped },
      }),
      true
    );
  };

  const handleApplyPreset = (layerId: string, preset: LayerPreset) => {
    updateLayer(
      layerId,
      (prev) => {
        const nextEffects = preset.effects
          ? [
              ...prev.effects,
              ...preset.effects.map((fx, i) => ({
                ...fx,
                id: `fx_pre_${Date.now()}_${i}`,
                params: { ...fx.params },
              })),
            ]
          : prev.effects;

        const nextKeyframes = { ...prev.keyframes };
        if (preset.keyframes) {
          const offset = prev.startTime;
          (Object.entries(preset.keyframes) as Array<
            [NumericAnimatableProp, Keyframe<number>[]]
          >).forEach(([prop, kfs]) => {
            if (kfs && kfs.length > 0) {
              nextKeyframes[prop] = kfs.map((k, i) => ({
                ...k,
                id: `kf_pre_${Date.now()}_${prop}_${i}`,
                time: Number(Math.min(prev.endTime, offset + k.time).toFixed(2)),
                easing: { ...k.easing },
              }));
            }
          });
        }

        const sp = preset.stylePatch || {};
        return {
          ...prev,
          ...sp,
          effects: nextEffects,
          keyframes: nextKeyframes,
        };
      },
      true
    );
  };

  const handleSaveCustomPreset = (layer: Layer) => {
    const newPreset: LayerPreset = {
      id: `custom_pre_${Date.now()}`,
      name: `${layer.name} Preset`,
      category: 'Custom',
      description: `${layer.effects.length} effects · custom style & motion`,
      effects: layer.effects.map((fx) => ({ ...fx, params: { ...fx.params } })),
      keyframes: Object.fromEntries(
        Object.entries(layer.keyframes).map(([prop, arr]) => [
          prop,
          (arr || []).map((k) => ({
            ...k,
            time: Number(Math.max(0, k.time - layer.startTime).toFixed(2)),
            easing: { ...k.easing },
          })),
        ])
      ),
      stylePatch: {
        fillColor: layer.fillColor,
        fillGradient: layer.fillGradient ? { ...layer.fillGradient } : undefined,
        strokeColor: layer.strokeColor,
        strokeWidth: layer.strokeWidth,
        blendMode: layer.blendMode,
        shadow: layer.shadow ? { ...layer.shadow } : undefined,
      },
    };
    setCustomPresets((prev) => [newPreset, ...prev]);
  };

  const handleDeleteCustomPreset = (presetId: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== presetId));
  };

  const handleExportLayerXML = (layer: Layer) => {
    const xml = serializeLayerPresetToXML(layer);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layer.name.replace(/\s+/g, '_').toLowerCase()}.preset.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportXMLFile = (file: File, targetLayerId?: string) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseXMLToProjectOrLayers(String(reader.result));
        if (parsed.kind === 'project' && parsed.project) {
          const impProj: ProjectConfig = {
            ...parsed.project,
            id: `proj_xml_${Date.now()}`,
          };
          const record: SavedProjectRecord = {
            id: impProj.id,
            updatedAt: Date.now(),
            project: impProj,
            layers: parsed.layers,
          };
          setSavedProjects((prev) => [record, ...prev]);
          setActiveProjectId(impProj.id);
          pushHistory(impProj, parsed.layers);
          setSelectedLayerIds(parsed.layers[0] ? [parsed.layers[0].id] : []);
          setCurrentTime(0);
          setScreen('editor');
        } else if (parsed.layers.length > 0) {
          if (targetLayerId && screen === 'editor') {
            const tpl = parsed.layers[0];
            updateLayer(
              targetLayerId,
              (prev) => ({
                ...prev,
                effects: [
                  ...prev.effects,
                  ...tpl.effects.map((fx, i) => ({
                    ...fx,
                    id: `fx_xml_${Date.now()}_${i}`,
                  })),
                ],
                keyframes: { ...prev.keyframes, ...tpl.keyframes },
                blendMode: tpl.blendMode || prev.blendMode,
                fillColor: tpl.fillColor || prev.fillColor,
              }),
              true
            );
          } else if (screen === 'editor') {
            const stamped = parsed.layers.map((l, i) => ({
              ...l,
              id: `layer_xml_${Date.now()}_${i}`,
            }));
            pushHistory(project, [...stamped, ...layers]);
            setSelectedLayerIds([stamped[0].id]);
          } else {
            const impProj: ProjectConfig = {
              id: `proj_xml_${Date.now()}`,
              name: file.name.replace(/\.xml$/i, ''),
              mode: 'project',
              width: 1280,
              height: 720,
              fps: 60,
              duration: 6,
              background: 'black',
              aspectRatio: '16:9',
              beatMarkers: [],
            };
            const record: SavedProjectRecord = {
              id: impProj.id,
              updatedAt: Date.now(),
              project: impProj,
              layers: parsed.layers,
            };
            setSavedProjects((prev) => [record, ...prev]);
            setActiveProjectId(impProj.id);
            pushHistory(impProj, parsed.layers);
            setSelectedLayerIds([parsed.layers[0].id]);
            setCurrentTime(0);
            setScreen('editor');
          }
        }
      } catch {
        // Invalid XML ignored gracefully
      }
    };
    reader.readAsText(file);
  };

  const openProjectInEditor = (record: SavedProjectRecord) => {
    setIsPlaying(false);
    setActiveProjectId(record.id);
    setProject(record.project);
    setLayers(record.layers);
    setPast([]);
    setFuture([]);
    setSelectedLayerIds([]);
    setActiveBottomPanel('menu');
    setCurrentTime(0);
    setScreen('editor');
  };

  const handleLaunchTutorial = (tutorialId: string) => {
    setIsPlaying(false);
    const now = Date.now();
    const baseTransform = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      skewX: 0,
      skewY: 0,
      anchorX: 0,
      anchorY: 0,
      opacity: 100,
    };

    if (tutorialId === 'tut_ai') {
      const freshId = `proj_ai_${now}`;
      const def = createDefaultProject();
      setActiveProjectId(freshId);
      setProject({ ...def.project, id: freshId, name: 'AI Motion Lesson' });
      setLayers([]);
      setPast([]);
      setFuture([]);
      setSelectedLayerIds([]);
      setCurrentTime(0);
      setScreen('editor');
      setAiModalState({ open: true, mode: 'scene' });
      return;
    }

    if (tutorialId === 'tut_mask') {
      const maskProjId = `proj_tut_mask_${now}`;
      const grpId = `tut_grp_${now}`;
      const maskCircleId = `tut_mask_${now}`;
      const fillTextId = `tut_txt_${now}`;
      const bgId = `tut_bg_${now}`;
      const tutProj: ProjectConfig = {
        id: maskProjId,
        name: 'Tutorial 02 · Mask Clipping',
        mode: 'project',
        width: 1280,
        height: 720,
        fps: 60,
        duration: 5,
        background: 'slate',
        aspectRatio: '16:9',
        beatMarkers: [1, 2.5, 4],
      };
      const tutLayers: Layer[] = [
        {
          id: grpId,
          name: 'Mask Group Demo',
          type: 'group',
          maskMode: 'clip',
          startTime: 0,
          endTime: 5,
          visible: true,
          locked: false,
          parentId: null,
          blendMode: 'normal',
          transform: baseTransform,
          keyframes: {},
          effects: [],
        },
        {
          id: fillTextId,
          name: 'REVEALED TITLE',
          type: 'text',
          text: 'MASKED MOTION',
          fontFamily: 'Outfit',
          fontSize: 92,
          fontWeight: 800,
          letterSpacing: 6,
          fillColor: '#2BE0A5',
          startTime: 0,
          endTime: 5,
          visible: true,
          locked: false,
          parentId: grpId,
          isMask: false,
          blendMode: 'normal',
          transform: baseTransform,
          keyframes: {},
          effects: [createEffectInstance('glow')],
        },
        {
          id: maskCircleId,
          name: 'Reveal Circle Mask',
          type: 'shape',
          shapeKind: 'circle',
          width: 340,
          height: 340,
          fillColor: '#FFFFFF',
          startTime: 0,
          endTime: 5,
          visible: true,
          locked: false,
          parentId: grpId,
          isMask: true,
          blendMode: 'normal',
          transform: baseTransform,
          keyframes: {
            x: [
              { id: 'tm_1', time: 0, value: -340, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
              { id: 'tm_2', time: 2.2, value: 340, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
              { id: 'tm_3', time: 4.5, value: 0, easing: { type: 'bezier', p1x: 0.34, p1y: 1.4, p2x: 0.64, p2y: 1 } },
            ],
          },
          effects: [],
        },
        {
          id: bgId,
          name: 'Background Card',
          type: 'shape',
          shapeKind: 'roundedRect',
          width: 960,
          height: 440,
          cornerRadius: 36,
          fillColor: '#1E2436',
          strokeColor: '#2BE0A5',
          strokeWidth: 3,
          startTime: 0,
          endTime: 5,
          visible: true,
          locked: false,
          parentId: null,
          blendMode: 'normal',
          transform: baseTransform,
          keyframes: {},
          effects: [],
        },
      ];
      setActiveProjectId(maskProjId);
      setProject(tutProj);
      setLayers(tutLayers);
      setPast([]);
      setFuture([]);
      setSelectedLayerIds([maskCircleId]);
      setActiveBottomPanel('transform');
      setCurrentTime(1.1);
      setScreen('editor');
      return;
    }

    if (tutorialId === 'tut_null_cam') {
      const ncProjId = `proj_tut_nc_${now}`;
      const camId = `tut_cam_${now}`;
      const nullId = `tut_null_${now}`;
      const ringId = `tut_ring_${now}`;
      const titleId = `tut_title_${now}`;
      const tutProj: ProjectConfig = {
        id: ncProjId,
        name: 'Tutorial 03 · Null & Camera',
        mode: 'project',
        width: 1280,
        height: 720,
        fps: 60,
        duration: 5,
        background: 'slate',
        aspectRatio: '16:9',
        beatMarkers: [0.8, 2.4, 4.0],
      };
      const tutLayers: Layer[] = [
        {
          id: camId,
          name: 'Camera',
          type: 'camera',
          cameraActive: true,
          startTime: 0,
          endTime: 5,
          visible: true,
          locked: false,
          parentId: null,
          blendMode: 'normal',
          transform: baseTransform,
          keyframes: {
            scaleX: [
              { id: 'tc_1', time: 0, value: 1.32, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
              { id: 'tc_2', time: 2.5, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
            ],
            scaleY: [
              { id: 'tc_3', time: 0, value: 1.32, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
              { id: 'tc_4', time: 2.5, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
            ],
          },
          effects: [],
        },
        {
          id: nullId,
          name: 'Master Null Rig',
          type: 'null',
          startTime: 0,
          endTime: 5,
          visible: true,
          locked: false,
          parentId: null,
          blendMode: 'normal',
          transform: baseTransform,
          keyframes: {
            rotation: [
              { id: 'tn_1', time: 0, value: -14, easing: { type: 'bezier', p1x: 0.34, p1y: 1.4, p2x: 0.64, p2y: 1 } },
              { id: 'tn_2', time: 2.2, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
            ],
          },
          effects: [],
        },
        {
          id: titleId,
          name: 'Rigged Headline',
          type: 'text',
          text: 'CAMERA RIG',
          fontFamily: 'Outfit',
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: 4,
          fillColor: '#FFFFFF',
          startTime: 0,
          endTime: 5,
          visible: true,
          locked: false,
          parentId: nullId,
          blendMode: 'normal',
          transform: baseTransform,
          keyframes: {},
          effects: [],
        },
        {
          id: ringId,
          name: 'Orbit Frame',
          type: 'shape',
          shapeKind: 'roundedRect',
          width: 560,
          height: 220,
          cornerRadius: 28,
          fillColor: '#2BE0A5',
          strokeColor: '#FFFFFF',
          strokeWidth: 4,
          startTime: 0,
          endTime: 5,
          visible: true,
          locked: false,
          parentId: nullId,
          blendMode: 'normal',
          transform: { ...baseTransform, opacity: 25 },
          keyframes: {},
          effects: [],
        },
      ];
      setActiveProjectId(ncProjId);
      setProject(tutProj);
      setLayers(tutLayers);
      setPast([]);
      setFuture([]);
      setSelectedLayerIds([camId]);
      setActiveBottomPanel('transform');
      setCurrentTime(0.6);
      setScreen('editor');
      return;
    }

    // Default tutorial 01: Bezier Overshoot Easing
    const easProjId = `proj_tut_eas_${now}`;
    const circleId = `tut_circle_${now}`;
    const labelId = `tut_label_${now}`;
    const tutProj: ProjectConfig = {
      id: easProjId,
      name: 'Tutorial 01 · Bezier Curve',
      mode: 'project',
      width: 1280,
      height: 720,
      fps: 60,
      duration: 4,
      background: 'slate',
      aspectRatio: '16:9',
      beatMarkers: [0.5, 1.5, 2.5],
    };
    const tutLayers: Layer[] = [
      {
        id: labelId,
        name: 'Overshoot Title',
        type: 'text',
        text: 'CURVE SNAP',
        fontFamily: 'Outfit',
        fontSize: 64,
        fontWeight: 800,
        letterSpacing: 5,
        fillColor: '#FFFFFF',
        startTime: 0,
        endTime: 4,
        visible: true,
        locked: false,
        parentId: circleId,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {},
        effects: [],
      },
      {
        id: circleId,
        name: 'Bounce Pill',
        type: 'shape',
        shapeKind: 'pill',
        width: 520,
        height: 150,
        fillColor: '#2BE0A5',
        startTime: 0,
        endTime: 4,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          x: [
            { id: 'te_1', time: 0.2, value: -380, easing: { type: 'bezier', p1x: 0.34, p1y: 1.5, p2x: 0.64, p2y: 1 } },
            { id: 'te_2', time: 1.6, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
          scaleX: [
            { id: 'te_3', time: 0.2, value: 0.5, easing: { type: 'bezier', p1x: 0.34, p1y: 1.5, p2x: 0.64, p2y: 1 } },
            { id: 'te_4', time: 1.6, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [],
      },
    ];
    setActiveProjectId(easProjId);
    setProject(tutProj);
    setLayers(tutLayers);
    setPast([]);
    setFuture([]);
    setSelectedLayerIds([circleId]);
    setActiveBottomPanel('easing');
    setCurrentTime(0.9);
    setScreen('editor');
  };

  // Global keyboard shortcuts (active in editor)
  useEffect(() => {
    if (screen !== 'editor') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, handleUndo, handleRedo, handleDeleteSelected]);

  const handleBackNavigation = () => {
    if (selectedLayer && activeBottomPanel !== 'menu') {
      setActiveBottomPanel('menu');
    } else if (selectedLayerIds.length > 0) {
      setSelectedLayerIds([]);
    } else {
      setIsPlaying(false);
      setScreen('home');
    }
  };

  const handleApplySmoothedMotion = useCallback(
    (
      smoothedLayers: Array<{ layerId: string; keyframes: Layer['keyframes'] }>,
      summary?: string
    ) => {
      if (!smoothedLayers || smoothedLayers.length === 0) return;
      const patchMap = new Map(smoothedLayers.map((s) => [s.layerId, s]));
      const nextLayers = layers.map((l) => {
        const patch = patchMap.get(l.id);
        if (!patch) return l;
        return {
          ...l,
          keyframes: { ...l.keyframes, ...patch.keyframes },
        };
      });
      pushHistory(project, nextLayers);
      setIsPlaying(true);
      if (summary) showAiToast(summary);
    },
    [layers, project, pushHistory, showAiToast]
  );

  const handleQuickAISmoothLayer = useCallback(
    async (layerId: string): Promise<string | null> => {
      const target = layers.find((l) => l.id === layerId);
      if (!target) return null;
      const res = await fetch('/api/ai/smooth-motion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layers: [target],
          smoothStyle: 'Silky Cinema',
          intensity: 85,
          duration: project.duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI Smooth request failed');
      }
      if (Array.isArray(data.smoothedLayers)) {
        handleApplySmoothedMotion(data.smoothedLayers, data.summary);
      }
      return data.summary || 'AI Smooth Applied';
    },
    [layers, project.duration, handleApplySmoothedMotion]
  );

  const handleApplyAIPolishEffects = useCallback(
    (
      layerId: string,
      patch: {
        fillColor: string;
        fillGradient?: Layer['fillGradient'];
        strokeColor: string;
        strokeWidth: number;
        blendMode: BlendMode;
        shadow?: Layer['shadow'];
        effects: EffectInstance[];
      },
      summary: string
    ) => {
      const nextLayers = layers.map((l) => {
        if (l.id !== layerId) return l;
        return {
          ...l,
          fillColor: patch.fillColor || l.fillColor,
          fillGradient: patch.fillGradient ?? l.fillGradient,
          strokeColor: patch.strokeColor || l.strokeColor,
          strokeWidth: patch.strokeWidth,
          blendMode: patch.blendMode || l.blendMode,
          shadow: patch.shadow ?? l.shadow,
          effects: [...l.effects, ...patch.effects],
        };
      });
      pushHistory(project, nextLayers);
      setActiveBottomPanel('effects');
      showAiToast(summary);
    },
    [layers, project, pushHistory, showAiToast]
  );

  const handleApplyAICameraRig = useCallback(
    (cameraLayer: Layer, beatMarkers: number[], summary: string) => {
      const withoutOldCam = layers.filter((l) => l.type !== 'camera');
      const nextProj: ProjectConfig = {
        ...project,
        beatMarkers: beatMarkers.length > 0 ? beatMarkers : project.beatMarkers,
      };
      const nextLayers = [cameraLayer, ...withoutOldCam];
      pushHistory(nextProj, nextLayers);
      setSelectedLayerIds([cameraLayer.id]);
      setCurrentTime(0);
      setIsPlaying(true);
      showAiToast(summary);
    },
    [layers, project, pushHistory, showAiToast]
  );

  const handleApplyAITypography = useCallback(
    (textLayers: Layer[], beatMarkers: number[], summary: string) => {
      if (textLayers.length === 0) return;
      const maxEnd = textLayers.reduce((mx, l) => Math.max(mx, l.endTime || 0), project.duration);
      const mergedMarkers = Array.from(
        new Set([...project.beatMarkers, ...beatMarkers])
      ).sort((a, b) => a - b);
      const nextProj: ProjectConfig = {
        ...project,
        duration: Math.max(project.duration, maxEnd),
        beatMarkers: mergedMarkers,
      };
      const nextLayers = [...textLayers, ...layers];
      pushHistory(nextProj, nextLayers);
      setSelectedLayerIds([textLayers[0].id]);
      setScreen('editor');
      setCurrentTime(0);
      setIsPlaying(true);
      showAiToast(summary);
    },
    [layers, project, pushHistory, showAiToast]
  );

  const canSplitAtPlayhead = layers.some(
    (l) =>
      (selectedLayerIds.length > 0 ? selectedLayerIds.includes(l.id) : l.visible) &&
      currentTime > l.startTime + 0.03 &&
      currentTime < l.endTime - 0.03
  );

  return (
    <div className="h-[100dvh] w-screen bg-[#12151E] text-[#EEF1F7] flex flex-col overflow-hidden">
      {screen === 'home' ? (
        <HomeScreen
          savedProjects={savedProjects}
          onOpenProject={openProjectInEditor}
          onDuplicateProject={(rec) => {
            const dupId = `proj_${Date.now()}`;
            const dup: SavedProjectRecord = {
              id: dupId,
              updatedAt: Date.now(),
              project: { ...rec.project, id: dupId, name: `${rec.project.name} Copy` },
              layers: rec.layers.map((l) => ({ ...l })),
            };
            setSavedProjects((prev) => [dup, ...prev]);
          }}
          onDeleteProject={(id) => {
            setSavedProjects((prev) => {
              const filtered = prev.filter((p) => p.id !== id);
              if (id === activeProjectId) {
                setActiveProjectId(filtered[0]?.id ?? '');
              }
              return filtered;
            });
          }}
          onCreateNewProject={() =>
            setProjectModalState({ open: true, mode: 'create' })
          }
          onOpenAIGenerate={() =>
            setAiModalState({ open: true, mode: 'scene' })
          }
          onOpenAITrailer={() =>
            setAiModalState({ open: true, mode: 'trailer' })
          }
          onOpenAIScript={() =>
            setAiModalState({ open: true, mode: 'typography' })
          }
          onOpenTrailerTemplate={(trailerId) => {
            const { project: trProj, layers: trLayers } = createTrailerProject(trailerId);
            setIsPlaying(false);
            setActiveProjectId(trProj.id);
            setSavedProjects((prev) => [
              { id: trProj.id, updatedAt: Date.now(), project: trProj, layers: trLayers },
              ...prev,
            ]);
            setProject(trProj);
            setLayers(trLayers);
            setPast([]);
            setFuture([]);
            setSelectedLayerIds(trLayers[1] ? [trLayers[1].id] : []);
            setActiveBottomPanel('menu');
            setCurrentTime(0);
            setScreen('editor');
          }}
          onLaunchTutorial={handleLaunchTutorial}
          onImportXMLFile={(file) => handleImportXMLFile(file)}
        />
      ) : (
        <>
          {/* Top Studio Header */}
          <TopBar
            project={project}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            selectedLayers={layers.filter((l) => selectedLayerIds.includes(l.id))}
            activeBottomPanel={activeBottomPanel}
            onBackClick={handleBackNavigation}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onRenameProject={(name) =>
              pushHistory({ ...project, name }, layers)
            }
            onOpenNewProject={() =>
              setProjectModalState({ open: true, mode: 'create' })
            }
            onOpenSettings={() =>
              setProjectModalState({ open: true, mode: 'edit' })
            }
            onOpenPreview={() => {
              setIsPlaying(false);
              setPreviewOpen(true);
            }}
            onOpenAI={() => setAiModalState({ open: true, mode: 'scene' })}
            onOpenAIMode={(mode) => setAiModalState({ open: true, mode })}
            onOpenExport={() => setExportModalOpen(true)}
            onDeleteSelected={handleDeleteSelected}
            onFillComposition={handleFillComposition}
            onFitComposition={handleFitComposition}
            onCenterStage={handleCenterStage}
            onFlipHorizontal={handleFlipHorizontal}
            onFlipVertical={handleFlipVertical}
            onResetTransform={handleResetTransform}
            onMaskSelected={handleMaskSelected}
            onGroupSelected={handleGroupSelected}
            onGroupAndMaskSelected={handleGroupAndMaskSelected}
            onUngroupSelected={handleUngroupSelected}
            onDuplicateSelected={handleDuplicateSelected}
            copiedEffectsCount={copiedEffects.length}
            onCopyEffects={() => {
              if (selectedLayer) handleCopyEffects(selectedLayer.effects);
            }}
            onPasteEffects={() => {
              if (selectedLayer) handlePasteEffects(selectedLayer.id);
            }}
          />

          {/* Full-Width Stage Preview Viewport (No Right-Side Inspector!) */}
          <StageViewport
            project={project}
            layers={layers}
            currentTime={currentTime}
            selectedLayerIds={selectedLayerIds}
            showGrid={showGrid}
            drawingMode={drawingMode}
            selectionMode={selectionMode}
            axisLock={axisLock}
            onChangeAxisLock={setAxisLock}
            onExitSelectionMode={() => setSelectionMode(false)}
            onSelectLayers={(ids) => {
              setSelectedLayerIds(ids);
              if (ids.length === 0) {
                setSelectionMode(false);
                setActiveBottomPanel('menu');
              }
            }}
            onUpdateLayerTransform={handleStageTransformChange}
            onFinishDrawing={handleFinishDrawing}
            onCancelDrawing={() => setDrawingMode('none')}
            onGroupSelected={handleGroupSelected}
            onMaskSelected={handleMaskSelected}
            onGroupAndMaskSelected={handleGroupAndMaskSelected}
            onDuplicateSelected={handleDuplicateSelected}
            onDeleteSelected={handleDeleteSelected}
            canvasRefOut={stageCanvasRef}
          />

          {/* Transport Strip (Playback + Trim/Split/Order/Delete/Zoom above clean Timeline) */}
          <TransportBar
            isPlaying={isPlaying}
            isLooping={isLooping}
            currentTime={currentTime}
            duration={project.duration}
            fps={project.fps}
            showGrid={showGrid}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            hasSelectedLayer={selectedLayerIds.length > 0}
            selectedCount={selectedLayerIds.length}
            canSplitAtPlayhead={canSplitAtPlayhead}
            pxPerSec={pxPerSec}
            onChangeZoom={setPxPerSec}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onToggleLoop={() => setIsLooping((l) => !l)}
            onToggleGrid={() => setShowGrid((g) => !g)}
            onPrevKeyframe={() => handleJumpKeyframe(-1)}
            onNextKeyframe={() => handleJumpKeyframe(1)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onDuplicateSelected={handleDuplicateSelected}
            onToggleBeatMarker={() => {
              const snap = Number(currentTime.toFixed(2));
              const exists = project.beatMarkers.some((b) => Math.abs(b - snap) < 0.1);
              const nextMarkers = exists
                ? project.beatMarkers.filter((b) => Math.abs(b - snap) >= 0.1)
                : [...project.beatMarkers, snap].sort((a, b) => a - b);
              pushHistory({ ...project, beatMarkers: nextMarkers }, layers);
            }}
            onOpenAddDrawer={() => setAddDrawerOpen(true)}
            onTrimLeft={handleTrimLeft}
            onSplitAtPlayhead={handleSplitAtPlayhead}
            onTrimRight={handleTrimRight}
            onMoveLayerUp={() => handleMoveLayerOrder('up')}
            onMoveLayerDown={() => handleMoveLayerOrder('down')}
            onDeleteSelected={handleDeleteSelected}
          />

          {/* Clean Multi-Track Timeline (Hold layer to multi-select or drag onto any track) */}
          <TimelinePanel
            project={project}
            layers={layers}
            currentTime={currentTime}
            selectedLayerIds={selectedLayerIds}
            selectionMode={selectionMode}
            pxPerSec={pxPerSec}
            compact={Boolean(selectedLayer)}
            onSeek={(t) => {
              setIsPlaying(false);
              setCurrentTime(t);
            }}
            onSelectLayer={(id, multi) => {
              if (multi) {
                setSelectedLayerIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                );
              } else {
                setSelectedLayerIds([id]);
              }
            }}
            onEnsureLayerSelected={(id) => {
              setSelectedLayerIds((prev) =>
                prev.includes(id) ? prev : [...prev, id]
              );
            }}
            onEnterSelectionMode={() => setSelectionMode(true)}
            onExitSelectionMode={() => {
              setSelectionMode(false);
              setSelectedLayerIds([]);
            }}
            onToggleVisibility={(id) =>
              updateLayer(id, (l) => ({ ...l, visible: !l.visible }), true)
            }
            onUpdateLayerTiming={(id, startTime, endTime) => {
              updateLayer(id, (l) => ({ ...l, startTime, endTime }));
              if (endTime > project.duration) {
                setProject((p) => ({
                  ...p,
                  duration: Math.min(120, Number(Math.max(p.duration, endTime).toFixed(2))),
                }));
              }
            }}
            onReorderLayer={handleReorderLayer}
            onOpenAddDrawer={() => setAddDrawerOpen(true)}
          />

          {/* Bottom Control Dock — ALL layer settings & controls open strictly at the bottom! */}
          {selectedLayer && (
            <BottomControlDock
              layer={selectedLayer}
              allLayers={layers}
              currentTime={currentTime}
              activePanel={activeBottomPanel}
              axisLock={axisLock}
              copiedEffects={copiedEffects}
              copiedStyle={copiedStyle}
              copiedKeyframes={copiedKeyframes}
              copiedCurve={copiedCurve}
              customPresets={customPresets}
              onChangeAxisLock={setAxisLock}
              onChangePanel={setActiveBottomPanel}
              onDeselectLayer={() => setSelectedLayerIds([])}
              onUpdateLayer={(id, fn) => updateLayer(id, fn)}
              onToggleKeyframe={handleToggleKeyframe}
              onSeek={(t) => {
                setIsPlaying(false);
                setCurrentTime(t);
              }}
              onTrimLeft={handleTrimLeft}
              onSplit={handleSplitAtPlayhead}
              onTrimRight={handleTrimRight}
              onOpenAIForLayer={() => setAiModalState({ open: true, mode: 'layer' })}
              onQuickAISmoothLayer={handleQuickAISmoothLayer}
              onOpenAIMode={(mode) => setAiModalState({ open: true, mode })}
              onCopyEffects={handleCopyEffects}
              onPasteEffects={handlePasteEffects}
              onCopyStyle={handleCopyStyle}
              onPasteStyle={handlePasteStyle}
              onCopyKeyframes={handleCopyKeyframes}
              onPasteKeyframes={handlePasteKeyframes}
              onCopyCurve={(curve) => setCopiedCurve({ ...curve })}
              onApplyPreset={handleApplyPreset}
              onSaveCustomPreset={handleSaveCustomPreset}
              onDeleteCustomPreset={handleDeleteCustomPreset}
              onExportLayerXML={handleExportLayerXML}
              onImportPresetXML={(file) =>
                handleImportXMLFile(file, selectedLayer.id)
              }
            />
          )}
        </>
      )}

      {/* Creation Sheet / Add Layer Drawer */}
      <AddLayerDrawer
        open={addDrawerOpen}
        onClose={() => setAddDrawerOpen(false)}
        onAddShape={handleAddShape}
        onAddText={() => handleAddText()}
        onAddObject={handleAddObject}
        onAddMediaFile={handleAddMediaFile}
        onAddAudioFile={handleAddAudioFile}
        onAddElementPreset={handleAddElementPreset}
        onStartDrawing={(mode) => setDrawingMode(mode)}
        onOpenAI={() => setAiModalState({ open: true, mode: 'scene' })}
      />

      {/* Gemini AI Motion Graphics Studio Modal */}
      <AIMotionModal
        open={aiModalState.open}
        initialMode={aiModalState.mode}
        project={project}
        layers={layers}
        selectedLayer={selectedLayer}
        currentTime={currentTime}
        onClose={() => setAiModalState((s) => ({ ...s, open: false }))}
        onApplyGeneratedScene={(data, mode, generatedKind) => {
          const effectiveMode = screen === 'home' ? 'replace' : mode;
          const targetId = screen === 'home' ? `proj_ai_${Date.now()}` : activeProjectId;
          const maxLayerEnd = data.layers.reduce(
            (mx, l) => Math.max(mx, l.endTime || 0),
            generatedKind === 'trailer' ? 6 : project.duration
          );
          const nextProj: ProjectConfig = {
            ...project,
            id: targetId,
            name: effectiveMode === 'replace' ? data.sceneTitle : project.name,
            background: effectiveMode === 'replace' ? data.background : project.background,
            duration:
              effectiveMode === 'replace'
                ? Math.max(4, maxLayerEnd)
                : Math.max(project.duration, maxLayerEnd),
            beatMarkers:
              data.beatMarkers.length > 0 ? data.beatMarkers : project.beatMarkers,
          };
          const nextLayers =
            effectiveMode === 'replace' ? data.layers : [...data.layers, ...layers];
          setActiveProjectId(targetId);
          pushHistory(nextProj, nextLayers);
          if (data.layers[0]) {
            setSelectedLayerIds([data.layers[0].id]);
          } else {
            setSelectedLayerIds([]);
          }
          setScreen('editor');
          setCurrentTime(0);
          setIsPlaying(true);
        }}
        onApplyLayerAnimation={(layerId, kfs, suggestedEffect?: EffectInstance) => {
          updateLayer(
            layerId,
            (prev) => ({
              ...prev,
              keyframes: { ...prev.keyframes, ...kfs },
              effects: suggestedEffect
                ? [...prev.effects, suggestedEffect]
                : prev.effects,
            }),
            true
          );
          setActiveBottomPanel('easing');
          setCurrentTime(0);
          setIsPlaying(true);
        }}
        onApplySmoothedMotion={(smoothedLayers, summary) =>
          handleApplySmoothedMotion(smoothedLayers, summary)
        }
        onApplyAIPolishEffects={(layerId, patch, summary) =>
          handleApplyAIPolishEffects(layerId, patch, summary)
        }
        onApplyAICameraRig={(cameraLayer, beatMarkers, summary) =>
          handleApplyAICameraRig(cameraLayer, beatMarkers, summary)
        }
        onApplyAITypography={(textLayers, beatMarkers, summary) =>
          handleApplyAITypography(textLayers, beatMarkers, summary)
        }
      />

      {aiToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-xl bg-[#1E2231] border border-[#2BE0A5]/60 text-xs font-semibold text-[#2BE0A5] shadow-2xl max-w-[90vw] text-center pointer-events-none">
          {aiToast}
        </div>
      )}

      {/* New Project / Project Settings Modal */}
      <NewProjectModal
        open={projectModalState.open}
        mode={projectModalState.mode}
        currentProject={project}
        onClose={() => setProjectModalState((s) => ({ ...s, open: false }))}
        onSaveProject={(cfg, isNew) => {
          if (isNew) {
            const newId = cfg.id || `proj_${Date.now()}`;
            const newCfg = { ...cfg, id: newId };
            setActiveProjectId(newId);
            setSavedProjects((prev) => [
              { id: newId, updatedAt: Date.now(), project: newCfg, layers: [] },
              ...prev,
            ]);
            pushHistory(newCfg, []);
            setSelectedLayerIds([]);
            setCurrentTime(0);
            setScreen('editor');
            setAddDrawerOpen(true);
          } else {
            pushHistory(cfg, layers);
          }
        }}
      />

      {/* Export Video / Frame / Project Modal */}
      <ExportModal
        open={exportModalOpen}
        project={project}
        layers={layers}
        currentTime={currentTime}
        onClose={() => setExportModalOpen(false)}
        onImportProjectJSON={(data) => {
          const impId = data.project.id || `proj_${Date.now()}`;
          setActiveProjectId(impId);
          pushHistory({ ...data.project, id: impId }, data.layers);
          setSelectedLayerIds(data.layers[0] ? [data.layers[0].id] : []);
          setCurrentTime(0);
          setScreen('editor');
        }}
        onImportXMLFile={(file) => handleImportXMLFile(file)}
      />

      {/* Full-Screen Preview Player */}
      <PreviewScreenModal
        open={previewOpen}
        project={project}
        layers={layers}
        initialTime={currentTime}
        onClose={(lastTime) => {
          setPreviewOpen(false);
          setCurrentTime(lastTime);
        }}
      />
    </div>
  );
}
