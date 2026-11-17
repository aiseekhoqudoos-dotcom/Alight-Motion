import {
  BlendMode,
  EffectInstance,
  Layer,
  LayerTransform,
  ProjectConfig,
  ShapeKind,
} from '../types/editor';
import {
  evaluateLayerExtraProp,
  evaluateLayerTransform,
  formatTimecode,
} from './easing';

const mediaCache = new Map<string, HTMLImageElement | HTMLVideoElement>();
const chromaCache = new Map<string, HTMLCanvasElement>();

export function getOrLoadMedia(
  url: string,
  kind: 'image' | 'video'
): HTMLImageElement | HTMLVideoElement | null {
  if (!url) return null;
  const cached = mediaCache.get(url);
  if (cached) return cached;

  if (kind === 'image') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    mediaCache.set(url, img);
    return img;
  } else {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    mediaCache.set(url, video);
    return video;
  }
}

function mapBlendMode(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case 'multiply':
      return 'multiply';
    case 'darken':
      return 'darken';
    case 'color-burn':
      return 'color-burn';
    case 'screen':
      return 'screen';
    case 'lighten':
      return 'lighten';
    case 'color-dodge':
      return 'color-dodge';
    case 'overlay':
      return 'overlay';
    case 'hard-light':
      return 'hard-light';
    case 'soft-light':
      return 'soft-light';
    case 'difference':
      return 'difference';
    case 'exclusion':
      return 'exclusion';
    case 'hue':
      return 'hue';
    case 'saturation':
      return 'saturation';
    case 'color':
      return 'color';
    case 'luminosity':
      return 'luminosity';
    default:
      return 'source-over';
  }
}

function apply3DAxisTilt(ctx: CanvasRenderingContext2D, t: LayerTransform) {
  const rx = ((t.rotateX ?? 0) * Math.PI) / 180;
  const ry = ((t.rotateY ?? 0) * Math.PI) / 180;
  if (rx !== 0 || ry !== 0) {
    const sx = Math.cos(ry);
    const sy = Math.cos(rx);
    const skewY = Math.sin(ry) * 0.22;
    const skewX = Math.sin(rx) * 0.22;
    ctx.transform(sx, skewY, skewX, sy, 0, 0);
  }
}

/**
 * Apply hierarchical parent transforms recursively (up to depth 12 to avoid cycles).
 */
export function applyParentChain(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  layerMap: Map<string, Layer>,
  time: number,
  depth = 0
): void {
  if (depth > 12 || !layer.parentId) return;
  const parent = layerMap.get(layer.parentId);
  if (!parent) return;

  applyParentChain(ctx, parent, layerMap, time, depth + 1);
  const pt = evaluateLayerTransform(parent, time);
  ctx.translate(pt.x, pt.y);
  ctx.rotate((pt.rotation * Math.PI) / 180);
  apply3DAxisTilt(ctx, pt);
  ctx.scale(pt.scaleX, pt.scaleY);
  if (pt.skewX !== 0 || pt.skewY !== 0) {
    ctx.transform(
      1,
      Math.tan((pt.skewY * Math.PI) / 180),
      Math.tan((pt.skewX * Math.PI) / 180),
      1,
      0,
      0
    );
  }
}

/**
 * Compute world-space center of a layer (approximate for hit-testing & gizmos).
 */
