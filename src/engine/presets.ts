import {
  AspectRatioPreset,
  BlendMode,
  EffectInstance,
  EffectType,
  Layer,
  LayerPreset,
  ProjectConfig,
  ShapeKind,
} from '../types/editor';

export const ASPECT_RATIO_DIMENSIONS: Record<
  AspectRatioPreset,
  { width: number; height: number; label: string }
> = {
  '16:9': { width: 1280, height: 720, label: '16:9' },
  '9:16': { width: 720, height: 1280, label: '9:16' },
  '4:5': { width: 864, height: 1080, label: '4:5' },
  '1:1': { width: 1080, height: 1080, label: '1:1' },
  '4:3': { width: 1080, height: 810, label: '4:3' },
};

export const SHAPE_CATALOG: Array<{
  kind: ShapeKind;
  label: string;
}> = [
  { kind: 'circle', label: 'Circle' },
  { kind: 'roundedRect', label: 'Rounded' },
  { kind: 'rect', label: 'Square' },
  { kind: 'triangle', label: 'Triangle' },
  { kind: 'star', label: 'Star' },
  { kind: 'polygon', label: 'Hexagon' },
  { kind: 'ring', label: 'Ring' },
  { kind: 'arc', label: 'Arc' },
  { kind: 'cross', label: 'Plus' },
  { kind: 'arrow', label: 'Arrow' },
  { kind: 'pill', label: 'Pill' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'heart', label: 'Heart' },
  { kind: 'burst', label: 'Burst' },
  { kind: 'spiral', label: 'Spiral' },
  { kind: 'hudGrid', label: 'HUD Grid' },
  { kind: 'bracket', label: 'Bracket' },
  { kind: 'wave', label: 'Wave Bar' },
  { kind: 'badge', label: 'Shield' },
];

export const BLEND_CATEGORIES: Array<{
  category: string;
  modes: Array<{ value: BlendMode; label: string }>;
}> = [
  {
    category: 'Normal',
    modes: [{ value: 'normal', label: 'Normal' }],
  },
  {
    category: 'Darken',
    modes: [
      { value: 'multiply', label: 'Multiply' },
      { value: 'darken', label: 'Darken' },
      { value: 'color-burn', label: 'Color Burn' },
    ],
  },
  {
    category: 'Lighten',
    modes: [
      { value: 'screen', label: 'Screen' },
      { value: 'lighten', label: 'Lighten' },
      { value: 'color-dodge', label: 'Color Dodge' },
    ],
  },
  {
    category: 'Contrast',
    modes: [
      { value: 'overlay', label: 'Overlay' },
      { value: 'hard-light', label: 'Hard Light' },
      { value: 'soft-light', label: 'Soft Light' },
    ],
  },
  {
    category: 'Invert',
    modes: [
      { value: 'difference', label: 'Difference' },
      { value: 'exclusion', label: 'Exclusion' },
    ],
  },
  {
    category: 'Color',
    modes: [
      { value: 'hue', label: 'Hue' },
      { value: 'saturation', label: 'Saturation' },
      { value: 'color', label: 'Color' },
      { value: 'luminosity', label: 'Luminosity' },
    ],
  },
];

export type EffectCategory =
  | 'Color & Light'
  | 'Drawing & Edge'
  | 'Blur'
  | 'Distortion/Warp'
  | 'Procedural'
  | '3D'
  | 'Move/Transform'
  | 'Repeat'
  | 'Matte/Mask/Key'
  | 'Opacity/Visibility'
  | 'Text';

export interface EffectCatalogEntry {
  type: EffectType;
  name: string;
  category: EffectCategory;
  description: string;
  defaultParams: Record<string, number | string>;
}

