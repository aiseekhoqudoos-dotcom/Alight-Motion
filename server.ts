import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_MODEL = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withGeminiRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = /429|503|502|504|rate|quota|temporarily|timeout|ECONNRESET/i.test(msg);
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function getErrorStatusAndMessage(err: unknown, fallback: string): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : fallback;
  if (/API_KEY_INVALID|API key not valid|403|PERMISSION_DENIED/i.test(raw)) {
    return { status: 403, message: 'Google AI Studio API key is invalid or lacks permission.' };
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return { status: 429, message: 'Google AI Studio rate limit reached. Please retry in a moment.' };
  }
  if (/400|INVALID_ARGUMENT/i.test(raw)) {
    return { status: 400, message: `Invalid AI request parameters: ${raw}` };
  }
  return { status: 500, message: raw || fallback };
}

const keyframeSchema = {
  type: Type.OBJECT,
  properties: {
    time: { type: Type.NUMBER, description: 'Timestamp in seconds from 0 to duration' },
    value: { type: Type.NUMBER, description: 'Numeric property value at this keyframe' },
    p1x: { type: Type.NUMBER, description: 'Cubic bezier handle 1 X (0 to 1)' },
    p1y: { type: Type.NUMBER, description: 'Cubic bezier handle 1 Y (-0.4 to 1.5 for overshoot)' },
    p2x: { type: Type.NUMBER, description: 'Cubic bezier handle 2 X (0 to 1)' },
    p2y: { type: Type.NUMBER, description: 'Cubic bezier handle 2 Y (-0.4 to 1.5)' },
  },
  required: ['time', 'value', 'p1x', 'p1y', 'p2x', 'p2y'],
};

const motionSceneSchema = {
  type: Type.OBJECT,
  properties: {
    sceneTitle: { type: Type.STRING, description: 'Short descriptive title for the generated scene' },
    background: { type: Type.STRING, description: 'One of: black, slate, white' },
    beatMarkers: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: 'Key beat timestamps in seconds',
    },
    layers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          type: { type: Type.STRING, description: 'One of: shape, text, null, camera' },
          startTime: { type: Type.NUMBER },
          endTime: { type: Type.NUMBER },
          parentId: { type: Type.STRING, description: 'Optional parent layer id or empty string' },
          blendMode: {
            type: Type.STRING,
            description: 'One of: normal, multiply, screen, overlay, color-dodge, difference',
          },
          shapeKind: {
            type: Type.STRING,
            description: 'If type=shape: circle, rect, roundedRect, triangle, star, polygon, ring, arc, cross, arrow, pill, diamond, burst, hudGrid',
          },
          width: { type: Type.NUMBER },
          height: { type: Type.NUMBER },
          fillColor: { type: Type.STRING, description: 'Hex color e.g. #2BE0A5' },
          gradientColor2: { type: Type.STRING, description: 'Optional secondary hex color for gradient fill' },
          strokeColor: { type: Type.STRING },
          strokeWidth: { type: Type.NUMBER },
          cornerRadius: { type: Type.NUMBER },
          text: { type: Type.STRING, description: 'If type=text, the visible text string' },
          fontFamily: {
            type: Type.STRING,
            description: 'One of: Outfit, Plus Jakarta Sans, Oswald, Archivo, Playfair Display',
          },
          fontSize: { type: Type.NUMBER },
          fontWeight: { type: Type.NUMBER },
          letterSpacing: { type: Type.NUMBER },
          x: { type: Type.NUMBER, description: 'Initial X offset from canvas center' },
          y: { type: Type.NUMBER, description: 'Initial Y offset from canvas center' },
          scaleX: { type: Type.NUMBER, description: 'Initial scaleX (1 = 100%)' },
          scaleY: { type: Type.NUMBER, description: 'Initial scaleY (1 = 100%)' },
          rotation: { type: Type.NUMBER, description: 'Initial Z rotation in degrees' },
          rotateX: { type: Type.NUMBER, description: 'Optional 3D X-axis tilt degrees (-45 to 45)' },
          rotateY: { type: Type.NUMBER, description: 'Optional 3D Y-axis tilt degrees (-45 to 45)' },
          opacity: { type: Type.NUMBER, description: 'Initial opacity 0 to 100' },
          keyframesX: { type: Type.ARRAY, items: keyframeSchema },
          keyframesY: { type: Type.ARRAY, items: keyframeSchema },
          keyframesScaleX: { type: Type.ARRAY, items: keyframeSchema },
          keyframesScaleY: { type: Type.ARRAY, items: keyframeSchema },
          keyframesRotation: { type: Type.ARRAY, items: keyframeSchema },
          keyframesRotateX: { type: Type.ARRAY, items: keyframeSchema },
          keyframesRotateY: { type: Type.ARRAY, items: keyframeSchema },
          keyframesOpacity: { type: Type.ARRAY, items: keyframeSchema },
          keyframesLetterSpacing: { type: Type.ARRAY, items: keyframeSchema },
          effectType: {
            type: Type.STRING,
            description: 'Optional effect: none, glow, deepGlow, gaussianBlur, chromaticAberration, oscillate, waveWarp, shake, vignette, smoothBevel, extrude3d',
          },
          effectColor: { type: Type.STRING },
          effectStrength: { type: Type.NUMBER },
        },
        required: [
          'id',
          'name',
          'type',
          'startTime',
          'endTime',
          'blendMode',
          'x',
          'y',
          'scaleX',
          'scaleY',
          'rotation',
          'opacity',
        ],
      },
    },
  },
  required: ['sceneTitle', 'background', 'layers'],
};

const layerAnimationSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: 'Brief 1-sentence description of the motion choreography' },
    keyframesX: { type: Type.ARRAY, items: keyframeSchema },
    keyframesY: { type: Type.ARRAY, items: keyframeSchema },
    keyframesScaleX: { type: Type.ARRAY, items: keyframeSchema },
    keyframesScaleY: { type: Type.ARRAY, items: keyframeSchema },
    keyframesRotation: { type: Type.ARRAY, items: keyframeSchema },
    keyframesRotateX: { type: Type.ARRAY, items: keyframeSchema },
    keyframesRotateY: { type: Type.ARRAY, items: keyframeSchema },
    keyframesOpacity: { type: Type.ARRAY, items: keyframeSchema },
    keyframesLetterSpacing: { type: Type.ARRAY, items: keyframeSchema },
    suggestedEffect: {
      type: Type.STRING,
      description: 'One of: none, glow, deepGlow, gaussianBlur, chromaticAberration, oscillate, waveWarp, shake, smoothBevel',
    },
  },
  required: ['summary'],
};

const smoothMotionSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: 'Concise description of how easing curves and motion flow were smoothed' },
    smoothedLayers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          layerId: { type: Type.STRING },
          keyframesX: { type: Type.ARRAY, items: keyframeSchema },
          keyframesY: { type: Type.ARRAY, items: keyframeSchema },
          keyframesScaleX: { type: Type.ARRAY, items: keyframeSchema },
          keyframesScaleY: { type: Type.ARRAY, items: keyframeSchema },
          keyframesRotation: { type: Type.ARRAY, items: keyframeSchema },
          keyframesRotateX: { type: Type.ARRAY, items: keyframeSchema },
          keyframesRotateY: { type: Type.ARRAY, items: keyframeSchema },
          keyframesOpacity: { type: Type.ARRAY, items: keyframeSchema },
          keyframesLetterSpacing: { type: Type.ARRAY, items: keyframeSchema },
        },
        required: ['layerId'],
      },
    },
  },
  required: ['summary', 'smoothedLayers'],
};

const polishEffectsSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    fillColor: { type: Type.STRING },
    useGradient: { type: Type.BOOLEAN },
    gradientColor1: { type: Type.STRING },
    gradientColor2: { type: Type.STRING },
    gradientAngle: { type: Type.NUMBER },
    strokeColor: { type: Type.STRING },
    strokeWidth: { type: Type.NUMBER },
    blendMode: {
      type: Type.STRING,
      description: 'One of: normal, multiply, screen, overlay, color-dodge, hard-light, difference',
    },
    shadowEnabled: { type: Type.BOOLEAN },
    shadowColor: { type: Type.STRING },
    shadowBlur: { type: Type.NUMBER },
    effects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: 'One of: glow, deepGlow, gaussianBlur, directionalBlur, chromaticAberration, waveWarp, oscillate, shake, vignette, smoothBevel, extrude3d, colorize, exposureGamma, hueShift, fadeInOut',
          },
          intensity: { type: Type.NUMBER },
          color: { type: Type.STRING },
        },
        required: ['type'],
      },
    },
  },
  required: ['summary', 'fillColor', 'blendMode', 'effects'],
};

const cameraDirectorSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    beatMarkers: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
    },
    keyframesX: { type: Type.ARRAY, items: keyframeSchema },
    keyframesY: { type: Type.ARRAY, items: keyframeSchema },
    keyframesScaleX: { type: Type.ARRAY, items: keyframeSchema },
    keyframesScaleY: { type: Type.ARRAY, items: keyframeSchema },
    keyframesRotation: { type: Type.ARRAY, items: keyframeSchema },
    addHandShake: { type: Type.BOOLEAN },
  },
  required: ['summary', 'beatMarkers', 'keyframesScaleX', 'keyframesScaleY'],
};

const typographyDirectorSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    beatMarkers: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    textLayers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          text: { type: Type.STRING },
          startTime: { type: Type.NUMBER },
          endTime: { type: Type.NUMBER },
          fontFamily: {
            type: Type.STRING,
            description: 'One of: Outfit, Plus Jakarta Sans, Oswald, Archivo, Playfair Display',
          },
          fontSize: { type: Type.NUMBER },
          fontWeight: { type: Type.NUMBER },
          fillColor: { type: Type.STRING },
          letterSpacing: { type: Type.NUMBER },
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
          scaleX: { type: Type.NUMBER },
          scaleY: { type: Type.NUMBER },
          rotation: { type: Type.NUMBER },
          opacity: { type: Type.NUMBER },
          keyframesX: { type: Type.ARRAY, items: keyframeSchema },
          keyframesY: { type: Type.ARRAY, items: keyframeSchema },
          keyframesScaleX: { type: Type.ARRAY, items: keyframeSchema },
          keyframesScaleY: { type: Type.ARRAY, items: keyframeSchema },
          keyframesRotation: { type: Type.ARRAY, items: keyframeSchema },
          keyframesOpacity: { type: Type.ARRAY, items: keyframeSchema },
          keyframesLetterSpacing: { type: Type.ARRAY, items: keyframeSchema },
          effectType: {
            type: Type.STRING,
            description: 'One of: none, glow, deepGlow, chromaticAberration, textProgress, textSpacing, textRandomizer, smoothBevel',
          },
        },
        required: ['name', 'text', 'startTime', 'endTime', 'fontFamily', 'fontSize', 'fillColor'],
      },
    },
  },
  required: ['summary', 'textLayers'],
};

