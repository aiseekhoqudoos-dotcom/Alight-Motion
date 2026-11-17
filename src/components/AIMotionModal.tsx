import React, { useEffect, useState } from 'react';
import {
  Activity,
  Clapperboard,
  Loader2,
  Palette,
  Sparkles,
  Type as TypeIcon,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import { EffectInstance, EffectType, Layer, ProjectConfig } from '../types/editor';
import { createEffectInstance } from '../engine/presets';

export type AIMotionMode =
  | 'scene'
  | 'trailer'
  | 'smooth'
  | 'layer'
  | 'effects'
  | 'camera'
  | 'typography';

interface AIMotionModalProps {
  open: boolean;
  initialMode: AIMotionMode;
  project: ProjectConfig;
  layers: Layer[];
  selectedLayer: Layer | null;
  currentTime: number;
  onClose: () => void;
  onApplyGeneratedScene: (
    data: {
      sceneTitle: string;
      background: 'black' | 'slate' | 'white';
      beatMarkers: number[];
      layers: Layer[];
    },
    mode: 'replace' | 'append',
    generatedKind: 'scene' | 'trailer'
  ) => void;
  onApplyLayerAnimation: (
    layerId: string,
    keyframes: Layer['keyframes'],
    suggestedEffect?: EffectInstance,
    summary?: string
  ) => void;
  onApplySmoothedMotion: (
    smoothedLayers: Array<{ layerId: string; keyframes: Layer['keyframes'] }>,
    summary: string
  ) => void;
  onApplyAIPolishEffects: (
    layerId: string,
    patch: {
      fillColor: string;
      fillGradient?: Layer['fillGradient'];
      strokeColor: string;
      strokeWidth: number;
      blendMode: Layer['blendMode'];
      shadow?: Layer['shadow'];
      effects: EffectInstance[];
    },
    summary: string
  ) => void;
  onApplyAICameraRig: (
    cameraLayer: Layer,
    beatMarkers: number[],
    summary: string
  ) => void;
  onApplyAITypography: (
    textLayers: Layer[],
    beatMarkers: number[],
    summary: string
  ) => void;
}

const SCENE_PROMPTS = [
  'Bold kinetic typography opener for "VELOCITY" with glowing mint rings and smooth camera zoom',
  'Sleek social media lower-third card sliding in from left with overshoot bounce and subtle subtitle',
  'Futuristic radar HUD with rotating orbital arcs, crosshair star, and chromatic split title',
  'Minimalist luxury product showcase badge with golden framing and silky smooth ease-out reveal',
];

const TRAILER_PROMPTS = [
  '3-beat blockbuster cinema trailer for "NEXUS" with camera zoom push-in, golden flare ring, and bold title cuts',
  'Neon cyber product launch trailer with RGB chromatic split text, HUD reticle spin, and rapid beat transitions',
  'High-energy hype promo trailer with rapid word drops: "DREAM IT." -> "BUILD IT." -> "LAUNCH NOW"',
  'Luxury flagship watch reveal trailer with smooth editorial title tracking, bevel pills, and subtle studio drift',
];

const LAYER_PROMPTS = [
  'Snappy overshoot scale-in pop followed by a gentle floating drift',
  'Smooth cinematic slide from left edge with gradual deceleration',
  '360 degree energetic spin with 3D tilt and silky smooth settle',
  'Bouncy heartbeat pulse synchronized over 2 seconds',
];

const SMOOTH_STYLES = [
  { id: 'Silky Cinema', desc: 'Fluid exponential ease-out & calm settles' },
  { id: 'Overshoot Snap', desc: 'Crisp Alight spring pop + smooth decel' },
  { id: 'Liquid Momentum', desc: 'Zero-stop continuous glide across keys' },
  { id: 'Micro-Damped Bounce', desc: 'Tactile damped spring bounce settle' },
  { id: 'Zero-Jerk Flow', desc: 'C2 continuous curves eliminating harsh snaps' },
] as const;

const SMOOTH_PROMPTS = [
  'Eliminate robotic linear curves and feather every start and stop',
  'Add subtle Alight Motion overshoot bounce on entrances with smooth settle',
  'Turn quick cuts into buttery slow-ease-out cinema motion',
];

const EFFECTS_PROMPTS = [
  'Cyberpunk neon mint & cyan prism glow with RGB chromatic split',
  'Luxury gold glossy bevel with soft studio drop shadow',
  'Dreamy cinema bloom with subtle handheld motion & vignette',
  'High-contrast holographic electric purple & cyan gradient look',
];

const CAMERA_PROMPTS = [
  'Dynamic beat-synced zoom punches on every layer entrance with smooth settle',
  'Slow cinematic push-in zoom with gentle handheld sway',
  'Energetic music-video pan & snap tilt synced to timeline beats',
];

const TYPOGRAPHY_PROMPTS = [
  '3-beat staggered hero title: "CREATE" -> "ANIMATE" -> "INSPIRE"',
  'Tech launch headline "NEXT GEN MOTION" with expanding tracking & glowing subtitle',
  'Clean editorial lower-third title + subtitle with crisp upward glide',
];

export const AIMotionModal: React.FC<AIMotionModalProps> = ({
  open,
  initialMode,
  project,
  layers,
  selectedLayer,
  currentTime,
  onClose,
  onApplyGeneratedScene,
  onApplyLayerAnimation,
  onApplySmoothedMotion,
  onApplyAIPolishEffects,
  onApplyAICameraRig,
  onApplyAITypography,
}) => {
  const [mode, setMode] = useState<AIMotionMode>(initialMode);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Kinetic Studio');
  const [insertMode, setInsertMode] = useState<'replace' | 'append'>('replace');

  const [smoothScope, setSmoothScope] = useState<'layer' | 'all'>('layer');
  const [smoothStyle, setSmoothStyle] = useState<string>('Silky Cinema');
  const [smoothIntensity, setSmoothIntensity] = useState<number>(85);

  const [aiStatus, setAiStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setStyle(
      initialMode === 'trailer'
        ? 'Blockbuster Cinema'
        : initialMode === 'effects'
          ? 'Cyber Neon'
          : initialMode === 'camera'
            ? 'Dynamic Beat Sync'
            : initialMode === 'typography'
              ? 'Bold Kinetic Impact'
              : 'Kinetic Studio'
    );
    setSmoothScope(selectedLayer ? 'layer' : 'all');
    setError(null);

    fetch('/api/ai/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setAiStatus({ configured: Boolean(d.configured), model: String(d.model || '') });
      })
      .catch(() => {});
  }, [open, initialMode, selectedLayer]);

  if (!open) return null;

  const needsSelectedLayer = (m: AIMotionMode) => m === 'layer' || m === 'effects';
  const effectiveMode: AIMotionMode =
    needsSelectedLayer(mode) && !selectedLayer ? 'scene' : mode;

  const canSubmit =
    effectiveMode === 'smooth'
      ? (smoothScope === 'all' ? layers.length > 0 : Boolean(selectedLayer))
      : effectiveMode === 'camera'
        ? true
        : Boolean(prompt.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      if (effectiveMode === 'scene' || effectiveMode === 'trailer') {
        const res = await fetch('/api/ai/generate-motion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            mode: effectiveMode,
            width: project.width,
            height: project.height,
            duration:
              effectiveMode === 'trailer' ? Math.max(project.duration, 6) : project.duration,
            style,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate AI motion scene.');
        onApplyGeneratedScene(data, insertMode, effectiveMode);
        onClose();
      } else if (effectiveMode === 'smooth') {
        const targetLayers =
          smoothScope === 'layer' && selectedLayer ? [selectedLayer] : layers;
        const res = await fetch('/api/ai/smooth-motion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            layers: targetLayers,
            smoothStyle,
            intensity: smoothIntensity,
            prompt: prompt.trim(),
            duration: project.duration,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to smooth keyframes.');
        onApplySmoothedMotion(data.smoothedLayers || [], data.summary || 'AI Smoothing applied');
        onClose();
      } else if (effectiveMode === 'layer' && selectedLayer) {
        const res = await fetch('/api/ai/animate-layer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            layer: selectedLayer,
            currentTime,
            duration: project.duration,
            width: project.width,
            height: project.height,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to animate layer.');
        let fx: EffectInstance | undefined;
        if (
          data.suggestedEffect &&
          data.suggestedEffect !== 'none' &&
          [
            'glow',
            'deepGlow',
            'gaussianBlur',
            'chromaticAberration',
            'oscillate',
            'waveWarp',
            'shake',
            'smoothBevel',
          ].includes(data.suggestedEffect)
        ) {
          fx = createEffectInstance(data.suggestedEffect as EffectType);
        }
        onApplyLayerAnimation(selectedLayer.id, data.keyframes || {}, fx, data.summary);
        onClose();
      } else if (effectiveMode === 'effects' && selectedLayer) {
        const res = await fetch('/api/ai/polish-effects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            style,
            layer: selectedLayer,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to apply AI effects.');
        onApplyAIPolishEffects(
          selectedLayer.id,
          {
            fillColor: data.fillColor || selectedLayer.fillColor || '#2BE0A5',
            fillGradient: data.fillGradient,
            strokeColor: data.strokeColor || '#FFFFFF',
            strokeWidth: Number(data.strokeWidth || 0),
            blendMode: data.blendMode || selectedLayer.blendMode || 'normal',
            shadow: data.shadow,
            effects: Array.isArray(data.effects) ? data.effects : [],
          },
          data.summary || 'Applied AI effects & color polish'
        );
        onClose();
      } else if (effectiveMode === 'camera') {
        const res = await fetch('/api/ai/camera-director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt:
              prompt.trim() ||
              'Dynamic beat-synced zoom punches and smooth camera drift across layers',
            layers,
            duration: project.duration,
            width: project.width,
            height: project.height,
            style,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to choreograph AI camera.');
        if (data.cameraLayer) {
          onApplyAICameraRig(
            data.cameraLayer,
            Array.isArray(data.beatMarkers) ? data.beatMarkers : [],
            data.summary || 'Applied AI Camera Rig'
          );
        }
        onClose();
      } else if (effectiveMode === 'typography') {
        const res = await fetch('/api/ai/typography-director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            style,
            width: project.width,
            height: project.height,
            duration: project.duration,
            currentTime,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate kinetic typography.');
        onApplyAITypography(
          Array.isArray(data.layers) ? data.layers : [],
          Array.isArray(data.beatMarkers) ? data.beatMarkers : [],
          data.summary || 'Added AI Kinetic Typography'
        );
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected AI request error');
    } finally {
      setLoading(false);
    }
  };

  const modeTabs: Array<{
    id: AIMotionMode;
    label: string;
    icon: React.FC<{ className?: string }>;
    disabled?: boolean;
    accent?: 'mint' | 'amber' | 'cyan';
  }> = [
    { id: 'scene', label: 'Scene', icon: Sparkles, accent: 'mint' },
    { id: 'trailer', label: 'Trailer', icon: Clapperboard, accent: 'amber' },
    { id: 'smooth', label: 'AI Smooth', icon: Activity, accent: 'cyan' },
    { id: 'layer', label: 'Layer', icon: Wand2, disabled: !selectedLayer, accent: 'mint' },
    { id: 'effects', label: 'AI Look', icon: Palette, disabled: !selectedLayer, accent: 'cyan' },
    { id: 'camera', label: 'Camera', icon: Video, accent: 'amber' },
    { id: 'typography', label: 'Type', icon: TypeIcon, accent: 'mint' },
  ];

  const activeSamples =
    effectiveMode === 'trailer'
      ? TRAILER_PROMPTS
      : effectiveMode === 'smooth'
        ? SMOOTH_PROMPTS
        : effectiveMode === 'effects'
          ? EFFECTS_PROMPTS
          : effectiveMode === 'camera'
            ? CAMERA_PROMPTS
            : effectiveMode === 'typography'
              ? TYPOGRAPHY_PROMPTS
              : effectiveMode === 'layer'
                ? LAYER_PROMPTS
                : SCENE_PROMPTS;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-[#1E2231] border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between bg-[#181B28] sticky top-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#2BE0A5]/15 border border-[#2BE0A5]/40 flex items-center justify-center text-[#2BE0A5] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white truncate">
                  Google AI Studio Motion Director
                </h2>
                {aiStatus && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                      aiStatus.configured
                        ? 'bg-[#2BE0A5]/15 text-[#2BE0A5] border border-[#2BE0A5]/35'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/35'
                    }`}
                  >
                    {aiStatus.configured ? 'Live' : 'Offline'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                AI Smoothing, Multi-Beat Trailers, Camera Sync, Kinetic Type &amp; Effects
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Scrollable 7-Capability AI Mode Tabs */}
          <div className="flex gap-1 bg-[#141722] p-1 rounded-xl border border-white/[0.06] overflow-x-auto no-scrollbar">
            {modeTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = effectiveMode === tab.id;
              const activeClass =
                tab.accent === 'amber'
                  ? 'bg-[#F2A833] text-[#0E131D]'
                  : tab.accent === 'cyan'
                    ? 'bg-[#38B2CE] text-[#0E131D]'
                    : 'bg-[#2BE0A5] text-[#0E131D]';
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={tab.disabled}
                  onClick={() => setMode(tab.id)}
                  className={`py-2 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-35 ${
                    isActive ? activeClass : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Mode Context Banners */}
          {effectiveMode === 'trailer' && (
            <div className="px-3 py-2 rounded-lg bg-[#F2A833]/10 border border-[#F2A833]/30 text-[11px] text-[#FDE3B2] flex items-center justify-between gap-2">
              <span>
                Builds a multi-beat sequence with staggered title cuts, camera zoom &amp; beat markers.
              </span>
              <span className="font-mono-tabular font-bold shrink-0">
                {Math.max(project.duration, 6)}s
              </span>
            </div>
          )}

          {effectiveMode === 'smooth' && (
            <div className="space-y-3 bg-[#141722] border border-[#38B2CE]/30 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#38B2CE]">
                  AI Motion Smoothing Scope
                </span>
                <div className="flex bg-[#1E2231] rounded-lg p-0.5 border border-white/10">
                  <button
                    type="button"
                    disabled={!selectedLayer}
                    onClick={() => setSmoothScope('layer')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer disabled:opacity-35 ${
                      smoothScope === 'layer'
                        ? 'bg-[#38B2CE] text-[#0E131D]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {selectedLayer ? selectedLayer.name : 'No Layer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmoothScope('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                      smoothScope === 'all'
                        ? 'bg-[#38B2CE] text-[#0E131D]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Entire Timeline ({layers.length})
                  </button>
                </div>
              </div>

              {/* Smoothing Style Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {SMOOTH_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSmoothStyle(st.id)}
                    className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      smoothStyle === st.id
                        ? 'bg-[#38B2CE]/15 border-[#38B2CE] text-white'
                        : 'bg-[#1E2231] border-white/[0.06] text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{st.id}</div>
                    <div className="text-[9px] text-slate-400 leading-tight mt-0.5">{st.desc}</div>
                  </button>
                ))}
              </div>

              {/* Smoothing Strength */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[11px] text-slate-300 whitespace-nowrap">
                  Curve Fluidity
                </span>
                <input
                  type="range"
                  min={25}
                  max={100}
                  step={5}
                  value={smoothIntensity}
                  onChange={(e) => setSmoothIntensity(Number(e.target.value))}
                  className="studio-slider flex-1"
                />
                <span className="text-xs font-mono-tabular text-[#38B2CE] font-bold w-10 text-right">
                  {smoothIntensity}%
                </span>
              </div>
            </div>
          )}

          {(effectiveMode === 'layer' || effectiveMode === 'effects') && selectedLayer && (
            <div className="px-3 py-2 rounded-lg bg-[#252A3C] border border-white/[0.06] text-xs text-slate-300 flex items-center justify-between">
              <span>
                Target: <strong className="text-white">{selectedLayer.name}</strong>
              </span>
              <span className="font-mono-tabular text-[#2BE0A5]">
                At {currentTime.toFixed(2)}s
              </span>
            </div>
          )}

          {effectiveMode === 'camera' && (
            <div className="px-3 py-2 rounded-lg bg-[#F2A833]/10 border border-[#F2A833]/30 text-[11px] text-[#FDE3B2]">
              Analyzes all {layers.length} layer timestamps &amp; positions to auto-choreograph a beat-synced Camera Rig + red beat markers.
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 block">
              {effectiveMode === 'smooth'
                ? 'Optional Smoothing Notes (or run immediately with your preset)'
                : effectiveMode === 'trailer'
                  ? 'Describe your AI motion trailer storyline & beat titles'
                  : effectiveMode === 'effects'
                    ? 'Describe the color, lighting & effects look for this layer'
                    : effectiveMode === 'camera'
                      ? 'Camera direction & beat-sync feel (optional)'
                      : effectiveMode === 'typography'
                        ? 'Describe your kinetic typography copy & rhythm'
                        : effectiveMode === 'layer'
                          ? 'Describe how this layer should animate'
                          : 'Describe your motion graphic scene'}
            </label>
            <textarea
              rows={effectiveMode === 'smooth' ? 2 : 3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                effectiveMode === 'smooth'
                  ? 'Optional: e.g., Soften middle keyframe corners and add gentle overshoot settle'
                  : effectiveMode === 'trailer'
                    ? 'e.g., 3-beat epic movie teaser: "THIS SUMMER" -> "NO FEAR" -> "CHRONICLE 2026"'
                    : effectiveMode === 'effects'
                      ? 'e.g., Electric neon mint deep glow with subtle RGB prism split and glossy bevel'
                      : effectiveMode === 'camera'
                        ? 'e.g., Punch in 1.25x on each text beat then slowly pull back to wide'
                        : effectiveMode === 'typography'
                          ? 'e.g., 3 staggered headline drops: "SPEED." -> "PRECISION." -> "KINETIX"'
                          : effectiveMode === 'layer'
                            ? 'e.g., Pop in with elastic overshoot, drift up gently, and rotate 15 degrees'
                            : 'e.g., Kinetic typography intro for "LAUNCH 2026" with pulsing neon ring and camera push'
              }
              className="w-full bg-[#141722] border border-white/10 focus:border-[#2BE0A5] rounded-xl p-3 text-sm text-white placeholder:text-slate-500 outline-none"
            />
          </div>

          {/* Quick Prompt Ideas */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-400 block">
              Quick AI Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {activeSamples.map((sample, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(sample)}
                  className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-[#252A3C] hover:bg-[#30374F] text-slate-300 hover:text-white border border-white/[0.06] transition-colors cursor-pointer"
                >
                  {sample.length > 54 ? `${sample.slice(0, 54)}...` : sample}
                </button>
              ))}
            </div>
          </div>

          {/* Style / Timeline Action Options */}
          {(effectiveMode === 'scene' ||
            effectiveMode === 'trailer' ||
            effectiveMode === 'effects' ||
            effectiveMode === 'camera' ||
            effectiveMode === 'typography') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Visual &amp; Motion Style
                </label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full bg-[#141722] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                >
                  {effectiveMode === 'trailer' ? (
                    <>
                      <option value="Blockbuster Cinema">Blockbuster Cinema</option>
                      <option value="Cyber Glitch Teaser">Cyber Glitch Teaser</option>
                      <option value="Hype Social Promo">Hype Social Promo</option>
                      <option value="Product Showcase">Product Showcase</option>
                    </>
                  ) : effectiveMode === 'effects' ? (
                    <>
                      <option value="Cyber Neon">Cyber Neon</option>
                      <option value="Luxury Gold">Luxury Gold</option>
                      <option value="Cinema Film">Cinema Film</option>
                      <option value="Clean Minimal">Clean Minimal</option>
                    </>
                  ) : effectiveMode === 'camera' ? (
                    <>
                      <option value="Dynamic Beat Sync">Dynamic Beat Sync</option>
                      <option value="Silky Slow Push">Silky Slow Push</option>
                      <option value="Handheld Action">Handheld Action</option>
                    </>
                  ) : effectiveMode === 'typography' ? (
                    <>
                      <option value="Bold Kinetic Impact">Bold Kinetic Impact</option>
                      <option value="Editorial Luxury">Editorial Luxury</option>
                      <option value="Cyber HUD Type">Cyber HUD Type</option>
                    </>
                  ) : (
                    <>
                      <option value="Kinetic Studio">Kinetic Studio</option>
                      <option value="Minimalist Brand">Minimalist Brand</option>
                      <option value="Cyber HUD">Cyber HUD</option>
                      <option value="Smooth Editorial">Smooth Editorial</option>
                    </>
                  )}
                </select>
              </div>

              {(effectiveMode === 'scene' || effectiveMode === 'trailer') && (
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Timeline Action
                  </label>
                  <select
                    value={insertMode}
                    onChange={(e) =>
                      setInsertMode(e.target.value as 'replace' | 'append')
                    }
                    className="w-full bg-[#141722] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                  >
                    <option value="replace">
                      {effectiveMode === 'trailer'
                        ? 'Replace with Trailer'
                        : 'Replace Current Scene'}
                    </option>
                    <option value="append">Add Layers to Timeline</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg bg-[#272C3F] hover:bg-[#323850] text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className={`h-9 px-5 rounded-lg disabled:opacity-45 text-[#0E131D] text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                effectiveMode === 'trailer' || effectiveMode === 'camera'
                  ? 'bg-[#F2A833] hover:bg-[#E29823]'
                  : effectiveMode === 'smooth' || effectiveMode === 'effects'
                    ? 'bg-[#38B2CE] hover:bg-[#2EA1BD]'
                    : 'bg-[#2BE0A5] hover:bg-[#23C790]'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {effectiveMode === 'smooth'
                      ? 'Smoothing Curves...'
                      : effectiveMode === 'trailer'
                        ? 'Directing Trailer...'
                        : effectiveMode === 'camera'
                          ? 'Choreographing Camera...'
                          : effectiveMode === 'effects'
                            ? 'Styling Look...'
                            : 'Generating...'}
                  </span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>
                    {effectiveMode === 'smooth'
                      ? 'Run AI Smoothing'
                      : effectiveMode === 'trailer'
                        ? 'Generate Trailer'
                        : effectiveMode === 'scene'
                          ? 'Generate Scene'
                          : effectiveMode === 'effects'
                            ? 'Apply AI Look'
                            : effectiveMode === 'camera'
                              ? 'Build Camera Rig'
                              : effectiveMode === 'typography'
                                ? 'Add Kinetic Type'
                                : 'Apply Keyframes'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