export const EFFECT_CATALOG: EffectCatalogEntry[] = [
  {
    type: 'glow',
    name: 'Glow / Bloom',
    category: 'Color & Light',
    description: 'Luminous neon aura around shapes and text',
    defaultParams: { radius: 28, color: '#2BE0A5' },
  },
  {
    type: 'deepGlow',
    name: 'DeepGlow Enhanced',
    category: 'Color & Light',
    description: 'Multi-pass cinema bloom halo',
    defaultParams: { radius: 42, intensity: 2, color: '#2BE0A5' },
  },
  {
    type: 'exposureGamma',
    name: 'Brightness / Contrast',
    category: 'Color & Light',
    description: 'Adjust brightness and contrast punch',
    defaultParams: { brightness: 115, contrast: 112 },
  },
  {
    type: 'hueShift',
    name: 'Hue Shift & Saturate',
    category: 'Color & Light',
    description: 'Rotate color spectrum and saturation',
    defaultParams: { hue: 45, saturation: 120 },
  },
  {
    type: 'colorize',
    name: 'Colorize Tint',
    category: 'Color & Light',
    description: 'Tint layer fill with vivid pigment',
    defaultParams: { color: '#38B2CE', amount: 65 },
  },
  {
    type: 'threeColorGradient',
    name: '3 Color Gradient+',
    category: 'Color & Light',
    description: 'Tri-tone dynamic gradient sweep',
    defaultParams: { color1: '#2BE0A5', color2: '#38B2CE', color3: '#D946EF', angle: 45 },
  },
  {
    type: 'invert',
    name: 'Invert Colors',
    category: 'Color & Light',
    description: 'Invert layer luminance and hues',
    defaultParams: { amount: 100 },
  },
  {
    type: 'drawingProgress',
    name: 'Drawing Progress',
    category: 'Drawing & Edge',
    description: 'Trim stroke & ring arc from Start% to End%',
    defaultParams: { start: 0, end: 75 },
  },
  {
    type: 'smoothBevel',
    name: 'Smooth Bevel',
    category: 'Drawing & Edge',
    description: 'Glossy inner bevel edge highlight',
    defaultParams: { depth: 6, highlight: '#FFFFFF' },
  },
  {
    type: 'gaussianBlur',
    name: 'Gaussian Blur',
    category: 'Blur',
    description: 'Soft optical lens defocus blur',
    defaultParams: { radius: 8 },
  },
  {
    type: 'directionalBlur',
    name: 'Directional Blur',
    category: 'Blur',
    description: 'Speed-streak directional motion blur',
    defaultParams: { strength: 14, angle: 0 },
  },
  {
    type: 'chromaticAberration',
    name: 'RGB Split',
    category: 'Distortion/Warp',
    description: 'Chromatic prism channel separation',
    defaultParams: { offset: 7 },
  },
  {
    type: 'waveWarp',
    name: 'Wave Warp',
    category: 'Distortion/Warp',
    description: 'Fluid rhythmic sway distortion',
    defaultParams: { frequency: 2.5, magnitude: 8 },
  },
  {
    type: 'squeeze',
    name: 'Squeeze',
    category: 'Distortion/Warp',
    description: 'Squash & stretch lens warp',
    defaultParams: { amount: 22 },
  },
  {
    type: 'oscillate',
    name: 'Oscillate Motion',
    category: 'Procedural',
    description: 'Continuous sine-wave floating oscillation',
    defaultParams: { frequency: 1.5, magnitude: 16, angle: 90 },
  },
  {
    type: 'shake',
    name: 'Handheld Shake',
    category: 'Move/Transform',
    description: 'Organic camera / layer micro-jitter',
    defaultParams: { frequency: 6, magnitude: 10 },
  },
  {
    type: 'extrude3d',
    name: '3D Extrude',
    category: '3D',
    description: 'Multi-stepped 3D volumetric depth extrusion',
    defaultParams: { depth: 12, angle: 135, color: '#0B0E17' },
  },
  {
    type: 'radialRepeat',
    name: 'Radial Repeat',
    category: 'Repeat',
    description: 'Kaleidoscope circular clones around pivot',
    defaultParams: { count: 6, radius: 130, spread: 360 },
  },
  {
    type: 'linearRepeat',
    name: 'Linear Repeat',
    category: 'Repeat',
    description: 'Echoing trail clones along X/Y step',
    defaultParams: { count: 4, offsetX: 36, offsetY: 0 },
  },
  {
    type: 'chromaKey',
    name: 'Chroma Key',
    category: 'Matte/Mask/Key',
    description: 'Key out green/blue backdrop color',
    defaultParams: { hue: 120, tolerance: 40 },
  },
  {
    type: 'vignette',
    name: 'Cinema Vignette',
    category: 'Matte/Mask/Key',
    description: 'Soft dark edge framing across stage',
    defaultParams: { strength: 0.55 },
  },
  {
    type: 'fadeInOut',
    name: 'Fade In / Out',
    category: 'Opacity/Visibility',
    description: 'Automatic smooth opacity entrance and exit',
    defaultParams: { fadeIn: 0.4, fadeOut: 0.4 },
  },
  {
    type: 'blink',
    name: 'Blink / Strobe',
    category: 'Opacity/Visibility',
    description: 'Rhythmic pulse transparency strobe',
    defaultParams: { frequency: 3, minOpacity: 25 },
  },
  {
    type: 'countUpDown',
    name: 'Count Up/Down',
    category: 'Text',
    description: 'Animated numeric counter readout',
    defaultParams: { from: 0, to: 100, decimals: 0 },
  },
  {
    type: 'textProgress',
    name: 'Text Progress',
    category: 'Text',
    description: 'Typewriter character reveal with cursor',
    defaultParams: { end: 100, cursor: 1 },
  },
  {
    type: 'textRandomizer',
    name: 'Text Randomizer',
    category: 'Text',
    description: 'Cyber scramble character decoder',
    defaultParams: { amount: 45, speed: 12 },
  },
  {
    type: 'textSpacing',
    name: 'Text Spacing',
    category: 'Text',
    description: 'Dynamic letter tracking expansion',
    defaultParams: { spacing: 18 },
  },
  {
    type: 'textTransform',
    name: 'Text Transform',
    category: 'Text',
    description: 'Per-character wave bounce & fade',
    defaultParams: { amplitude: 14, speed: 3 },
  },
  {
    type: 'timecode',
    name: 'Timecode',
    category: 'Text',
    description: 'Live MM:SS:FF running digital clock',
    defaultParams: { speed: 1 },
  },
];