function toLayerKeyframes(
  items: Array<{
    time: number;
    value: number;
    p1x: number;
    p1y: number;
    p2x: number;
    p2y: number;
  }> = [],
  maxDuration?: number
) {
  return items
    .map((k, idx) => {
      const clampedTime = Math.max(0, Number(k.time) || 0);
      return {
        id: `kf_ai_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        time: maxDuration !== undefined ? Math.min(maxDuration, clampedTime) : clampedTime,
        value: Number.isFinite(Number(k.value)) ? Number(k.value) : 0,
        easing: {
          type: 'bezier' as const,
          p1x: Math.max(0, Math.min(1, Number(k.p1x ?? 0.42))),
          p1y: Math.max(-0.45, Math.min(1.5, Number(k.p1y ?? 0))),
          p2x: Math.max(0, Math.min(1, Number(k.p2x ?? 0.58))),
          p2y: Math.max(-0.45, Math.min(1.5, Number(k.p2y ?? 1))),
        },
      };
    })
    .sort((a, b) => a.time - b.time);
}

function buildEffectInstanceFromAI(fxType: string, color?: string, strength?: number, idx = 0) {
  const valid = [
    'glow',
    'deepGlow',
    'gaussianBlur',
    'directionalBlur',
    'chromaticAberration',
    'oscillate',
    'waveWarp',
    'shake',
    'vignette',
    'smoothBevel',
    'extrude3d',
    'colorize',
    'exposureGamma',
    'hueShift',
    'fadeInOut',
    'textProgress',
    'textSpacing',
    'textRandomizer',
  ];
  if (!valid.includes(fxType)) return null;

  const s = Number(strength || 0);
  const c = color || '#2BE0A5';
  const nameMap: Record<string, string> = {
    glow: 'Glow / Bloom',
    deepGlow: 'DeepGlow Enhanced',
    gaussianBlur: 'Gaussian Blur',
    directionalBlur: 'Directional Blur',
    chromaticAberration: 'RGB Split',
    oscillate: 'Oscillate Motion',
    waveWarp: 'Wave Warp',
    shake: 'Handheld Shake',
    vignette: 'Cinema Vignette',
    smoothBevel: 'Smooth Bevel',
    extrude3d: '3D Extrude',
    colorize: 'Colorize Tint',
    exposureGamma: 'Brightness / Contrast',
    hueShift: 'Hue Shift & Saturate',
    fadeInOut: 'Fade In / Out',
    textProgress: 'Text Progress',
    textSpacing: 'Text Spacing',
    textRandomizer: 'Text Randomizer',
  };

  let params: Record<string, number | string> = {};
  switch (fxType) {
    case 'glow':
      params = { radius: s || 26, color: c };
      break;
    case 'deepGlow':
      params = { radius: s || 38, intensity: 2, color: c };
      break;
    case 'gaussianBlur':
      params = { radius: s || 6 };
      break;
    case 'directionalBlur':
      params = { strength: s || 12, angle: 0 };
      break;
    case 'chromaticAberration':
      params = { offset: s || 7 };
      break;
    case 'oscillate':
      params = { frequency: 1.4, magnitude: s || 14, angle: 90 };
      break;
    case 'waveWarp':
      params = { frequency: 2.5, magnitude: s || 8 };
      break;
    case 'shake':
      params = { frequency: 6, magnitude: s || 10 };
      break;
    case 'vignette':
      params = { strength: s > 0 && s <= 1 ? s : 0.48 };
      break;
    case 'smoothBevel':
      params = { depth: s || 6, highlight: '#FFFFFF' };
      break;
    case 'extrude3d':
      params = { depth: s || 10, angle: 135, color: '#0B0E17' };
      break;
    case 'colorize':
      params = { color: c, amount: s || 65 };
      break;
    case 'exposureGamma':
      params = { brightness: 115, contrast: 112 };
      break;
    case 'hueShift':
      params = { hue: s || 45, saturation: 120 };
      break;
    case 'fadeInOut':
      params = { fadeIn: 0.4, fadeOut: 0.4 };
      break;
    case 'textProgress':
      params = { end: 100, cursor: 1 };
      break;
    case 'textSpacing':
      params = { spacing: s || 16 };
      break;
    case 'textRandomizer':
      params = { amount: 45, speed: 12 };
      break;
  }

  return {
    id: `fx_ai_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
    type: fxType,
    name: nameMap[fxType] || fxType,
    enabled: true,
    params,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/ai/status', (_req, res) => {
    res.json({
      ok: true,
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: GEMINI_MODEL,
    });
  });

  // 1. AI Motion Scene & AI Motion Trailer
  app.post('/api/ai/generate-motion', async (req, res) => {
    try {
      const {
        prompt,
        width = 1280,
        height = 720,
        duration = 6,
        style = 'Kinetic Studio',
        mode = 'scene',
      } = req.body || {};
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required.' });
      }

      const isTrailer = mode === 'trailer';
      const ai = getGeminiClient();
      const systemInstruction = isTrailer
        ? `You are a cinematic movie & brand trailer motion graphics director specializing in Alight Motion style multi-beat trailers.
Generate an energetic, punchy multi-beat TRAILER sequence with staggered sequential title cards (using distinct startTime and endTime cuts!), dramatic Camera zoom/scale keyframes, glowing accent shapes/rings, and beatMarkers on every cut.
Canvas coordinates: (0, 0) is the EXACT center of the stage. Width is ${width}px, Height is ${height}px. Total duration is ${duration} seconds.
Trailer Rules:
1. Create 5 to 8 layers: include a Camera layer spanning 0 to ${duration}s with punchy zoom/overshoot keyframes at cut beats; 2 to 4 staggered sequential Text title cards (e.g. Beat 1: 0s-1.8s, Beat 2: 1.8s-3.6s, Finale Hero Title: 3.6s-${duration}s) with slam-in scaleX/scaleY or tracking animations; and glowing backdrop ring/shape accents.
2. Put beatMarkers at every title cut timestamp.
3. Use dramatic cubic-bezier curves (overshoot 0.34, 1.45, 0.64, 1 and snappy ease-out 0.16, 1, 0.3, 1) and effects like deepGlow, glow, chromaticAberration, shake, vignette.
4. Order layers top-to-bottom (index 0 renders on top; put backdrop shapes last).`
        : `You are a master motion graphics director specializing in Alight Motion and After Effects style keyframe choreography.
Generate cohesive, visually balanced, silky-smooth multi-layer motion graphics scenes.
Canvas coordinates: (0, 0) is the EXACT center of the stage. Width is ${width}px (X range -${Math.round(width / 2)} to +${Math.round(width / 2)}), Height is ${height}px (Y range -${Math.round(height / 2)} to +${Math.round(height / 2)}).
Duration is ${duration} seconds.
Design rules:
1. Create 4 to 7 rich layers: combine a Camera layer (for subtle zoom/pan), optional Null rig parent, bold kinetic Text layers, and layered Shape accents (rings, arcs, circles, roundedRect cards, stars, bursts, hudGrid).
2. Order layers top-to-bottom (index 0 renders on top; put backdrop shapes last).
3. Use smooth, expressive cubic-bezier easing curves: e.g. overshoot (0.34, 1.45, 0.64, 1), snappy ease-out (0.16, 1, 0.3, 1), smooth S-curve (0.42, 0, 0.58, 1).
4. Ensure high contrast between background and foreground colors, crisp typography, optional subtle 3D rotateX/rotateY tilt or fill gradients, and harmonious motion timing with staggered entrances.`;

      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: isTrailer
            ? `Create a multi-beat AI Motion Trailer for: "${prompt}". Trailer style: ${style}. Total duration: ${duration}s.`
            : `Create a motion graphics scene for: "${prompt}". Style direction: ${style}. Total duration: ${duration}s.`,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: motionSceneSchema,
          },
        })
      );

      const raw = JSON.parse((response.text ?? '{}').trim());
      const parsedLayers = Array.isArray(raw.layers) ? raw.layers : [];

      const idMap = new Map<string, string>();
      parsedLayers.forEach((l: { id?: string }, idx: number) => {
        const oldId = l.id || `ai_l_${idx}`;
        idMap.set(oldId, `layer_ai_${Date.now()}_${idx}`);
      });

      const normalizedLayers = parsedLayers.map((l: Record<string, unknown>, idx: number) => {
        const newId = idMap.get(String(l.id || `ai_l_${idx}`))!;
        const rawParent = typeof l.parentId === 'string' && l.parentId ? idMap.get(l.parentId) ?? null : null;
        const layerType = ['shape', 'text', 'null', 'camera'].includes(String(l.type))
          ? String(l.type)
          : 'shape';

        const effects = [];
        const builtFx = buildEffectInstanceFromAI(
          String(l.effectType || 'none'),
          typeof l.effectColor === 'string' ? l.effectColor : String(l.fillColor || '#2BE0A5'),
          Number(l.effectStrength || 0),
          idx
        );
        if (builtFx) effects.push(builtFx);

        const keyframes: Record<string, unknown> = {};
        if (Array.isArray(l.keyframesX) && l.keyframesX.length > 0) keyframes.x = toLayerKeyframes(l.keyframesX, duration);
        if (Array.isArray(l.keyframesY) && l.keyframesY.length > 0) keyframes.y = toLayerKeyframes(l.keyframesY, duration);
        if (Array.isArray(l.keyframesScaleX) && l.keyframesScaleX.length > 0) keyframes.scaleX = toLayerKeyframes(l.keyframesScaleX, duration);
        if (Array.isArray(l.keyframesScaleY) && l.keyframesScaleY.length > 0) keyframes.scaleY = toLayerKeyframes(l.keyframesScaleY, duration);
        if (Array.isArray(l.keyframesRotation) && l.keyframesRotation.length > 0) keyframes.rotation = toLayerKeyframes(l.keyframesRotation, duration);
        if (Array.isArray(l.keyframesRotateX) && l.keyframesRotateX.length > 0) keyframes.rotateX = toLayerKeyframes(l.keyframesRotateX, duration);
        if (Array.isArray(l.keyframesRotateY) && l.keyframesRotateY.length > 0) keyframes.rotateY = toLayerKeyframes(l.keyframesRotateY, duration);
        if (Array.isArray(l.keyframesOpacity) && l.keyframesOpacity.length > 0) keyframes.opacity = toLayerKeyframes(l.keyframesOpacity, duration);
        if (Array.isArray(l.keyframesLetterSpacing) && l.keyframesLetterSpacing.length > 0) keyframes.letterSpacing = toLayerKeyframes(l.keyframesLetterSpacing, duration);

        const fillGradient =
          typeof l.gradientColor2 === 'string' && l.gradientColor2.startsWith('#')
            ? {
                enabled: true,
                color1: String(l.fillColor || '#2BE0A5'),
                color2: l.gradientColor2,
                angle: 135,
              }
            : undefined;

        return {
          id: newId,
          name: String(l.name || `AI Layer ${idx + 1}`),
          type: layerType,
          startTime: Math.max(0, Number(l.startTime ?? 0)),
          endTime: Math.min(duration, Math.max(0.4, Number(l.endTime ?? duration))),
          visible: true,
          locked: false,
          parentId: rawParent === newId ? null : rawParent,
          blendMode: String(l.blendMode || 'normal'),
          shapeKind: String(l.shapeKind || 'roundedRect'),
          width: Math.max(24, Number(l.width || 280)),
          height: Math.max(24, Number(l.height || 180)),
          fillColor: String(l.fillColor || '#2BE0A5'),
          ...(fillGradient ? { fillGradient } : {}),
          strokeColor: String(l.strokeColor || '#FFFFFF'),
          strokeWidth: Number(l.strokeWidth || 0),
          cornerRadius: Number(l.cornerRadius ?? 24),
          innerRadiusRatio: 0.72,
          pointsCount: 5,
          text: String(l.text || 'MOTION'),
          fontFamily: String(l.fontFamily || 'Outfit'),
          fontSize: Math.max(14, Number(l.fontSize || 64)),
          fontWeight: Number(l.fontWeight || 700),
          textAlign: 'center',
          letterSpacing: Number(l.letterSpacing ?? 2),
          lineHeight: 1.15,
          cameraActive: layerType === 'camera',
          transform: {
            x: Number(l.x ?? 0),
            y: Number(l.y ?? 0),
            scaleX: Number(l.scaleX ?? 1),
            scaleY: Number(l.scaleY ?? 1),
            rotation: Number(l.rotation ?? 0),
            rotateX: Number(l.rotateX ?? 0),
            rotateY: Number(l.rotateY ?? 0),
            skewX: 0,
            skewY: 0,
            anchorX: 0,
            anchorY: 0,
            opacity: Number(l.opacity ?? 100),
          },
          keyframes,
          effects,
        };
      });

      res.json({
        sceneTitle: raw.sceneTitle || prompt.slice(0, 32),
        background: ['black', 'slate', 'white'].includes(raw.background) ? raw.background : 'black',
        beatMarkers: Array.isArray(raw.beatMarkers) ? raw.beatMarkers : [],
        layers: normalizedLayers,
      });
    } catch (err) {
      console.error('[AI generate-motion error]', err);
      const { status, message } = getErrorStatusAndMessage(err, 'Failed to generate AI motion scene.');
      res.status(status).json({ error: message });
    }
  });

  // 2. AI Animate Selected Layer
  app.post('/api/ai/animate-layer', async (req, res) => {
    try {
      const { prompt, layer, currentTime = 0, duration = 8, width = 1280, height = 720 } = req.body || {};
      if (!prompt || !layer) {
        return res.status(400).json({ error: 'Prompt and layer are required.' });
      }

      const ai = getGeminiClient();
      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Choreograph smooth keyframes for layer "${layer.name}" (type: ${layer.type}, current pos: x=${layer.transform?.x ?? 0}, y=${layer.transform?.y ?? 0}, scale=${layer.transform?.scaleX ?? 1}, rot=${layer.transform?.rotation ?? 0}, startTime=${layer.startTime}, endTime=${layer.endTime}).
Canvas: ${width}x${height} (center 0,0). Playhead is at ${Number(currentTime).toFixed(2)}s, total duration ${duration}s.
User request: "${prompt}".
Return smooth cubic-bezier keyframes starting near ${Number(currentTime).toFixed(2)}s (or layer startTime ${layer.startTime}s) within [0, ${duration}].`,
          config: {
            systemInstruction:
              'You are a motion graphics easing choreographer. Produce expressive, silky-smooth keyframes with cubic-bezier control points (use overshoot p1y ~ 1.3-1.45 for bouncy pops, ease-out p1x=0.16,p1y=1,p2x=0.3,p2y=1 for smooth settles). You may also animate rotateX/rotateY for 3D depth or letterSpacing on text layers.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: layerAnimationSchema,
          },
        })
      );

      const raw = JSON.parse((response.text ?? '{}').trim());
      const keyframes: Record<string, unknown> = {};
      if (Array.isArray(raw.keyframesX) && raw.keyframesX.length > 0) keyframes.x = toLayerKeyframes(raw.keyframesX, duration);
      if (Array.isArray(raw.keyframesY) && raw.keyframesY.length > 0) keyframes.y = toLayerKeyframes(raw.keyframesY, duration);
      if (Array.isArray(raw.keyframesScaleX) && raw.keyframesScaleX.length > 0) keyframes.scaleX = toLayerKeyframes(raw.keyframesScaleX, duration);
      if (Array.isArray(raw.keyframesScaleY) && raw.keyframesScaleY.length > 0) keyframes.scaleY = toLayerKeyframes(raw.keyframesScaleY, duration);
      if (Array.isArray(raw.keyframesRotation) && raw.keyframesRotation.length > 0) keyframes.rotation = toLayerKeyframes(raw.keyframesRotation, duration);
      if (Array.isArray(raw.keyframesRotateX) && raw.keyframesRotateX.length > 0) keyframes.rotateX = toLayerKeyframes(raw.keyframesRotateX, duration);
      if (Array.isArray(raw.keyframesRotateY) && raw.keyframesRotateY.length > 0) keyframes.rotateY = toLayerKeyframes(raw.keyframesRotateY, duration);
      if (Array.isArray(raw.keyframesOpacity) && raw.keyframesOpacity.length > 0) keyframes.opacity = toLayerKeyframes(raw.keyframesOpacity, duration);
      if (Array.isArray(raw.keyframesLetterSpacing) && raw.keyframesLetterSpacing.length > 0) keyframes.letterSpacing = toLayerKeyframes(raw.keyframesLetterSpacing, duration);

      res.json({
        summary: raw.summary || 'Applied AI motion choreography',
        keyframes,
        suggestedEffect: raw.suggestedEffect || 'none',
      });
    } catch (err) {
      console.error('[AI animate-layer error]', err);
      const { status, message } = getErrorStatusAndMessage(err, 'Failed to animate layer.');
      res.status(status).json({ error: message });
    }
  });

  // 3. AI Motion Smoothing (Keyframe & Bezier Flow Optimizer)
  app.post('/api/ai/smooth-motion', async (req, res) => {
    try {
      const {
        layers = [],
        smoothStyle = 'Silky Cinema',
        intensity = 80,
        prompt = '',
        duration = 6,
      } = req.body || {};

      if (!Array.isArray(layers) || layers.length === 0) {
        return res.status(400).json({ error: 'At least one layer is required for AI smoothing.' });
      }

      const compactLayers = layers.slice(0, 12).map((l: Record<string, unknown>) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        startTime: l.startTime,
        endTime: l.endTime,
        transform: l.transform,
        keyframes: l.keyframes,
      }));

      const styleGuides: Record<string, string> = {
        'Silky Cinema':
          'Ultra-fluid exponential ease-out (0.16, 1, 0.3, 1) and gentle S-curve settles (0.42, 0, 0.58, 1). Eliminate sudden stops, soften sharp velocity changes, and extend rapid snaps into graceful glides.',
        'Overshoot Snap':
          'Crisp Alight Motion spring overshoot handles (0.34, 1.42, 0.64, 1) for entrances followed by silky deceleration (0.22, 1, 0.36, 1). Add subtle elastic settle.',
        'Liquid Momentum':
          'Zero-stop continuous momentum with asymmetric fast-in slow-out (0.12, 0.95, 0.28, 1), overlapping secondary rotation/scale follow-through.',
        'Micro-Damped Bounce':
          'Tight physical spring settle: initial punch + small corrective bounce keyframe + calm settle to target value.',
        'Zero-Jerk Flow':
          'Strict C2-continuous bezier tangents across multi-keyframe spans so velocity flows smoothly across middle keyframes without flat pauses.',
      };

      const ai = getGeminiClient();
      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Apply AI Motion Smoothing to these layer(s).
Smoothing Profile: "${smoothStyle}" (${styleGuides[smoothStyle] || styleGuides['Silky Cinema']}).
Smoothing Strength: ${intensity}%.
Timeline Duration: ${duration}s.
Additional User Instruction: "${prompt || 'Make all transitions butter-smooth and eliminate robotic linear curves.'}".
Target Layers JSON:
${JSON.stringify(compactLayers)}`,
          config: {
            systemInstruction: `You are an elite Alight Motion & After Effects Graph Editor AI Smoothing specialist.
Your job is to transform robotic, linear, or jittery keyframes into silky-smooth motion curves:
1. For every layer provided, preserve its exact layerId and overall motion intent/destinations.
2. Replace linear easing (0.25,0.25,0.75,0.75) or awkward abrupt handles with refined cubic-bezier handles tailored to the chosen Smoothing Profile and intensity (${intensity}%).
3. Smooth noisy micro-jitters in keyframe values while preserving deliberate poses and keeping timestamps sorted within [0, ${duration}].
4. If a layer currently has NO keyframes or only 1 keyframe, generate a subtle, tasteful 2-keyframe smooth entrance/settle on scaleX/scaleY/opacity or slight position/camera glide matching its static transform so the user sees immediate smooth motion!
5. Keep summary to 1 clear, informative sentence.`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: smoothMotionSchema,
          },
        })
      );

      const raw = JSON.parse((response.text ?? '{}').trim());
      const items = Array.isArray(raw.smoothedLayers) ? raw.smoothedLayers : [];
      const smoothedLayers = items.map((item: Record<string, unknown>) => {
        const keyframes: Record<string, unknown> = {};
        if (Array.isArray(item.keyframesX) && item.keyframesX.length > 0) keyframes.x = toLayerKeyframes(item.keyframesX, duration);
        if (Array.isArray(item.keyframesY) && item.keyframesY.length > 0) keyframes.y = toLayerKeyframes(item.keyframesY, duration);
        if (Array.isArray(item.keyframesScaleX) && item.keyframesScaleX.length > 0) keyframes.scaleX = toLayerKeyframes(item.keyframesScaleX, duration);
        if (Array.isArray(item.keyframesScaleY) && item.keyframesScaleY.length > 0) keyframes.scaleY = toLayerKeyframes(item.keyframesScaleY, duration);
        if (Array.isArray(item.keyframesRotation) && item.keyframesRotation.length > 0) keyframes.rotation = toLayerKeyframes(item.keyframesRotation, duration);
        if (Array.isArray(item.keyframesRotateX) && item.keyframesRotateX.length > 0) keyframes.rotateX = toLayerKeyframes(item.keyframesRotateX, duration);
        if (Array.isArray(item.keyframesRotateY) && item.keyframesRotateY.length > 0) keyframes.rotateY = toLayerKeyframes(item.keyframesRotateY, duration);
        if (Array.isArray(item.keyframesOpacity) && item.keyframesOpacity.length > 0) keyframes.opacity = toLayerKeyframes(item.keyframesOpacity, duration);
        if (Array.isArray(item.keyframesLetterSpacing) && item.keyframesLetterSpacing.length > 0) keyframes.letterSpacing = toLayerKeyframes(item.keyframesLetterSpacing, duration);
        return {
          layerId: String(item.layerId),
          keyframes,
        };
      });

      res.json({
        summary: raw.summary || `Applied ${smoothStyle} AI smoothing (${intensity}%)`,
        smoothedLayers,
      });
    } catch (err) {
      console.error('[AI smooth-motion error]', err);
      const { status, message } = getErrorStatusAndMessage(err, 'Failed to smooth motion curves.');
      res.status(status).json({ error: message });
    }
  });

  // 4. AI Effects, Color & Blend Polish
  app.post('/api/ai/polish-effects', async (req, res) => {
    try {
      const { prompt, style = 'Cyber Neon', layer } = req.body || {};
      if (!prompt || !layer) {
        return res.status(400).json({ error: 'Prompt and target layer are required.' });
      }

      const ai = getGeminiClient();
      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Design a coordinated visual look, color/gradient, stroke, shadow, blend mode, and Alight Motion effect stack for layer "${layer.name}" (type: ${layer.type}, text: ${layer.text || 'n/a'}).
Requested look: "${prompt}".
Mood/Style: "${style}".`,
          config: {
            systemInstruction:
              'You are a motion graphics colorist and compositing artist. Return a cohesive high-contrast palette, gradient option, crisp blendMode, optional shadow, and 1 to 3 complementary effects (like deepGlow + chromaticAberration + smoothBevel, or glow + oscillate).',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: polishEffectsSchema,
          },
        })
      );

      const raw = JSON.parse((response.text ?? '{}').trim());
      const builtEffects = (Array.isArray(raw.effects) ? raw.effects : [])
        .map((fx: { type?: string; color?: string; intensity?: number }, idx: number) =>
          buildEffectInstanceFromAI(String(fx.type || ''), fx.color, fx.intensity, idx)
        )
        .filter(Boolean);

      res.json({
        summary: raw.summary || 'Applied AI color & effects look',
        fillColor: String(raw.fillColor || '#2BE0A5'),
        fillGradient: raw.useGradient
          ? {
              enabled: true,
              color1: String(raw.gradientColor1 || raw.fillColor || '#2BE0A5'),
              color2: String(raw.gradientColor2 || '#38B2CE'),
              angle: Number(raw.gradientAngle ?? 135),
            }
          : undefined,
        strokeColor: String(raw.strokeColor || '#FFFFFF'),
        strokeWidth: Math.max(0, Number(raw.strokeWidth || 0)),
        blendMode: String(raw.blendMode || 'normal'),
        shadow: raw.shadowEnabled
          ? {
              enabled: true,
              color: String(raw.shadowColor || '#000000'),
              blur: Math.max(4, Number(raw.shadowBlur || 24)),
              offsetX: 0,
              offsetY: 8,
            }
          : undefined,
        effects: builtEffects,
      });
    } catch (err) {
      console.error('[AI polish-effects error]', err);
      const { status, message } = getErrorStatusAndMessage(err, 'Failed to generate AI effects.');
      res.status(status).json({ error: message });
    }
  });

  // 5. AI Auto-Camera & Beat Sync Director
  app.post('/api/ai/camera-director', async (req, res) => {
    try {
      const { prompt = 'Cinematic beat-synced zoom punches and smooth camera drift', layers = [], duration = 6, width = 1280, height = 720, style = 'Dynamic Beat Sync' } = req.body || {};

      const timelineSummary = (Array.isArray(layers) ? layers : [])
        .filter((l: Record<string, unknown>) => l.type !== 'camera')
        .slice(0, 12)
        .map((l: Record<string, unknown>) => ({
          name: l.name,
          type: l.type,
          startTime: l.startTime,
          endTime: l.endTime,
          x: (l.transform as Record<string, unknown>)?.x ?? 0,
          y: (l.transform as Record<string, unknown>)?.y ?? 0,
        }));

      const ai = getGeminiClient();
      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Direct a Cinema Camera Rig for this ${width}x${height} timeline (duration ${duration}s).
Direction: "${prompt}". Pacing style: "${style}".
Existing timeline layers:
${JSON.stringify(timelineSummary)}`,
          config: {
            systemInstruction: `You are an expert cinematography & camera rig animator in Alight Motion.
Choreograph Camera keyframes (scaleX & scaleY around 0.85 to 1.45 for zoom push-ins/punches, x & y pan tracking active layers, subtle rotation -4 to +4 deg for handheld/dramatic tilt) AND place beatMarkers right on major cuts or punches within [0, ${duration}]. Keep scaleX and scaleY aligned for clean zoom.`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: cameraDirectorSchema,
          },
        })
      );

      const raw = JSON.parse((response.text ?? '{}').trim());
      const keyframes: Record<string, unknown> = {};
      if (Array.isArray(raw.keyframesX) && raw.keyframesX.length > 0) keyframes.x = toLayerKeyframes(raw.keyframesX, duration);
      if (Array.isArray(raw.keyframesY) && raw.keyframesY.length > 0) keyframes.y = toLayerKeyframes(raw.keyframesY, duration);
      if (Array.isArray(raw.keyframesScaleX) && raw.keyframesScaleX.length > 0) keyframes.scaleX = toLayerKeyframes(raw.keyframesScaleX, duration);
      if (Array.isArray(raw.keyframesScaleY) && raw.keyframesScaleY.length > 0) keyframes.scaleY = toLayerKeyframes(raw.keyframesScaleY, duration);
      if (Array.isArray(raw.keyframesRotation) && raw.keyframesRotation.length > 0) keyframes.rotation = toLayerKeyframes(raw.keyframesRotation, duration);

      const shakeFx = raw.addHandShake ? buildEffectInstanceFromAI('shake', '#FFFFFF', 4, 0) : null;

      const cameraLayer = {
        id: `layer_ai_cam_${Date.now()}`,
        name: 'AI Camera Rig',
        type: 'camera',
        cameraActive: true,
        startTime: 0,
        endTime: duration,
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
        keyframes,
        effects: shakeFx ? [shakeFx] : [],
      };

      const beatMarkers = (Array.isArray(raw.beatMarkers) ? raw.beatMarkers : [])
        .map((n: unknown) => Math.max(0, Math.min(duration, Number(n) || 0)))
        .sort((a: number, b: number) => a - b);

      res.json({
        summary: raw.summary || 'Choreographed beat-synced AI camera rig',
        beatMarkers,
        cameraLayer,
      });
    } catch (err) {
      console.error('[AI camera-director error]', err);
      const { status, message } = getErrorStatusAndMessage(err, 'Failed to choreograph AI camera.');
      res.status(status).json({ error: message });
    }
  });

  // 6. AI Kinetic Typography Director
  app.post('/api/ai/typography-director', async (req, res) => {
    try {
      const { prompt, style = 'Bold Kinetic Impact', width = 1280, height = 720, duration = 6, currentTime = 0 } = req.body || {};
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required for AI Kinetic Typography.' });
      }

      const ai = getGeminiClient();
      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Create a punchy multi-line or multi-beat kinetic typography sequence for: "${prompt}".
Style: ${style}. Canvas: ${width}x${height} (center 0,0). Timeline range: starting near ${Number(currentTime).toFixed(2)}s up to ${duration}s.`,
          config: {
            systemInstruction: `You are a kinetic typography director. Create 2 to 4 crisp, punchy Text layers with staggered timing, animated letterSpacing/scale/Y slide keyframes with snappy bezier curves, bold readable fonts (Outfit, Archivo, Oswald, Playfair Display), and matching beatMarkers.`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: typographyDirectorSchema,
          },
        })
      );

      const raw = JSON.parse((response.text ?? '{}').trim());
      const items = Array.isArray(raw.textLayers) ? raw.textLayers : [];
      const layers = items.map((l: Record<string, unknown>, idx: number) => {
        const keyframes: Record<string, unknown> = {};
        if (Array.isArray(l.keyframesX) && l.keyframesX.length > 0) keyframes.x = toLayerKeyframes(l.keyframesX, duration);
        if (Array.isArray(l.keyframesY) && l.keyframesY.length > 0) keyframes.y = toLayerKeyframes(l.keyframesY, duration);
        if (Array.isArray(l.keyframesScaleX) && l.keyframesScaleX.length > 0) keyframes.scaleX = toLayerKeyframes(l.keyframesScaleX, duration);
        if (Array.isArray(l.keyframesScaleY) && l.keyframesScaleY.length > 0) keyframes.scaleY = toLayerKeyframes(l.keyframesScaleY, duration);
        if (Array.isArray(l.keyframesRotation) && l.keyframesRotation.length > 0) keyframes.rotation = toLayerKeyframes(l.keyframesRotation, duration);
        if (Array.isArray(l.keyframesOpacity) && l.keyframesOpacity.length > 0) keyframes.opacity = toLayerKeyframes(l.keyframesOpacity, duration);
        if (Array.isArray(l.keyframesLetterSpacing) && l.keyframesLetterSpacing.length > 0) keyframes.letterSpacing = toLayerKeyframes(l.keyframesLetterSpacing, duration);

        const fx = buildEffectInstanceFromAI(String(l.effectType || 'none'), String(l.fillColor || '#2BE0A5'), 0, idx);

        return {
          id: `layer_ai_txt_${Date.now()}_${idx}`,
          name: String(l.name || `Kinetic Type ${idx + 1}`),
          type: 'text',
          text: String(l.text || 'KINETIC'),
          fontFamily: String(l.fontFamily || 'Outfit'),
          fontSize: Math.max(18, Number(l.fontSize || 72)),
          fontWeight: Number(l.fontWeight || 800),
          textAlign: 'center',
          letterSpacing: Number(l.letterSpacing ?? 4),
          lineHeight: 1.15,
          fillColor: String(l.fillColor || '#FFFFFF'),
          strokeColor: '#0E131D',
          strokeWidth: 0,
          startTime: Math.max(0, Number(l.startTime ?? 0)),
          endTime: Math.min(duration, Math.max(0.4, Number(l.endTime ?? duration))),
          visible: true,
          locked: false,
          parentId: null,
          blendMode: 'normal',
          transform: {
            x: Number(l.x ?? 0),
            y: Number(l.y ?? 0),
            scaleX: Number(l.scaleX ?? 1),
            scaleY: Number(l.scaleY ?? 1),
            rotation: Number(l.rotation ?? 0),
            skewX: 0,
            skewY: 0,
            anchorX: 0,
            anchorY: 0,
            opacity: Number(l.opacity ?? 100),
          },
          keyframes,
          effects: fx ? [fx] : [],
        };
      });

      res.json({
        summary: raw.summary || 'Generated kinetic typography sequence',
        beatMarkers: Array.isArray(raw.beatMarkers) ? raw.beatMarkers : [],
        layers,
      });
    } catch (err) {
      console.error('[AI typography-director error]', err);
      const { status, message } = getErrorStatusAndMessage(err, 'Failed to generate kinetic typography.');
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Kinetix Motion Studio running on http://0.0.0.0:${port}`);
  });
}

startServer();
