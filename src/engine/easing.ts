import {
  EasingCurve,
  Keyframe,
  Layer,
  LayerTransform,
  NumericAnimatableProp,
} from '../types/editor';

export const EASING_PRESETS: Array<{
  id: string;
  label: string;
  curve: EasingCurve;
}> = [
  {
    id: 'linear',
    label: 'Linear',
    curve: { type: 'bezier', p1x: 0.25, p1y: 0.25, p2x: 0.75, p2y: 0.75 },
  },
  {
    id: 'ease-in-out',
    label: 'Smooth S',
    curve: { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
  },
  {
    id: 'ease-out',
    label: 'Ease Out',
    curve: { type: 'bezier', p1x: 0.16, p1y: 1, p2x: 0.3, p2y: 1 },
  },
  {
    id: 'ease-in',
    label: 'Ease In',
    curve: { type: 'bezier', p1x: 0.7, p1y: 0, p2x: 0.84, p2y: 0 },
  },
  {
    id: 'overshoot',
    label: 'Overshoot',
    curve: { type: 'bezier', p1x: 0.34, p1y: 1.45, p2x: 0.64, p2y: 1 },
  },
  {
    id: 'snap',
    label: 'Snap Pop',
    curve: { type: 'bezier', p1x: 0.12, p1y: 1.25, p2x: 0.22, p2y: 1 },
  },
  {
    id: 'steps',
    label: 'Steps',
    curve: { type: 'steps', steps: 4 },
  },
];

/**
 * Evaluate cubic bezier at normalized progress x in [0, 1].
 * Uses Newton-Raphson + guaranteed binary fallback when residual exceeds tolerance.
 */
export function evaluateEasing(curve: EasingCurve, t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  if (curve.type === 'steps') {
    const count = Math.max(1, Math.round(curve.steps));
    if (clampedT >= 1) return 1;
    return Math.floor(clampedT * count) / count;
  }

  const p1x = Math.max(0, Math.min(1, curve.p1x));
  const p2x = Math.max(0, Math.min(1, curve.p2x));
  const { p1y, p2y } = curve;

  if (clampedT <= 0) return 0;
  if (clampedT >= 1) return 1;

  // Fast linear path
  if (p1x === p1y && p2x === p2y) {
    return clampedT;
  }

  const sampleCurveX = (u: number) =>
    ((1 - 3 * p2x + 3 * p1x) * u + (3 * p2x - 6 * p1x)) * u * u + 3 * p1x * u;

  const sampleCurveY = (u: number) =>
    ((1 - 3 * p2y + 3 * p1y) * u + (3 * p2y - 6 * p1y)) * u * u + 3 * p1y * u;

  const sampleCurveDerivativeX = (u: number) =>
    (3 * (1 - 3 * p2x + 3 * p1x) * u + 2 * (3 * p2x - 6 * p1x)) * u + 3 * p1x;

  // Newton-Raphson solve for x(u) = clampedT
  let u = clampedT;
  for (let i = 0; i < 8; i++) {
    const err = sampleCurveX(u) - clampedT;
    if (Math.abs(err) < 1e-5) break;
    const d = sampleCurveDerivativeX(u);
    if (Math.abs(d) < 1e-5) break;
    u -= err / d;
  }

  // Always run binary subdivision fallback if Newton wandered or left residual error
  if (
    u < 0 ||
    u > 1 ||
    Number.isNaN(u) ||
    Math.abs(sampleCurveX(u) - clampedT) > 1e-4
  ) {
    let lo = 0;
    let hi = 1;
    u = clampedT;
    for (let i = 0; i < 16; i++) {
      const x = sampleCurveX(u);
      if (Math.abs(x - clampedT) < 1e-5) break;
      if (clampedT > x) lo = u;
      else hi = u;
      u = (lo + hi) * 0.5;
    }
  }

  return sampleCurveY(Math.max(0, Math.min(1, u)));
}

/**
 * Evaluate a single animatable numeric property on a layer at a given timeline time (seconds).
 */
export function evaluateProperty(
  keyframes: Keyframe<number>[] | undefined,
  fallback: number,
  time: number
): number {
  if (!keyframes || keyframes.length === 0) return fallback;
  const sorted =
    keyframes.length > 1
      ? [...keyframes].sort((a, b) => a.time - b.time)
      : keyframes;

  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) {
    return sorted[sorted.length - 1].value;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const k0 = sorted[i];
    const k1 = sorted[i + 1];
    if (time >= k0.time && time <= k1.time) {
      const span = k1.time - k0.time;
      if (span <= 1e-6) return k1.value;
      const rawProgress = (time - k0.time) / span;
      const eased = evaluateEasing(k0.easing, rawProgress);
      return k0.value + (k1.value - k0.value) * eased;
    }
  }

  return fallback;
}

export function evaluateLayerTransform(
  layer: Layer,
  time: number
): LayerTransform {
  const t = layer.transform;
  const k = layer.keyframes;
  return {
    x: evaluateProperty(k.x, t.x, time),
    y: evaluateProperty(k.y, t.y, time),
    scaleX: evaluateProperty(k.scaleX, t.scaleX, time),
    scaleY: evaluateProperty(k.scaleY, t.scaleY, time),
    rotation: evaluateProperty(k.rotation, t.rotation, time),
    rotateX: evaluateProperty(k.rotateX, t.rotateX ?? 0, time),
    rotateY: evaluateProperty(k.rotateY, t.rotateY ?? 0, time),
    skewX: evaluateProperty(k.skewX, t.skewX, time),
    skewY: evaluateProperty(k.skewY, t.skewY, time),
    anchorX: evaluateProperty(k.anchorX, t.anchorX, time),
    anchorY: evaluateProperty(k.anchorY, t.anchorY, time),
    opacity: Math.max(0, Math.min(100, evaluateProperty(k.opacity, t.opacity, time))),
  };
}

export function evaluateLayerExtraProp(
  layer: Layer,
  prop: NumericAnimatableProp,
  fallback: number,
  time: number
): number {
  return evaluateProperty(layer.keyframes[prop], fallback, time);
}

/**
 * Collect sorted unique keyframe timestamps across all properties of a layer.
 */
export function getLayerKeyframeTimes(layer: Layer): number[] {
  const set = new Set<number>();
  Object.values(layer.keyframes).forEach((arr) => {
    arr?.forEach((kf) => set.add(Number(kf.time.toFixed(3))));
  });
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Format seconds as MM:SS:FF (matching Alight Motion's 00:07:33 display).
 */
export function formatTimecode(seconds: number, fps = 60): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const frames = Math.floor((clamped % 1) * fps);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}
