export type AspectRatioPreset = '16:9' | '9:16' | '4:5' | '1:1' | '4:3';

export type ProjectBackground = 'black' | 'white' | 'transparent' | 'slate';

export interface ProjectConfig {
  id: string;
  name: string;
  mode: 'project' | 'element';
  aspectRatio: AspectRatioPreset;
  width: number;
  height: number;
  fps: 24 | 30 | 60;
  background: ProjectBackground;
  duration: number; // total timeline duration in seconds
  beatMarkers: number[]; // red marker timestamps in seconds
}

export type EasingCurve =
  | {
      type: 'bezier';
      p1x: number;
      p1y: number;
      p2x: number;
      p2y: number;
    }
  | {
      type: 'steps';
      steps: number;
    };

export interface Keyframe<T = number> {
  id: string;
  time: number; // absolute timeline seconds
  value: T;
  easing: EasingCurve; // easing FROM this keyframe TO the next keyframe
}

export type NumericAnimatableProp =
  | 'x'
  | 'y'
  | 'scaleX'
  | 'scaleY'
  | 'rotation'
  | 'rotateX'
  | 'rotateY'
  | 'skewX'
  | 'skewY'
  | 'anchorX'
  | 'anchorY'
  | 'opacity'
  | 'strokeWidth'
  | 'letterSpacing'
  | 'cornerRadius';

export type AxisLockMode = 'both' | 'x' | 'y';

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'darken'
  | 'color-burn'
  | 'screen'
  | 'lighten'
  | 'color-dodge'
  | 'overlay'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export type EffectType =
  | 'gaussianBlur'
  | 'directionalBlur'
  | 'glow'
  | 'deepGlow'
  | 'exposureGamma'
  | 'hueShift'
  | 'colorize'
  | 'threeColorGradient'
  | 'chromaticAberration'
  | 'waveWarp'
  | 'squeeze'
  | 'vignette'
  | 'fadeInOut'
  | 'blink'
  | 'invert'
  | 'pixelate'
  | 'oscillate'
  | 'shake'
  | 'extrude3d'
  | 'smoothBevel'
  | 'radialRepeat'
  | 'linearRepeat'
  | 'chromaKey'
  | 'drawingProgress'
  | 'textProgress'
  | 'countUpDown'
  | 'textRandomizer'
  | 'textSpacing'
  | 'textTransform'
  | 'timecode';

export interface EffectInstance {
  id: string;
  type: EffectType;
  name: string;
  enabled: boolean;
  params: Record<string, number | string>;
}

export type LayerType =
  | 'shape'
  | 'text'
  | 'media'
  | 'audio'
  | 'null'
  | 'camera'
  | 'group'
  | 'vector'
  | 'freehand';

export type ShapeKind =
  | 'circle'
  | 'rect'
  | 'roundedRect'
  | 'triangle'
  | 'star'
  | 'polygon'
  | 'ring'
  | 'cross'
  | 'arrow'
  | 'pill'
  | 'arc'
  | 'diamond'
  | 'heart'
  | 'burst'
  | 'spiral'
  | 'hudGrid'
  | 'bracket'
  | 'wave'
  | 'badge';

export interface VectorPoint {
  x: number; // relative to layer center
  y: number;
}

export interface LayerTransform {
  x: number; // pixels relative to canvas center (0,0 = center)
  y: number;
  scaleX: number; // 1 = 100%
  scaleY: number;
  rotation: number; // Z-axis degrees
  rotateX?: number; // X-axis tilt degrees
  rotateY?: number; // Y-axis tilt degrees
  skewX: number; // degrees
  skewY: number;
  anchorX: number; // pixel offset from layer center
  anchorY: number;
  opacity: number; // 0..100
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  startTime: number; // seconds
  endTime: number; // seconds
  visible: boolean;
  locked: boolean;
  parentId: string | null; // Null, Group, or another layer ID
  blendMode: BlendMode;
  transform: LayerTransform;
  keyframes: Partial<Record<NumericAnimatableProp, Keyframe<number>[]>>;
  effects: EffectInstance[];

  // Shape specific
  shapeKind?: ShapeKind;
  width?: number;
  height?: number;
  fillColor?: string;
  fillGradient?: { enabled: boolean; color1: string; color2: string; angle: number };
  strokeColor?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  pointsCount?: number; // for star/polygon/burst
  innerRadiusRatio?: number; // for star/ring/arc/burst
  shadow?: { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number };

  // Text specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  lineHeight?: number;

  // Media specific
  mediaUrl?: string;
  mediaKind?: 'image' | 'video';

  // Audio specific
  audioUrl?: string;
  audioVolume?: number; // 0..1
  waveformPeaks?: number[];

  // Vector / Freehand points
  pathPoints?: VectorPoint[];
  closedPath?: boolean;

  // Camera & Mask / Group specific
  cameraActive?: boolean;
  isMask?: boolean;
  maskMode?: 'none' | 'clip';
}

export interface LayerPreset {
  id: string;
  name: string;
  category: 'Motion' | 'Style' | 'Text' | 'Custom';
  description: string;
  effects?: EffectInstance[];
  keyframes?: Partial<Record<NumericAnimatableProp, Keyframe<number>[]>>;
  stylePatch?: Partial<Pick<Layer, 'fillColor' | 'fillGradient' | 'strokeColor' | 'strokeWidth' | 'blendMode' | 'shadow'>>;
}

export interface LayerStyleClipboard {
  fillColor?: string;
  fillGradient?: { enabled: boolean; color1: string; color2: string; angle: number };
  strokeColor?: string;
  strokeWidth?: number;
  blendMode: BlendMode;
  opacity: number;
  shadow?: { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number };
}

export type InspectorTab =
  | 'transform'
  | 'easing'
  | 'color'
  | 'blending'
  | 'effects'
  | 'properties';

export type CreationCategory =
  | 'shape'
  | 'media'
  | 'audio'
  | 'object'
  | 'elements'
  | 'text'
  | 'vector'
  | 'freehand';