export const LAYER_PRESET_CATALOG: LayerPreset[] = [
  {
    id: 'preset_pop_overshoot',
    name: 'Pop Overshoot In',
    category: 'Motion',
    description: 'Snappy spring scale-in with overshoot curve',
    keyframes: {
      scaleX: [
        { id: 'pr_sx1', time: 0, value: 0.15, easing: { type: 'bezier', p1x: 0.34, p1y: 1.5, p2x: 0.64, p2y: 1 } },
        { id: 'pr_sx2', time: 0.75, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
      ],
      scaleY: [
        { id: 'pr_sy1', time: 0, value: 0.15, easing: { type: 'bezier', p1x: 0.34, p1y: 1.5, p2x: 0.64, p2y: 1 } },
        { id: 'pr_sy2', time: 0.75, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
      ],
      opacity: [
        { id: 'pr_op1', time: 0, value: 0, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
        { id: 'pr_op2', time: 0.35, value: 100, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
      ],
    },
  },
  {
    id: 'preset_slide_x',
    name: 'Slide X-Axis Snap',
    category: 'Motion',
    description: 'Crisp horizontal swipe entrance along X-axis',
    keyframes: {
      x: [
        { id: 'pr_x1', time: 0, value: -520, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
        { id: 'pr_x2', time: 0.85, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
      ],
      opacity: [
        { id: 'pr_xo1', time: 0, value: 0, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
        { id: 'pr_xo2', time: 0.4, value: 100, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
      ],
    },
  },
  {
    id: 'preset_flip_x',
    name: '3D X-Axis Flip In',
    category: 'Motion',
    description: 'Perspective X-axis rotation flip reveal',
    keyframes: {
      rotateX: [
        { id: 'pr_rx1', time: 0, value: 85, easing: { type: 'bezier', p1x: 0.34, p1y: 1.4, p2x: 0.64, p2y: 1 } },
        { id: 'pr_rx2', time: 0.9, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
      ],
      opacity: [
        { id: 'pr_fxo1', time: 0, value: 0, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
        { id: 'pr_fxo2', time: 0.35, value: 100, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
      ],
    },
  },
  {
    id: 'preset_neon_glow',
    name: 'Neon Cyber Glow',
    category: 'Style',
    description: 'Screen blend + DeepGlow + 3-color gradient sweep',
    effects: [
      createEffectInstance('deepGlow'),
      createEffectInstance('threeColorGradient'),
    ],
    stylePatch: {
      blendMode: 'screen',
      fillGradient: { enabled: true, color1: '#2BE0A5', color2: '#38B2CE', angle: 135 },
    },
  },
  {
    id: 'preset_3d_extrude',
    name: '3D Extrude + Bevel',
    category: 'Style',
    description: 'Chunky 3D depth extrusion with bevel rim',
    effects: [
      createEffectInstance('extrude3d'),
      createEffectInstance('smoothBevel'),
    ],
    stylePatch: {
      strokeColor: '#FFFFFF',
      strokeWidth: 2,
    },
  },
  {
    id: 'preset_rgb_glitch',
    name: 'RGB Glitch Pulse',
    category: 'Style',
    description: 'Chromatic RGB split + micro-shake',
    effects: [
      createEffectInstance('chromaticAberration'),
      createEffectInstance('shake'),
    ],
  },
  {
    id: 'preset_drawing_ring',
    name: 'Drawing Progress 75%',
    category: 'Style',
    description: 'Animated radial arc progress sweep',
    effects: [
      createEffectInstance('drawingProgress'),
      createEffectInstance('glow'),
    ],
    stylePatch: {
      strokeColor: '#FDE047',
      strokeWidth: 10,
    },
  },
  {
    id: 'preset_typewriter',
    name: 'Typewriter Reveal',
    category: 'Text',
    description: 'Progressive typing cursor + glow',
    effects: [
      createEffectInstance('textProgress'),
      createEffectInstance('glow'),
    ],
  },
  {
    id: 'preset_counter_hud',
    name: 'Count Up 0→100%',
    category: 'Text',
    description: 'Animated percentage counter + wave float',
    effects: [
      createEffectInstance('countUpDown'),
      createEffectInstance('oscillate'),
    ],
  },
];

export function createEffectInstance(type: EffectType): EffectInstance {
  const entry = EFFECT_CATALOG.find((e) => e.type === type);
  if (!entry) {
    return {
      id: `fx_${Math.random().toString(36).slice(2, 9)}`,
      type,
      name: type,
      enabled: true,
      params: {},
    };
  }
  return {
    id: `fx_${Math.random().toString(36).slice(2, 9)}`,
    type: entry.type,
    name: entry.name,
    enabled: true,
    params: { ...entry.defaultParams },
  };
}

export function createDefaultProject(): {
  project: ProjectConfig;
  layers: Layer[];
} {
  const project: ProjectConfig = {
    id: 'proj_zero_motion',
    name: 'Zero Kinetic Intro',
    mode: 'project',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    fps: 60,
    background: 'black',
    duration: 8,
    beatMarkers: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5],
  };

  const layers: Layer[] = [
    {
      id: 'layer_cam_1',
      name: 'Main Camera',
      type: 'camera',
      startTime: 0,
      endTime: 8,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      cameraActive: true,
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        rotateX: 0,
        rotateY: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {
        scaleX: [
          {
            id: 'kf_c1',
            time: 0,
            value: 1.18,
            easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 },
          },
          {
            id: 'kf_c2',
            time: 2.2,
            value: 1,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
          {
            id: 'kf_c3',
            time: 6.5,
            value: 1.06,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
        ],
      },
      effects: [],
    },
    {
      id: 'layer_title',
      name: 'Z E R O Title',
      type: 'text',
      startTime: 0.2,
      endTime: 8,
      visible: true,
      locked: false,
      parentId: 'layer_null_rig',
      blendMode: 'normal',
      text: 'Z E R O',
      fontFamily: 'Outfit',
      fontSize: 96,
      fontWeight: 800,
      textAlign: 'center',
      letterSpacing: 16,
      lineHeight: 1.1,
      fillColor: '#EEF1F7',
      strokeColor: '#2BE0A5',
      strokeWidth: 0,
      transform: {
        x: 0,
        y: -14,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        rotateX: 0,
        rotateY: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {
        y: [
          {
            id: 'kf_t_y1',
            time: 0.2,
            value: 60,
            easing: { type: 'bezier', p1x: 0.22, p1y: 1.35, p2x: 0.36, p2y: 1 },
          },
          {
            id: 'kf_t_y2',
            time: 1.4,
            value: -14,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
        ],
        opacity: [
          {
            id: 'kf_t_o1',
            time: 0.2,
            value: 0,
            easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 },
          },
          {
            id: 'kf_t_o2',
            time: 0.9,
            value: 100,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
        ],
        letterSpacing: [
          {
            id: 'kf_t_ls1',
            time: 0.2,
            value: 44,
            easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 },
          },
          {
            id: 'kf_t_ls2',
            time: 1.8,
            value: 14,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
        ],
      },
      effects: [
        {
          id: 'fx_title_glow',
          type: 'glow',
          name: 'Glow / Bloom',
          enabled: true,
          params: { radius: 22, color: '#2BE0A5' },
        },
      ],
    },
    {
      id: 'layer_subtitle',
      name: 'Kinetic Subtitle',
      type: 'text',
      startTime: 0.8,
      endTime: 8,
      visible: true,
      locked: false,
      parentId: 'layer_null_rig',
      blendMode: 'normal',
      text: 'MOTION GRAPHICS ENGINE',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 20,
      fontWeight: 600,
      textAlign: 'center',
      letterSpacing: 8,
      lineHeight: 1.2,
      fillColor: '#2BE0A5',
      transform: {
        x: 0,
        y: 64,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        rotateX: 0,
        rotateY: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {
        opacity: [
          {
            id: 'kf_sub_o1',
            time: 0.8,
            value: 0,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
          {
            id: 'kf_sub_o2',
            time: 1.5,
            value: 100,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
        ],
      },
      effects: [],
    },
    {
      id: 'layer_ring_outer',
      name: 'Pulse Ring',
      type: 'shape',
      shapeKind: 'arc',
      width: 440,
      height: 440,
      innerRadiusRatio: 0.88,
      fillColor: '#2BE0A5',
      strokeWidth: 0,
      startTime: 0,
      endTime: 8,
      visible: true,
      locked: false,
      parentId: 'layer_null_rig',
      blendMode: 'screen',
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        rotateX: 0,
        rotateY: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 85,
      },
      keyframes: {
        rotation: [
          {
            id: 'kf_r_rot1',
            time: 0,
            value: -120,
            easing: { type: 'bezier', p1x: 0.25, p1y: 0.85, p2x: 0.45, p2y: 1 },
          },
          {
            id: 'kf_r_rot2',
            time: 8,
            value: 240,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
        ],
        scaleX: [
          {
            id: 'kf_r_sx1',
            time: 0,
            value: 0.35,
            easing: { type: 'bezier', p1x: 0.34, p1y: 1.45, p2x: 0.64, p2y: 1 },
          },
          {
            id: 'kf_r_sx2',
            time: 1.4,
            value: 1,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
        ],
        scaleY: [
          {
            id: 'kf_r_sy1',
            time: 0,
            value: 0.35,
            easing: { type: 'bezier', p1x: 0.34, p1y: 1.45, p2x: 0.64, p2y: 1 },
          },
          {
            id: 'kf_r_sy2',
            time: 1.4,
            value: 1,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
        ],
      },
      effects: [
        {
          id: 'fx_ring_glow',
          type: 'glow',
          name: 'Glow / Bloom',
          enabled: true,
          params: { radius: 34, color: '#2BE0A5' },
        },
      ],
    },
    {
      id: 'layer_circle_accent',
      name: 'Circle 1',
      type: 'shape',
      shapeKind: 'circle',
      width: 140,
      height: 140,
      fillColor: '#38B2CE',
      fillGradient: {
        enabled: true,
        color1: '#2BE0A5',
        color2: '#38B2CE',
        angle: 135,
      },
      startTime: 0.3,
      endTime: 8,
      visible: true,
      locked: false,
      parentId: 'layer_null_rig',
      blendMode: 'screen',
      transform: {
        x: -280,
        y: -110,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        rotateX: 0,
        rotateY: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 60,
      },
      keyframes: {
        x: [
          {
            id: 'kf_c1_x1',
            time: 0.3,
            value: -480,
            easing: { type: 'bezier', p1x: 0.34, p1y: 1.38, p2x: 0.64, p2y: 1 },
          },
          {
            id: 'kf_c1_x2',
            time: 1.6,
            value: -260,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
          {
            id: 'kf_c1_x3',
            time: 6.5,
            value: 260,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
        ],
      },
      effects: [
        {
          id: 'fx_c1_osc',
          type: 'oscillate',
          name: 'Oscillate Motion',
          enabled: true,
          params: { frequency: 0.8, magnitude: 18, angle: 90 },
        },
        {
          id: 'fx_c1_blur',
          type: 'gaussianBlur',
          name: 'Gaussian Blur',
          enabled: true,
          params: { radius: 4 },
        },
      ],
    },
    {
      id: 'layer_null_rig',
      name: 'Null Rig 1',
      type: 'null',
      startTime: 0,
      endTime: 8,
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
        rotateX: 0,
        rotateY: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 100,
      },
      keyframes: {
        rotation: [
          {
            id: 'kf_n_rot1',
            time: 2.0,
            value: 0,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
          {
            id: 'kf_n_rot2',
            time: 4.0,
            value: -3,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
          {
            id: 'kf_n_rot3',
            time: 6.0,
            value: 2,
            easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
          },
        ],
      },
      effects: [
        {
          id: 'fx_vig',
          type: 'vignette',
          name: 'Cinema Vignette',
          enabled: true,
          params: { strength: 0.45 },
        },
      ],
    },
    {
      id: 'layer_bg_grid',
      name: 'Backdrop Accent',
      type: 'shape',
      shapeKind: 'roundedRect',
      width: 920,
      height: 440,
      cornerRadius: 48,
      fillColor: '#1B2133',
      strokeColor: '#2E3954',
      strokeWidth: 2,
      startTime: 0,
      endTime: 8,
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
        rotateX: 0,
        rotateY: 0,
        skewX: 0,
        skewY: 0,
        anchorX: 0,
        anchorY: 0,
        opacity: 75,
      },
      keyframes: {},
      effects: [],
    },
  ];

  return { project, layers };
}

export interface TrailerTemplateMeta {
  id: string;
  title: string;
  tag: string;
  duration: number;
  aspectRatio: AspectRatioPreset;
  accent: string;
  description: string;
  aiPrompt: string;
}

export const TRAILER_TEMPLATES: TrailerTemplateMeta[] = [
  {
    id: 'trailer_blockbuster',
    title: 'Blockbuster Cinema Teaser',
    tag: '6s · 3-Beat Cuts',
    duration: 6,
    aspectRatio: '16:9',
    accent: '#F2A833',
    description: 'Staggered widescreen title slams, camera push-in, glow flares & cinema vignette.',
    aiPrompt:
      'Create an epic 3-beat Blockbuster Movie Trailer teaser with dramatic slammed titles, camera zoom push-in, golden glow pulses, and crisp cut transitions',
  },
  {
    id: 'trailer_cyber_launch',
    title: 'Neon Cyber Launch',
    tag: '6s · RGB Glitch',
    duration: 6,
    aspectRatio: '16:9',
    accent: '#2BE0A5',
    description: 'High-contrast cyber launch trailer with chromatic RGB split, HUD rings & beat cuts.',
    aiPrompt:
      'Create a futuristic Neon Cyber Launch Trailer with RGB chromatic split headlines, spinning orbital HUD rings, and beat-synced punchy zoom cuts',
  },
  {
    id: 'trailer_hype_promo',
    title: 'Hype Social Promo',
    tag: '5s · 9:16 Vertical',
    duration: 5,
    aspectRatio: '9:16',
    accent: '#E84A6F',
    description: 'Fast vertical reel trailer with overshoot pop cards, radial energy & bold kinetic text.',
    aiPrompt:
      'Create a fast-paced vertical 9:16 Hype Social Promo Trailer with snappy overshoot pop badges, beat markers, and energetic kinetic titles',
  },
  {
    id: 'trailer_product_reveal',
    title: 'Sleek Product Showcase',
    tag: '6s · Editorial',
    duration: 6,
    aspectRatio: '16:9',
    accent: '#38B2CE',
    description: 'Smooth luxury brand trailer with sliding feature pills, counter stat & 3D extrude badge.',
    aiPrompt:
      'Create a luxury minimalist Product Reveal Trailer with smooth ease-out typography, floating pill cards, and subtle studio camera drift',
  },
];

export function createTrailerProject(trailerId: string): {
  project: ProjectConfig;
  layers: Layer[];
} {
  const now = Date.now();
  const baseTransform = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    rotateX: 0,
    rotateY: 0,
    skewX: 0,
    skewY: 0,
    anchorX: 0,
    anchorY: 0,
    opacity: 100,
  };

  if (trailerId === 'trailer_cyber_launch') {
    const project: ProjectConfig = {
      id: `proj_tr_cyber_${now}`,
      name: 'Trailer · Cyber Launch',
      mode: 'project',
      aspectRatio: '16:9',
      width: 1280,
      height: 720,
      fps: 60,
      background: 'black',
      duration: 6,
      beatMarkers: [0.5, 1.8, 3.2, 4.6, 5.5],
    };
    const layers: Layer[] = [
      {
        id: `tr_cam_${now}`,
        name: 'Trailer Camera',
        type: 'camera',
        cameraActive: true,
        startTime: 0,
        endTime: 6,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          scaleX: [
            { id: `tr_c1_${now}`, time: 0, value: 1.28, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
            { id: `tr_c2_${now}`, time: 1.8, value: 1.0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
            { id: `tr_c3_${now}`, time: 3.2, value: 1.14, easing: { type: 'bezier', p1x: 0.34, p1y: 1.35, p2x: 0.64, p2y: 1 } },
            { id: `tr_c4_${now}`, time: 6.0, value: 1.0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
          scaleY: [
            { id: `tr_cy1_${now}`, time: 0, value: 1.28, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
            { id: `tr_cy2_${now}`, time: 1.8, value: 1.0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
            { id: `tr_cy3_${now}`, time: 3.2, value: 1.14, easing: { type: 'bezier', p1x: 0.34, p1y: 1.35, p2x: 0.64, p2y: 1 } },
            { id: `tr_cy4_${now}`, time: 6.0, value: 1.0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [],
      },
      {
        id: `tr_beat1_${now}`,
        name: 'Beat 1 · INCOMING',
        type: 'text',
        text: 'SYSTEM ONLINE',
        fontFamily: 'Archivo',
        fontSize: 82,
        fontWeight: 800,
        letterSpacing: 8,
        fillColor: '#2BE0A5',
        startTime: 0,
        endTime: 1.85,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          scaleX: [
            { id: `tb1_1_${now}`, time: 0, value: 1.5, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
            { id: `tb1_2_${now}`, time: 0.65, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
          opacity: [
            { id: `tb1_o1_${now}`, time: 0, value: 0, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
            { id: `tb1_o2_${now}`, time: 0.35, value: 100, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
            { id: `tb1_o3_${now}`, time: 1.8, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('chromaticAberration'), createEffectInstance('deepGlow')],
      },
      {
        id: `tr_beat2_${now}`,
        name: 'Beat 2 · NEXT GEN',
        type: 'text',
        text: 'NEXT-GEN ENGINE',
        fontFamily: 'Outfit',
        fontSize: 78,
        fontWeight: 800,
        letterSpacing: 6,
        fillColor: '#FFFFFF',
        startTime: 1.8,
        endTime: 3.4,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          x: [
            { id: `tb2_x1_${now}`, time: 1.8, value: -520, easing: { type: 'bezier', p1x: 0.34, p1y: 1.38, p2x: 0.64, p2y: 1 } },
            { id: `tb2_x2_${now}`, time: 2.5, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('shake'), createEffectInstance('glow')],
      },
      {
        id: `tr_beat3_${now}`,
        name: 'Beat 3 · LAUNCH',
        type: 'text',
        text: 'KINETIX 2026',
        fontFamily: 'Oswald',
        fontSize: 110,
        fontWeight: 800,
        letterSpacing: 12,
        fillColor: '#EEF1F7',
        startTime: 3.2,
        endTime: 6,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          scaleX: [
            { id: `tb3_sx1_${now}`, time: 3.2, value: 0.35, easing: { type: 'bezier', p1x: 0.34, p1y: 1.45, p2x: 0.64, p2y: 1 } },
            { id: `tb3_sx2_${now}`, time: 4.1, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
          scaleY: [
            { id: `tb3_sy1_${now}`, time: 3.2, value: 0.35, easing: { type: 'bezier', p1x: 0.34, p1y: 1.45, p2x: 0.64, p2y: 1 } },
            { id: `tb3_sy2_${now}`, time: 4.1, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('deepGlow'), createEffectInstance('chromaticAberration')],
      },
      {
        id: `tr_hud_${now}`,
        name: 'Orbital HUD Frame',
        type: 'shape',
        shapeKind: 'hudGrid',
        width: 480,
        height: 480,
        fillColor: '#38B2CE',
        strokeColor: '#2BE0A5',
        strokeWidth: 4,
        startTime: 0,
        endTime: 6,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'screen',
        transform: { ...baseTransform, opacity: 45 },
        keyframes: {
          rotation: [
            { id: `thud_1_${now}`, time: 0, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
            { id: `thud_2_${now}`, time: 6, value: 180, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('vignette')],
      },
    ];
    return { project, layers };
  }

  if (trailerId === 'trailer_hype_promo') {
    const project: ProjectConfig = {
      id: `proj_tr_hype_${now}`,
      name: 'Trailer · Hype Vertical',
      mode: 'project',
      aspectRatio: '9:16',
      width: 720,
      height: 1280,
      fps: 60,
      background: 'black',
      duration: 5,
      beatMarkers: [0.5, 1.5, 2.7, 3.8],
    };
    const layers: Layer[] = [
      {
        id: `th_cam_${now}`,
        name: 'Pulse Camera',
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
            { id: `th_c1_${now}`, time: 0, value: 1.2, easing: { type: 'bezier', p1x: 0.34, p1y: 1.4, p2x: 0.64, p2y: 1 } },
            { id: `th_c2_${now}`, time: 1.5, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
            { id: `th_c3_${now}`, time: 2.7, value: 1.18, easing: { type: 'bezier', p1x: 0.34, p1y: 1.4, p2x: 0.64, p2y: 1 } },
            { id: `th_c4_${now}`, time: 4.5, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [],
      },
      {
        id: `th_t1_${now}`,
        name: 'Drop Word 1',
        type: 'text',
        text: 'READY.',
        fontFamily: 'Oswald',
        fontSize: 108,
        fontWeight: 800,
        letterSpacing: 8,
        fillColor: '#FFFFFF',
        startTime: 0,
        endTime: 1.5,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          scaleX: [
            { id: `tht1_1_${now}`, time: 0, value: 0.2, easing: { type: 'bezier', p1x: 0.34, p1y: 1.5, p2x: 0.64, p2y: 1 } },
            { id: `tht1_2_${now}`, time: 0.55, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('glow')],
      },
      {
        id: `th_t2_${now}`,
        name: 'Drop Word 2',
        type: 'text',
        text: 'SET.',
        fontFamily: 'Oswald',
        fontSize: 118,
        fontWeight: 800,
        letterSpacing: 10,
        fillColor: '#2BE0A5',
        startTime: 1.5,
        endTime: 2.75,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          y: [
            { id: `tht2_1_${now}`, time: 1.5, value: 260, easing: { type: 'bezier', p1x: 0.34, p1y: 1.45, p2x: 0.64, p2y: 1 } },
            { id: `tht2_2_${now}`, time: 2.05, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('chromaticAberration')],
      },
      {
        id: `th_t3_${now}`,
        name: 'Finale Title',
        type: 'text',
        text: 'CREATE NOW',
        fontFamily: 'Archivo',
        fontSize: 82,
        fontWeight: 800,
        letterSpacing: 4,
        fillColor: '#F2A833',
        startTime: 2.7,
        endTime: 5,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {
          rotation: [
            { id: `tht3_r1_${now}`, time: 2.7, value: -12, easing: { type: 'bezier', p1x: 0.34, p1y: 1.45, p2x: 0.64, p2y: 1 } },
            { id: `tht3_r2_${now}`, time: 3.4, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('deepGlow')],
      },
      {
        id: `th_burst_${now}`,
        name: 'Energy Starburst',
        type: 'shape',
        shapeKind: 'burst',
        width: 460,
        height: 460,
        fillColor: '#E84A6F',
        startTime: 0,
        endTime: 5,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'screen',
        transform: { ...baseTransform, opacity: 35 },
        keyframes: {
          rotation: [
            { id: `thb_1_${now}`, time: 0, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
            { id: `thb_2_${now}`, time: 5, value: 220, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [],
      },
    ];
    return { project, layers };
  }

  if (trailerId === 'trailer_product_reveal') {
    const project: ProjectConfig = {
      id: `proj_tr_prod_${now}`,
      name: 'Trailer · Product Showcase',
      mode: 'project',
      aspectRatio: '16:9',
      width: 1280,
      height: 720,
      fps: 60,
      background: 'slate',
      duration: 6,
      beatMarkers: [0.6, 2.2, 4.0],
    };
    const layers: Layer[] = [
      {
        id: `tp_title_${now}`,
        name: 'Product Headline',
        type: 'text',
        text: 'STUDIO PRO X',
        fontFamily: 'Outfit',
        fontSize: 88,
        fontWeight: 800,
        letterSpacing: 10,
        fillColor: '#FFFFFF',
        startTime: 0.4,
        endTime: 6,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: { ...baseTransform, y: -32 },
        keyframes: {
          y: [
            { id: `tpy_1_${now}`, time: 0.4, value: 60, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
            { id: `tpy_2_${now}`, time: 1.6, value: -32, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
          opacity: [
            { id: `tpo_1_${now}`, time: 0.4, value: 0, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
            { id: `tpo_2_${now}`, time: 1.1, value: 100, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('glow')],
      },
      {
        id: `tp_pill_${now}`,
        name: 'Feature Pill Tag',
        type: 'shape',
        shapeKind: 'pill',
        width: 420,
        height: 68,
        fillColor: '#38B2CE',
        startTime: 1.6,
        endTime: 6,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: { ...baseTransform, y: 78 },
        keyframes: {
          scaleX: [
            { id: `tpp_1_${now}`, time: 1.6, value: 0.1, easing: { type: 'bezier', p1x: 0.34, p1y: 1.45, p2x: 0.64, p2y: 1 } },
            { id: `tpp_2_${now}`, time: 2.35, value: 1, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          ],
        },
        effects: [createEffectInstance('smoothBevel')],
      },
      {
        id: `tp_sub_${now}`,
        name: 'Feature Label',
        type: 'text',
        text: '60FPS REALTIME MOTION',
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: 4,
        fillColor: '#0E131D',
        startTime: 1.7,
        endTime: 6,
        visible: true,
        locked: false,
        parentId: `tp_pill_${now}`,
        blendMode: 'normal',
        transform: baseTransform,
        keyframes: {},
        effects: [],
      },
      {
        id: `tp_card_${now}`,
        name: 'Showcase Frame',
        type: 'shape',
        shapeKind: 'roundedRect',
        width: 960,
        height: 440,
        cornerRadius: 42,
        fillColor: '#171C2B',
        strokeColor: '#38B2CE',
        strokeWidth: 3,
        startTime: 0,
        endTime: 6,
        visible: true,
        locked: false,
        parentId: null,
        blendMode: 'normal',
        transform: { ...baseTransform, opacity: 80 },
        keyframes: {},
        effects: [createEffectInstance('vignette')],
      },
    ];
    return { project, layers };
  }

  // Default: trailer_blockbuster
  const project: ProjectConfig = {
    id: `proj_tr_bb_${now}`,
    name: 'Trailer · Blockbuster',
    mode: 'project',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    fps: 60,
    background: 'black',
    duration: 6,
    beatMarkers: [0.4, 2.0, 3.6, 5.2],
  };
  const layers: Layer[] = [
    {
      id: `tb_cam_${now}`,
      name: 'Cinema Push Camera',
      type: 'camera',
      cameraActive: true,
      startTime: 0,
      endTime: 6,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: baseTransform,
      keyframes: {
        scaleX: [
          { id: `tbc_1_${now}`, time: 0, value: 1.35, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
          { id: `tbc_2_${now}`, time: 6, value: 1.0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
        ],
        scaleY: [
          { id: `tbcy_1_${now}`, time: 0, value: 1.35, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
          { id: `tbcy_2_${now}`, time: 6, value: 1.0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
        ],
      },
      effects: [],
    },
    {
      id: `tb_card1_${now}`,
      name: 'Card 1 · THIS SUMMER',
      type: 'text',
      text: 'THIS SEASON',
      fontFamily: 'Playfair Display',
      fontSize: 64,
      fontWeight: 700,
      letterSpacing: 14,
      fillColor: '#F2A833',
      startTime: 0,
      endTime: 2.0,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: baseTransform,
      keyframes: {
        letterSpacing: [
          { id: `tbc1_l1_${now}`, time: 0, value: 36, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
          { id: `tbc1_l2_${now}`, time: 1.8, value: 12, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
        ],
        opacity: [
          { id: `tbc1_o1_${now}`, time: 0, value: 0, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
          { id: `tbc1_o2_${now}`, time: 0.5, value: 100, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          { id: `tbc1_o3_${now}`, time: 1.95, value: 0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
        ],
      },
      effects: [createEffectInstance('glow')],
    },
    {
      id: `tb_card2_${now}`,
      name: 'Card 2 · UNLEASHED',
      type: 'text',
      text: 'NO LIMITS',
      fontFamily: 'Oswald',
      fontSize: 104,
      fontWeight: 800,
      letterSpacing: 16,
      fillColor: '#FFFFFF',
      startTime: 2.0,
      endTime: 3.6,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: baseTransform,
      keyframes: {
        scaleX: [
          { id: `tbc2_s1_${now}`, time: 2.0, value: 1.7, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
          { id: `tbc2_s2_${now}`, time: 2.6, value: 1.0, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
        ],
      },
      effects: [createEffectInstance('shake'), createEffectInstance('deepGlow')],
    },
    {
      id: `tb_card3_${now}`,
      name: 'Card 3 · MAIN TITLE',
      type: 'text',
      text: 'HORIZON',
      fontFamily: 'Outfit',
      fontSize: 122,
      fontWeight: 800,
      letterSpacing: 20,
      fillColor: '#EEF1F7',
      startTime: 3.6,
      endTime: 6.0,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'normal',
      transform: baseTransform,
      keyframes: {
        opacity: [
          { id: `tbc3_o1_${now}`, time: 3.6, value: 0, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
          { id: `tbc3_o2_${now}`, time: 4.3, value: 100, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
        ],
        letterSpacing: [
          { id: `tbc3_l1_${now}`, time: 3.6, value: 42, easing: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 } },
          { id: `tbc3_l2_${now}`, time: 5.5, value: 16, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
        ],
      },
      effects: [createEffectInstance('deepGlow')],
    },
    {
      id: `tb_ring_${now}`,
      name: 'Golden Flare Arc',
      type: 'shape',
      shapeKind: 'arc',
      width: 520,
      height: 520,
      innerRadiusRatio: 0.88,
      fillColor: '#F2A833',
      startTime: 0,
      endTime: 6,
      visible: true,
      locked: false,
      parentId: null,
      blendMode: 'screen',
      transform: { ...baseTransform, opacity: 55 },
      keyframes: {
        rotation: [
          { id: `tbr_1_${now}`, time: 0, value: -90, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
          { id: `tbr_2_${now}`, time: 6, value: 210, easing: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 } },
        ],
      },
      effects: [createEffectInstance('vignette')],
    },
  ];
  return { project, layers };
}