export function getLayerWorldTransform(
  layer: Layer,
  layers: Layer[],
  time: number,
  project: ProjectConfig
): { x: number; y: number; rotation: number; scaleX: number; scaleY: number } {
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  const chain: Layer[] = [];
  let cur: Layer | undefined = layer;
  let guard = 0;
  while (cur && guard < 12) {
    chain.unshift(cur);
    cur = cur.parentId ? layerMap.get(cur.parentId) : undefined;
    guard++;
  }

  let wx = 0;
  let wy = 0;
  let wRot = 0;
  let wSx = 1;
  let wSy = 1;

  for (const item of chain) {
    const t = evaluateLayerTransform(item, time);
    const rad = (wRot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const sx = t.x * wSx;
    const sy = t.y * wSy;
    wx += sx * cos - sy * sin;
    wy += sx * sin + sy * cos;
    wRot += t.rotation;
    wSx *= t.scaleX * Math.cos(((t.rotateY ?? 0) * Math.PI) / 180);
    wSy *= t.scaleY * Math.cos(((t.rotateX ?? 0) * Math.PI) / 180);
  }

  const activeCam = layers.find(
    (l) =>
      l.type === 'camera' &&
      l.visible &&
      time >= l.startTime &&
      time <= l.endTime
  );
  if (activeCam && activeCam.id !== layer.id) {
    const camT = evaluateLayerTransform(activeCam, time);
    wx = (wx - camT.x) * camT.scaleX;
    wy = (wy - camT.y) * camT.scaleY;
    wSx *= camT.scaleX;
    wSy *= camT.scaleY;
    wRot -= camT.rotation;
  }

  return {
    x: project.width / 2 + wx,
    y: project.height / 2 + wy,
    rotation: wRot,
    scaleX: wSx,
    scaleY: wSy,
  };
}

function drawShapePath(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  w: number,
  h: number,
  cornerRadius: number,
  pointsCount: number,
  innerRatio: number
) {
  const hw = w / 2;
  const hh = h / 2;
  ctx.beginPath();

  switch (kind) {
    case 'circle': {
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      break;
    }
    case 'rect': {
      ctx.rect(-hw, -hh, w, h);
      break;
    }
    case 'roundedRect':
    case 'pill': {
      const r = kind === 'pill' ? Math.min(hw, hh) : Math.min(cornerRadius, hw, hh);
      ctx.roundRect(-hw, -hh, w, h, Math.max(0, r));
      break;
    }
    case 'triangle': {
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw, hh);
      ctx.lineTo(-hw, hh);
      ctx.closePath();
      break;
    }
    case 'diamond': {
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw, 0);
      ctx.lineTo(0, hh);
      ctx.lineTo(-hw, 0);
      ctx.closePath();
      break;
    }
    case 'heart': {
      const topCurveH = hh * 0.3;
      ctx.moveTo(0, hh * 0.85);
      ctx.bezierCurveTo(-hw * 1.15, hh * 0.15, -hw * 0.95, -hh * 0.95, 0, -topCurveH);
      ctx.bezierCurveTo(hw * 0.95, -hh * 0.95, hw * 1.15, hh * 0.15, 0, hh * 0.85);
      ctx.closePath();
      break;
    }
    case 'polygon': {
      const sides = Math.max(3, Math.round(pointsCount || 6));
      for (let i = 0; i < sides; i++) {
        const angle = (i * Math.PI * 2) / sides - Math.PI / 2;
        const px = Math.cos(angle) * hw;
        const py = Math.sin(angle) * hh;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'star':
    case 'burst': {
      const spikes = kind === 'burst' ? Math.max(8, Math.round(pointsCount || 12)) : Math.max(3, Math.round(pointsCount || 5));
      const inner = kind === 'burst' ? 0.55 : Math.max(0.15, Math.min(0.9, innerRatio || 0.45));
      for (let i = 0; i < spikes * 2; i++) {
        const rX = i % 2 === 0 ? hw : hw * inner;
        const rY = i % 2 === 0 ? hh : hh * inner;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const px = Math.cos(angle) * rX;
        const py = Math.sin(angle) * rY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'ring': {
      const inner = Math.max(0.1, Math.min(0.92, innerRatio || 0.68));
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      ctx.moveTo(hw * inner, 0);
      ctx.ellipse(0, 0, hw * inner, hh * inner, 0, 0, Math.PI * 2, true);
      break;
    }
    case 'arc': {
      const inner = Math.max(0.1, Math.min(0.92, innerRatio || 0.72));
      const start = -Math.PI * 0.75;
      const end = Math.PI * 0.75;
      ctx.arc(0, 0, hw, start, end);
      ctx.arc(0, 0, hw * inner, end, start, true);
      ctx.closePath();
      break;
    }
    case 'cross': {
      const arm = Math.min(hw, hh) * 0.34;
      ctx.moveTo(-arm, -hh);
      ctx.lineTo(arm, -hh);
      ctx.lineTo(arm, -arm);
      ctx.lineTo(hw, -arm);
      ctx.lineTo(hw, arm);
      ctx.lineTo(arm, arm);
      ctx.lineTo(arm, hh);
      ctx.lineTo(-arm, hh);
      ctx.lineTo(-arm, arm);
      ctx.lineTo(-hw, arm);
      ctx.lineTo(-hw, -arm);
      ctx.lineTo(-arm, -arm);
      ctx.closePath();
      break;
    }
    case 'arrow': {
      const shaftH = hh * 0.36;
      const headX = hw * 0.25;
      ctx.moveTo(-hw, -shaftH);
      ctx.lineTo(headX, -shaftH);
      ctx.lineTo(headX, -hh);
      ctx.lineTo(hw, 0);
      ctx.lineTo(headX, hh);
      ctx.lineTo(headX, shaftH);
      ctx.lineTo(-hw, shaftH);
      ctx.closePath();
      break;
    }
    case 'spiral': {
      const turns = 3;
      const steps = 72;
      for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        const ang = frac * Math.PI * 2 * turns;
        const rx = Math.cos(ang) * hw * frac;
        const ry = Math.sin(ang) * hh * frac;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      break;
    }
    case 'hudGrid': {
      ctx.rect(-hw, -hh, w, h);
      const r = Math.min(hw, hh) * 0.65;
      ctx.moveTo(r, 0);
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(-hw, 0);
      ctx.lineTo(-r * 0.45, 0);
      ctx.moveTo(r * 0.45, 0);
      ctx.lineTo(hw, 0);
      ctx.moveTo(0, -hh);
      ctx.lineTo(0, -r * 0.45);
      ctx.moveTo(0, r * 0.45);
      ctx.lineTo(0, hh);
      break;
    }
    case 'bracket': {
      const t = Math.min(hw, hh) * 0.35;
      // Top-left
      ctx.moveTo(-hw, -hh + t);
      ctx.lineTo(-hw, -hh);
      ctx.lineTo(-hw + t, -hh);
      // Top-right
      ctx.moveTo(hw - t, -hh);
      ctx.lineTo(hw, -hh);
      ctx.lineTo(hw, -hh + t);
      // Bottom-right
      ctx.moveTo(hw, hh - t);
      ctx.lineTo(hw, hh);
      ctx.lineTo(hw - t, hh);
      // Bottom-left
      ctx.moveTo(-hw + t, hh);
      ctx.lineTo(-hw, hh);
      ctx.lineTo(-hw, hh - t);
      break;
    }
    case 'wave': {
      const segs = 40;
      ctx.moveTo(-hw, 0);
      for (let i = 0; i <= segs; i++) {
        const x = -hw + (i / segs) * w;
        const y = Math.sin((i / segs) * Math.PI * 4) * (hh * 0.5);
        ctx.lineTo(x, y);
      }
      break;
    }
    case 'badge': {
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw * 0.9, -hh * 0.65);
      ctx.quadraticCurveTo(hw * 0.92, hh * 0.35, 0, hh);
      ctx.quadraticCurveTo(-hw * 0.92, hh * 0.35, -hw * 0.9, -hh * 0.65);
      ctx.closePath();
      break;
    }
  }
}

function buildFilterString(effects: EffectInstance[]): string {
  const parts: string[] = [];
  for (const fx of effects) {
    if (!fx.enabled) continue;
    switch (fx.type) {
      case 'gaussianBlur': {
        const radius = Number(fx.params.radius ?? 8);
        if (radius > 0) parts.push(`blur(${radius}px)`);
        break;
      }
      case 'exposureGamma': {
        const brightness = Number(fx.params.brightness ?? 100);
        const contrast = Number(fx.params.contrast ?? 100);
        parts.push(`brightness(${brightness}%) contrast(${contrast}%)`);
        break;
      }
      case 'hueShift': {
        const hue = Number(fx.params.hue ?? 0);
        const sat = Number(fx.params.saturation ?? 100);
        parts.push(`hue-rotate(${hue}deg) saturate(${sat}%)`);
        break;
      }
      case 'invert': {
        const amount = Number(fx.params.amount ?? 100);
        parts.push(`invert(${amount}%)`);
        break;
      }
    }
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

function resolveDynamicText(layer: Layer, time: number): {
  text: string;
  extraSpacing: number;
} {
  let txt = layer.text || 'Text';
  let extraSpacing = 0;
  const span = Math.max(0.1, layer.endTime - layer.startTime);
  const progress = Math.max(0, Math.min(1, (time - layer.startTime) / span));

  for (const fx of layer.effects) {
    if (!fx.enabled) continue;
    if (fx.type === 'countUpDown') {
      const from = Number(fx.params.from ?? 0);
      const to = Number(fx.params.to ?? 100);
      const dec = Math.max(0, Math.min(3, Math.round(Number(fx.params.decimals ?? 0))));
      const val = from + (to - from) * progress;
      const suffix = txt.includes('%') ? '%' : '';
      txt = `${val.toFixed(dec)}${suffix}`;
    } else if (fx.type === 'timecode') {
      const speed = Number(fx.params.speed ?? 1);
      txt = formatTimecode(Math.max(0, (time - layer.startTime) * speed), 60);
    } else if (fx.type === 'textProgress') {
      const endPct = Math.max(0, Math.min(100, Number(fx.params.end ?? 100)));
      const showCursor = Number(fx.params.cursor ?? 1) > 0;
      const effectivePct = progress * (endPct / 100);
      const len = Math.max(0, Math.round(txt.length * effectivePct));
      const sliced = txt.slice(0, len);
      const blink = Math.floor(time * 2.5) % 2 === 0;
      txt = showCursor && blink ? `${sliced}|` : sliced;
    } else if (fx.type === 'textRandomizer') {
      const amt = Math.max(0, Math.min(100, Number(fx.params.amount ?? 45))) / 100;
      const speed = Number(fx.params.speed ?? 12);
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789*#$%';
      const tick = Math.floor(time * speed);
      txt = txt
        .split('')
        .map((ch, idx) => {
          if (ch === ' ' || ch === '\n') return ch;
          const hash = Math.abs(Math.sin((idx + 1) * 19.3 + tick * 7.1));
          if (hash < amt) {
            return chars[Math.floor(hash * chars.length * 13) % chars.length];
          }
          return ch;
        })
        .join('');
    } else if (fx.type === 'textSpacing') {
      extraSpacing += Number(fx.params.spacing ?? 18);
    }
  }
  return { text: txt, extraSpacing };
}

export function getLayerBounds(layer: Layer): { width: number; height: number } {
  if (layer.type === 'text') {
    const fontSize = layer.fontSize ?? 64;
    const text = layer.text || 'Text';
    const lines = text.split('\n');
    const maxChars = Math.max(...lines.map((l) => l.length), 1);
    return {
      width: Math.max(120, maxChars * fontSize * 0.62),
      height: Math.max(60, lines.length * fontSize * (layer.lineHeight ?? 1.2)),
    };
  }
  if (layer.type === 'null' || layer.type === 'camera' || layer.type === 'group') {
    return { width: 120, height: 120 };
  }
  if (layer.type === 'vector' || layer.type === 'freehand') {
    const pts = layer.pathPoints || [];
    if (pts.length === 0) return { width: 160, height: 160 };
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      width: Math.max(80, Math.max(...xs) - Math.min(...xs) + 32),
      height: Math.max(80, Math.max(...ys) - Math.min(...ys) + 32),
    };
  }
  return {
    width: layer.width ?? 280,
    height: layer.height ?? 280,
  };
}

function getChromaKeyedCanvas(
  mediaEl: HTMLImageElement,
  url: string,
  targetHue: number,
  tolerance: number
): HTMLCanvasElement {
  const key = `${url}_${targetHue}_${tolerance}`;
  const existing = chromaCache.get(key);
  if (existing) return existing;

  const off = document.createElement('canvas');
  off.width = mediaEl.naturalWidth;
  off.height = mediaEl.naturalHeight;
  const oCtx = off.getContext('2d');
  if (!oCtx) return off;
  oCtx.drawImage(mediaEl, 0, 0);
  try {
    const imgData = oCtx.getImageData(0, 0, off.width, off.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      // Green-dominant or blue-dominant keying heuristic
      if (targetHue >= 75 && targetHue <= 165) {
        if (g > r + tolerance && g > b + tolerance) d[i + 3] = 0;
      } else if (targetHue >= 180 && targetHue <= 260) {
        if (b > r + tolerance && b > g + tolerance) d[i + 3] = 0;
      }
    }
    oCtx.putImageData(imgData, 0, 0);
  } catch {
    // CORS fallback
  }
  chromaCache.set(key, off);
  return off;
}

/**
 * Main 60fps canvas frame render function.
 */
export function renderProjectFrame(
  ctx: CanvasRenderingContext2D,
  project: ProjectConfig,
  layers: Layer[],
  time: number,
  options: {
    selectedLayerIds?: string[];
    showGizmos?: boolean;
    showGrid?: boolean;
  } = {}
) {
  const { width, height, background } = project;
  const { selectedLayerIds = [], showGizmos = true, showGrid = false } = options;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  if (background === 'black') {
    ctx.fillStyle = '#090B10';
    ctx.fillRect(0, 0, width, height);
  } else if (background === 'white') {
    ctx.fillStyle = '#F7F8FA';
    ctx.fillRect(0, 0, width, height);
  } else if (background === 'slate') {
    ctx.fillStyle = '#181C28';
    ctx.fillRect(0, 0, width, height);
  }

  if (showGrid && showGizmos) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    const step = Math.round(Math.min(width, height) / 8);
    for (let x = step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(43, 224, 165, 0.24)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.restore();
  }

  const layerMap = new Map(layers.map((l) => [l.id, l]));

  const activeCamera = layers.find(
    (l) =>
      l.type === 'camera' &&
      l.visible &&
      time >= l.startTime &&
      time <= l.endTime
  );
  const camTransform: LayerTransform | null = activeCamera
    ? evaluateLayerTransform(activeCamera, time)
    : null;

  const drawSingleLayer = (
    targetCtx: CanvasRenderingContext2D,
    layer: Layer,
    overrideComposite?: GlobalCompositeOperation
  ) => {
    const t = evaluateLayerTransform(layer, time);
    if (t.opacity <= 0.1 && layer.type !== 'null' && layer.type !== 'group') return;

    let effectiveOpacity = t.opacity / 100;
    let oscX = 0;
    let oscY = 0;
    let oscRot = 0;
    let squeezeX = 1;
    let squeezeY = 1;

    for (const fx of layer.effects) {
      if (!fx.enabled) continue;
      if (fx.type === 'fadeInOut') {
        const fadeIn = Number(fx.params.fadeIn ?? 0.5);
        const fadeOut = Number(fx.params.fadeOut ?? 0.5);
        const elapsed = time - layer.startTime;
        const remaining = layer.endTime - time;
        if (fadeIn > 0 && elapsed < fadeIn) {
          effectiveOpacity *= Math.max(0, elapsed / fadeIn);
        }
        if (fadeOut > 0 && remaining < fadeOut) {
          effectiveOpacity *= Math.max(0, remaining / fadeOut);
        }
      } else if (fx.type === 'blink') {
        const freq = Number(fx.params.frequency ?? 3);
        const minOp = Math.max(0, Math.min(100, Number(fx.params.minOpacity ?? 25))) / 100;
        const pulse = 0.5 + 0.5 * Math.sin(time * freq * Math.PI * 2);
        effectiveOpacity *= minOp + (1 - minOp) * pulse;
      } else if (fx.type === 'oscillate') {
        const freq = Number(fx.params.frequency ?? 2);
        const amp = Number(fx.params.magnitude ?? 14);
        const angleRad = (Number(fx.params.angle ?? 90) * Math.PI) / 180;
        const wave = Math.sin(time * freq * Math.PI * 2);
        oscX += Math.cos(angleRad) * wave * amp;
        oscY += Math.sin(angleRad) * wave * amp;
      } else if (fx.type === 'shake') {
        const freq = Number(fx.params.frequency ?? 6);
        const amp = Number(fx.params.magnitude ?? 10);
        oscX += Math.sin(time * freq * 11.3) * amp;
        oscY += Math.cos(time * freq * 14.7) * amp;
      } else if (fx.type === 'waveWarp') {
        const freq = Number(fx.params.frequency ?? 3);
        const amp = Number(fx.params.magnitude ?? 6);
        oscRot += Math.sin(time * freq * Math.PI) * amp * 0.4;
      } else if (fx.type === 'squeeze') {
        const amt = Number(fx.params.amount ?? 22) / 100;
        squeezeX *= 1 + amt * 0.5;
        squeezeY *= Math.max(0.35, 1 - amt * 0.4);
      }
    }

    targetCtx.save();
    targetCtx.translate(width / 2, height / 2);

    if (camTransform) {
      targetCtx.scale(camTransform.scaleX, camTransform.scaleY);
      targetCtx.rotate((-camTransform.rotation * Math.PI) / 180);
      apply3DAxisTilt(targetCtx, camTransform);
      targetCtx.translate(-camTransform.x, -camTransform.y);
    }

    applyParentChain(targetCtx, layer, layerMap, time);

    targetCtx.translate(t.x + oscX, t.y + oscY);
    targetCtx.rotate(((t.rotation + oscRot) * Math.PI) / 180);
    apply3DAxisTilt(targetCtx, t);
    targetCtx.scale(t.scaleX * squeezeX, t.scaleY * squeezeY);
    if (t.skewX !== 0 || t.skewY !== 0) {
      targetCtx.transform(
        1,
        Math.tan((t.skewY * Math.PI) / 180),
        Math.tan((t.skewX * Math.PI) / 180),
        1,
        0,
        0
      );
    }
    targetCtx.translate(-t.anchorX, -t.anchorY);

    targetCtx.globalAlpha = Math.max(0, Math.min(1, effectiveOpacity));
    targetCtx.globalCompositeOperation = overrideComposite ?? mapBlendMode(layer.blendMode);
    targetCtx.filter = buildFilterString(layer.effects);

    const deepGlowFx = layer.effects.find((f) => f.enabled && f.type === 'deepGlow');
    const glowFx = layer.effects.find((f) => f.enabled && f.type === 'glow');
    if (deepGlowFx) {
      targetCtx.shadowColor = String(deepGlowFx.params.color ?? '#2BE0A5');
      targetCtx.shadowBlur = Number(deepGlowFx.params.radius ?? 42) * Number(deepGlowFx.params.intensity ?? 2);
      targetCtx.shadowOffsetX = 0;
      targetCtx.shadowOffsetY = 0;
    } else if (glowFx) {
      targetCtx.shadowColor = String(glowFx.params.color ?? '#2BE0A5');
      targetCtx.shadowBlur = Number(glowFx.params.radius ?? 28);
      targetCtx.shadowOffsetX = 0;
      targetCtx.shadowOffsetY = 0;
    } else if (layer.shadow?.enabled) {
      targetCtx.shadowColor = layer.shadow.color;
      targetCtx.shadowBlur = layer.shadow.blur;
      targetCtx.shadowOffsetX = layer.shadow.offsetX;
      targetCtx.shadowOffsetY = layer.shadow.offsetY;
    }

    const rgbFx = layer.effects.find(
      (f) => f.enabled && f.type === 'chromaticAberration'
    );
    const rgbOffset = rgbFx ? Number(rgbFx.params.offset ?? 6) : 0;

    const dirBlurFx = layer.effects.find(
      (f) => f.enabled && f.type === 'directionalBlur'
    );
    const extrudeFx = layer.effects.find((f) => f.enabled && f.type === 'extrude3d');
    const bevelFx = layer.effects.find((f) => f.enabled && f.type === 'smoothBevel');
    const triGradFx = layer.effects.find(
      (f) => f.enabled && f.type === 'threeColorGradient'
    );
    const colorizeFx = layer.effects.find((f) => f.enabled && f.type === 'colorize');
    const drawProgFx = layer.effects.find(
      (f) => f.enabled && f.type === 'drawingProgress'
    );
    const textTransformFx = layer.effects.find(
      (f) => f.enabled && f.type === 'textTransform'
    );
    const radialRepFx = layer.effects.find(
      (f) => f.enabled && f.type === 'radialRepeat'
    );
    const linearRepFx = layer.effects.find(
      (f) => f.enabled && f.type === 'linearRepeat'
    );
    const chromaKeyFx = layer.effects.find((f) => f.enabled && f.type === 'chromaKey');

    const drawLayerGeometry = (overrideFill?: string) => {
      if (layer.type === 'shape') {
        const w = layer.width ?? 240;
        const h = layer.height ?? 240;
        const cr = evaluateLayerExtraProp(
          layer,
          'cornerRadius',
          layer.cornerRadius ?? 24,
          time
        );
        const sw = evaluateLayerExtraProp(
          layer,
          'strokeWidth',
          layer.strokeWidth ?? 0,
          time
        );

        // Special Drawing Progress sweep for circle / ring / arc
        if (
          drawProgFx &&
          (layer.shapeKind === 'circle' ||
            layer.shapeKind === 'ring' ||
            layer.shapeKind === 'arc')
        ) {
          const startPct = Math.max(0, Math.min(100, Number(drawProgFx.params.start ?? 0)));
          const endPct = Math.max(0, Math.min(100, Number(drawProgFx.params.end ?? 75)));
          const a0 = -Math.PI / 2 + (startPct / 100) * Math.PI * 2;
          const a1 = -Math.PI / 2 + (endPct / 100) * Math.PI * 2;
          const r = Math.min(w, h) / 2;

          targetCtx.beginPath();
          targetCtx.arc(0, 0, r * 0.85, a0, a1);
          targetCtx.lineCap = 'round';
          targetCtx.lineWidth = Math.max(8, sw > 0 ? sw : r * 0.22);
          targetCtx.strokeStyle =
            overrideFill ||
            (layer.strokeWidth && layer.strokeWidth > 0
              ? layer.strokeColor || '#FDE047'
              : layer.fillColor || '#2BE0A5');
          targetCtx.stroke();
          return;
        }

        const isStrokeOnlyShape =
          layer.shapeKind === 'spiral' ||
          layer.shapeKind === 'bracket' ||
          layer.shapeKind === 'wave';

        drawShapePath(
          targetCtx,
          layer.shapeKind || 'circle',
          w,
          h,
          cr,
          layer.pointsCount ?? 5,
          layer.innerRadiusRatio ?? 0.5
        );

        if (!isStrokeOnlyShape && layer.fillColor !== 'transparent') {
          if (overrideFill) {
            targetCtx.fillStyle = overrideFill;
            targetCtx.fill();
          } else if (triGradFx) {
            const rad = (Number(triGradFx.params.angle ?? 45) * Math.PI) / 180;
            const gx = Math.cos(rad) * (w / 2);
            const gy = Math.sin(rad) * (h / 2);
            const grad = targetCtx.createLinearGradient(-gx, -gy, gx, gy);
            grad.addColorStop(0, String(triGradFx.params.color1 ?? '#2BE0A5'));
            grad.addColorStop(0.5, String(triGradFx.params.color2 ?? '#38B2CE'));
            grad.addColorStop(1, String(triGradFx.params.color3 ?? '#D946EF'));
            targetCtx.fillStyle = grad;
            targetCtx.fill();
          } else if (layer.fillGradient?.enabled) {
            const rad = (layer.fillGradient.angle * Math.PI) / 180;
            const gx = Math.cos(rad) * (w / 2);
            const gy = Math.sin(rad) * (h / 2);
            const grad = targetCtx.createLinearGradient(-gx, -gy, gx, gy);
            grad.addColorStop(0, layer.fillGradient.color1);
            grad.addColorStop(1, layer.fillGradient.color2);
            targetCtx.fillStyle = grad;
            targetCtx.fill();
          } else {
            targetCtx.fillStyle = layer.fillColor || '#2BE0A5';
            targetCtx.fill();
          }

          if (colorizeFx && !overrideFill) {
            targetCtx.save();
            targetCtx.globalAlpha *= Math.max(0, Math.min(1, Number(colorizeFx.params.amount ?? 65) / 100));
            targetCtx.fillStyle = String(colorizeFx.params.color ?? '#38B2CE');
            targetCtx.fill();
            targetCtx.restore();
          }
        }

        if ((sw > 0 || isStrokeOnlyShape) && !overrideFill) {
          if (drawProgFx) {
            const perim = (w + h) * 2;
            const startFrac = Math.max(0, Math.min(1, Number(drawProgFx.params.start ?? 0) / 100));
            const endFrac = Math.max(0, Math.min(1, Number(drawProgFx.params.end ?? 75) / 100));
            const visLen = Math.max(2, (endFrac - startFrac) * perim);
            targetCtx.setLineDash([visLen, perim]);
            targetCtx.lineDashOffset = -startFrac * perim;
          }
          targetCtx.lineCap = 'round';
          targetCtx.lineJoin = 'round';
          targetCtx.lineWidth = Math.max(isStrokeOnlyShape ? 5 : 0, sw);
          targetCtx.strokeStyle = isStrokeOnlyShape
            ? layer.fillColor && layer.fillColor !== 'transparent'
              ? layer.fillColor
              : layer.strokeColor || '#2BE0A5'
            : layer.strokeColor || '#FFFFFF';
          targetCtx.stroke();
          targetCtx.setLineDash([]);
        }

        if (bevelFx && !overrideFill) {
          targetCtx.save();
          targetCtx.strokeStyle = String(bevelFx.params.highlight ?? '#FFFFFF');
          targetCtx.globalAlpha *= 0.45;
          targetCtx.lineWidth = Math.max(2, Number(bevelFx.params.depth ?? 6) * 0.5);
          targetCtx.stroke();
          targetCtx.restore();
        }
      } else if (layer.type === 'text') {
        const fontSize = layer.fontSize ?? 72;
        const fontWeight = layer.fontWeight ?? 700;
        const fontFamily = layer.fontFamily || 'Plus Jakarta Sans';
        const { text: resolvedText, extraSpacing } = resolveDynamicText(layer, time);
        const letterSpacing =
          evaluateLayerExtraProp(layer, 'letterSpacing', layer.letterSpacing ?? 0, time) +
          extraSpacing;
        const sw = evaluateLayerExtraProp(layer, 'strokeWidth', layer.strokeWidth ?? 0, time);

        targetCtx.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
        targetCtx.textAlign = layer.textAlign || 'center';
        targetCtx.textBaseline = 'middle';
        if ('letterSpacing' in targetCtx) {
          (targetCtx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSpacing}px`;
        }

        const lines = resolvedText.split('\n');
        const lh = fontSize * (layer.lineHeight ?? 1.18);
        const startY = -((lines.length - 1) * lh) / 2;

        lines.forEach((line, idx) => {
          const ly = startY + idx * lh;
          if (triGradFx && !overrideFill) {
            const tw = Math.max(100, line.length * fontSize * 0.6);
            const grad = targetCtx.createLinearGradient(-tw / 2, ly, tw / 2, ly);
            grad.addColorStop(0, String(triGradFx.params.color1 ?? '#2BE0A5'));
            grad.addColorStop(0.5, String(triGradFx.params.color2 ?? '#38B2CE'));
            grad.addColorStop(1, String(triGradFx.params.color3 ?? '#D946EF'));
            targetCtx.fillStyle = grad;
          } else {
            targetCtx.fillStyle = overrideFill || layer.fillColor || '#FFFFFF';
          }

          if (textTransformFx && line.length > 0 && !overrideFill) {
            const amp = Number(textTransformFx.params.amplitude ?? 14);
            const spd = Number(textTransformFx.params.speed ?? 3);
            const charAdvance = fontSize * 0.62 + letterSpacing;
            const totalW = (line.length - 1) * charAdvance;
            targetCtx.save();
            targetCtx.textAlign = 'center';
            for (let ci = 0; ci < line.length; ci++) {
              const cx = -totalW / 2 + ci * charAdvance;
              const cy = ly + Math.sin(time * spd * Math.PI - ci * 0.45) * amp;
              targetCtx.fillText(line[ci], cx, cy);
            }
            targetCtx.restore();
          } else {
            targetCtx.fillText(line, 0, ly);
            if (sw > 0 && !overrideFill) {
              targetCtx.lineWidth = sw;
              targetCtx.strokeStyle = layer.strokeColor || '#12151E';
              targetCtx.strokeText(line, 0, ly);
            }
          }
        });
      } else if (layer.type === 'media' && layer.mediaUrl) {
        const w = layer.width ?? 420;
        const h = layer.height ?? 420;
        const mediaEl = getOrLoadMedia(layer.mediaUrl, layer.mediaKind || 'image');
        if (mediaEl instanceof HTMLImageElement && mediaEl.complete && mediaEl.naturalWidth > 0) {
          if (chromaKeyFx) {
            const keyed = getChromaKeyedCanvas(
              mediaEl,
              layer.mediaUrl,
              Number(chromaKeyFx.params.hue ?? 120),
              Number(chromaKeyFx.params.tolerance ?? 40)
            );
            targetCtx.drawImage(keyed, -w / 2, -h / 2, w, h);
          } else {
            targetCtx.drawImage(mediaEl, -w / 2, -h / 2, w, h);
          }
        } else if (mediaEl instanceof HTMLVideoElement && mediaEl.readyState >= 2) {
          targetCtx.drawImage(mediaEl, -w / 2, -h / 2, w, h);
        } else {
          targetCtx.fillStyle = '#2B3044';
          targetCtx.fillRect(-w / 2, -h / 2, w, h);
        }
      } else if (layer.type === 'vector' || layer.type === 'freehand') {
        const pts = layer.pathPoints || [];
        if (pts.length > 1) {
          targetCtx.beginPath();
          targetCtx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            if (layer.type === 'freehand' && i < pts.length - 1) {
              const xc = (pts[i].x + pts[i + 1].x) / 2;
              const yc = (pts[i].y + pts[i + 1].y) / 2;
              targetCtx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
            } else {
              targetCtx.lineTo(pts[i].x, pts[i].y);
            }
          }
          if (layer.closedPath) {
            targetCtx.closePath();
            targetCtx.fillStyle = overrideFill || layer.fillColor || 'rgba(43,224,165,0.22)';
            targetCtx.fill();
          }
          if (drawProgFx) {
            const startFrac = Math.max(0, Math.min(1, Number(drawProgFx.params.start ?? 0) / 100));
            const endFrac = Math.max(0, Math.min(1, Number(drawProgFx.params.end ?? 75) / 100));
            targetCtx.setLineDash([Math.max(10, (endFrac - startFrac) * 900), 1200]);
            targetCtx.lineDashOffset = -startFrac * 900;
          }
          targetCtx.lineCap = 'round';
          targetCtx.lineJoin = 'round';
          targetCtx.lineWidth = layer.strokeWidth ?? 6;
          targetCtx.strokeStyle = overrideFill || layer.strokeColor || '#2BE0A5';
          targetCtx.stroke();
          targetCtx.setLineDash([]);
        }
      }
    };

    const renderWithPostFX = () => {
      if (extrudeFx && (layer.type === 'shape' || layer.type === 'text')) {
        const depth = Math.max(1, Math.min(30, Math.round(Number(extrudeFx.params.depth ?? 10))));
        const ang = (Number(extrudeFx.params.angle ?? 135) * Math.PI) / 180;
        const extColor = String(extrudeFx.params.color ?? '#0B0E17');
        for (let step = depth; step >= 1; step--) {
          targetCtx.save();
          targetCtx.translate(Math.cos(ang) * step * 1.4, Math.sin(ang) * step * 1.4);
          drawLayerGeometry(extColor);
          targetCtx.restore();
        }
      }

      if (dirBlurFx) {
        const strength = Number(dirBlurFx.params.strength ?? 12);
        const ang = (Number(dirBlurFx.params.angle ?? 0) * Math.PI) / 180;
        const samples = 4;
        for (let s = 1; s <= samples; s++) {
          targetCtx.save();
          targetCtx.globalAlpha *= 0.22;
          const d = (s / samples) * strength;
          targetCtx.translate(Math.cos(ang) * d, Math.sin(ang) * d);
          drawLayerGeometry();
          targetCtx.restore();
        }
      }

      if (rgbOffset > 0 && (layer.type === 'shape' || layer.type === 'text')) {
        targetCtx.save();
        targetCtx.globalCompositeOperation = 'screen';
        targetCtx.translate(-rgbOffset, 0);
        drawLayerGeometry('#FF3366');
        targetCtx.translate(rgbOffset * 2, 0);
        drawLayerGeometry('#00F0FF');
        targetCtx.restore();
      }

      drawLayerGeometry();
    };

    if (radialRepFx) {
      const count = Math.max(2, Math.min(24, Math.round(Number(radialRepFx.params.count ?? 6))));
      const rad = Number(radialRepFx.params.radius ?? 130);
      const spread = (Number(radialRepFx.params.spread ?? 360) * Math.PI) / 180;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * spread;
        targetCtx.save();
        targetCtx.rotate(a);
        targetCtx.translate(rad, 0);
        renderWithPostFX();
        targetCtx.restore();
      }
    } else if (linearRepFx) {
      const count = Math.max(2, Math.min(12, Math.round(Number(linearRepFx.params.count ?? 4))));
      const ox = Number(linearRepFx.params.offsetX ?? 36);
      const oy = Number(linearRepFx.params.offsetY ?? 0);
      for (let i = count - 1; i >= 0; i--) {
        targetCtx.save();
        targetCtx.globalAlpha *= Math.max(0.15, 1 - i * 0.18);
        targetCtx.translate(ox * i, oy * i);
        renderWithPostFX();
        targetCtx.restore();
      }
    } else {
      renderWithPostFX();
    }

    if (showGizmos && (layer.type === 'null' || layer.type === 'group')) {
      targetCtx.save();
      targetCtx.filter = 'none';
      targetCtx.shadowBlur = 0;
      targetCtx.globalAlpha = 0.85;
      targetCtx.strokeStyle =
        layer.type === 'group' && layer.maskMode === 'clip'
          ? '#F2A833'
          : layer.type === 'null'
            ? '#B0B8CE'
            : '#2BE0A5';
      targetCtx.lineWidth = 2;
      targetCtx.setLineDash(layer.type === 'group' ? [5, 4] : []);
      targetCtx.strokeRect(-42, -42, 84, 84);
      targetCtx.setLineDash([]);
      targetCtx.beginPath();
      targetCtx.moveTo(-24, 24);
      targetCtx.lineTo(24, -24);
      targetCtx.stroke();
      targetCtx.restore();
    }

    targetCtx.restore();
  };

  const drawGizmoForLayer = (layer: Layer) => {
    const t = evaluateLayerTransform(layer, time);
    const bounds = getLayerBounds(layer);
    const bw = bounds.width;
    const bh = bounds.height;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    if (camTransform) {
      ctx.scale(camTransform.scaleX, camTransform.scaleY);
      ctx.rotate((-camTransform.rotation * Math.PI) / 180);
      apply3DAxisTilt(ctx, camTransform);
      ctx.translate(-camTransform.x, -camTransform.y);
    }
    applyParentChain(ctx, layer, layerMap, time);
    ctx.translate(t.x, t.y);
    ctx.rotate((t.rotation * Math.PI) / 180);
    apply3DAxisTilt(ctx, t);
    ctx.scale(t.scaleX, t.scaleY);
    ctx.translate(-t.anchorX, -t.anchorY);

    ctx.strokeStyle = layer.isMask ? '#F2A833' : '#2BE0A5';
    ctx.lineWidth = 2.5;
    if (layer.isMask) ctx.setLineDash([6, 4]);
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.setLineDash([]);

    const corners = [
      [-bw / 2, -bh / 2],
      [bw / 2, -bh / 2],
      [bw / 2, bh / 2],
      [-bw / 2, bh / 2],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = layer.isMask ? '#F2A833' : '#2BE0A5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(0, -bh / 2);
    ctx.lineTo(0, -bh / 2 - 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -bh / 2 - 38, 7, 0, Math.PI * 2);
    ctx.fillStyle = layer.isMask ? '#F2A833' : '#2BE0A5';
    ctx.fill();

    ctx.strokeStyle = '#F2A833';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.anchorX, t.anchorY, 6, 0, Math.PI * 2);
    ctx.moveTo(t.anchorX - 11, t.anchorY);
    ctx.lineTo(t.anchorX + 11, t.anchorY);
    ctx.moveTo(t.anchorX, t.anchorY - 11);
    ctx.lineTo(t.anchorX, t.anchorY + 11);
    ctx.stroke();

    ctx.restore();
  };

  const clipGroupIds = new Set(
    layers
      .filter((l) => l.type === 'group' && l.maskMode === 'clip' && l.visible)
      .map((l) => l.id)
  );

  const renderOrder = [...layers].reverse();

  for (const layer of renderOrder) {
    if (!layer.visible) continue;
    if (layer.type === 'audio' || layer.type === 'camera') continue;
    if (time < layer.startTime || time > layer.endTime) continue;

    if (layer.parentId && clipGroupIds.has(layer.parentId)) {
      continue;
    }

    if (layer.type === 'group' && layer.maskMode === 'clip') {
      const groupChildren = renderOrder.filter(
        (c) =>
          c.parentId === layer.id &&
          c.visible &&
          c.type !== 'audio' &&
          c.type !== 'camera' &&
          time >= c.startTime &&
          time <= c.endTime
      );

      if (groupChildren.length > 0 && typeof document !== 'undefined') {
        const maskLayers = groupChildren.filter((c) => c.isMask);
        const activeMask = maskLayers.length > 0 ? maskLayers : [groupChildren[0]];
        const maskIdSet = new Set(activeMask.map((m) => m.id));
        const contentLayers = groupChildren.filter((c) => !maskIdSet.has(c.id));

        const contentCanvas = document.createElement('canvas');
        contentCanvas.width = width;
        contentCanvas.height = height;
        const cCtx = contentCanvas.getContext('2d');

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const mCtx = maskCanvas.getContext('2d');

        if (cCtx && mCtx) {
          for (const m of activeMask) {
            drawSingleLayer(mCtx, m, 'source-over');
          }
          for (const c of contentLayers) {
            drawSingleLayer(cCtx, c);
          }
          cCtx.globalCompositeOperation = 'destination-in';
          cCtx.drawImage(maskCanvas, 0, 0);

          ctx.save();
          const gt = evaluateLayerTransform(layer, time);
          ctx.globalAlpha = Math.max(0, Math.min(1, gt.opacity / 100));
          ctx.globalCompositeOperation = mapBlendMode(layer.blendMode);
          ctx.drawImage(contentCanvas, 0, 0);
          ctx.restore();
        }
      }

      drawSingleLayer(ctx, layer);
      if (showGizmos && selectedLayerIds.includes(layer.id)) {
        drawGizmoForLayer(layer);
      }
      continue;
    }

    drawSingleLayer(ctx, layer);
  }

  if (showGizmos) {
    for (const layer of renderOrder) {
      if (
        !layer.visible ||
        layer.type === 'audio' ||
        layer.type === 'camera' ||
        time < layer.startTime ||
        time > layer.endTime
      ) {
        continue;
      }
      if (selectedLayerIds.includes(layer.id)) {
        drawGizmoForLayer(layer);
      }
    }
  }

  for (const layer of renderOrder) {
    if (!layer.visible || time < layer.startTime || time > layer.endTime) continue;
    const vig = layer.effects.find((f) => f.enabled && f.type === 'vignette');
    if (vig) {
      const strength = Number(vig.params.strength ?? 0.55);
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.25,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, strength)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  ctx.restore();
}
