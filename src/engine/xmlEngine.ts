import {
  BlendMode,
  EasingCurve,
  EffectInstance,
  EffectType,
  Keyframe,
  Layer,
  LayerType,
  NumericAnimatableProp,
  ProjectBackground,
  ProjectConfig,
  ShapeKind,
} from '../types/editor';
import { createEffectInstance } from './presets';

function escapeXml(val: string | number | boolean | undefined): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function serializeEasing(curve: EasingCurve): string {
  if (curve.type === 'steps') {
    return `type="steps" steps="${curve.steps}"`;
  }
  return `type="bezier" p1x="${curve.p1x}" p1y="${curve.p1y}" p2x="${curve.p2x}" p2y="${curve.p2y}"`;
}

function serializeLayerXml(l: Layer, indent = '    '): string {
  const lines: string[] = [];
  const attrs = [
    `id="${escapeXml(l.id)}"`,
    `name="${escapeXml(l.name)}"`,
    `type="${escapeXml(l.type)}"`,
    `startTime="${l.startTime}"`,
    `endTime="${l.endTime}"`,
    `visible="${l.visible}"`,
    `locked="${l.locked}"`,
    `parentId="${escapeXml(l.parentId || '')}"`,
    `blendMode="${escapeXml(l.blendMode)}"`,
  ];
  if (l.shapeKind) attrs.push(`shapeKind="${escapeXml(l.shapeKind)}"`);
  if (l.width !== undefined) attrs.push(`width="${l.width}"`);
  if (l.height !== undefined) attrs.push(`height="${l.height}"`);
  if (l.fillColor) attrs.push(`fillColor="${escapeXml(l.fillColor)}"`);
  if (l.strokeColor) attrs.push(`strokeColor="${escapeXml(l.strokeColor)}"`);
  if (l.strokeWidth !== undefined) attrs.push(`strokeWidth="${l.strokeWidth}"`);
  if (l.cornerRadius !== undefined) attrs.push(`cornerRadius="${l.cornerRadius}"`);
  if (l.isMask) attrs.push(`isMask="true"`);
  if (l.maskMode) attrs.push(`maskMode="${escapeXml(l.maskMode)}"`);
  if (l.cameraActive) attrs.push(`cameraActive="true"`);

  lines.push(`${indent}<layer ${attrs.join(' ')}>`);
  lines.push(
    `${indent}  <transform x="${l.transform.x}" y="${l.transform.y}" scaleX="${l.transform.scaleX}" scaleY="${l.transform.scaleY}" rotation="${l.transform.rotation}" rotateX="${l.transform.rotateX ?? 0}" rotateY="${l.transform.rotateY ?? 0}" skewX="${l.transform.skewX}" skewY="${l.transform.skewY}" anchorX="${l.transform.anchorX}" anchorY="${l.transform.anchorY}" opacity="${l.transform.opacity}" />`
  );

  if (l.type === 'text') {
    lines.push(
      `${indent}  <textContent fontFamily="${escapeXml(l.fontFamily || 'Outfit')}" fontSize="${l.fontSize ?? 64}" fontWeight="${l.fontWeight ?? 700}" letterSpacing="${l.letterSpacing ?? 0}" lineHeight="${l.lineHeight ?? 1.15}" textAlign="${l.textAlign || 'center'}">${escapeXml(l.text || '')}</textContent>`
    );
  }

  if (l.fillGradient?.enabled) {
    lines.push(
      `${indent}  <gradient enabled="true" color1="${escapeXml(l.fillGradient.color1)}" color2="${escapeXml(l.fillGradient.color2)}" angle="${l.fillGradient.angle}" />`
    );
  }

  if (l.shadow?.enabled) {
    lines.push(
      `${indent}  <shadow enabled="true" color="${escapeXml(l.shadow.color)}" blur="${l.shadow.blur}" offsetX="${l.shadow.offsetX}" offsetY="${l.shadow.offsetY}" />`
    );
  }

  const kfEntries = Object.entries(l.keyframes).filter(
    ([, arr]) => Array.isArray(arr) && arr.length > 0
  );
  if (kfEntries.length > 0) {
    lines.push(`${indent}  <keyframes>`);
    for (const [prop, arr] of kfEntries) {
      lines.push(`${indent}    <property name="${escapeXml(prop)}">`);
      for (const kf of arr!) {
        lines.push(
          `${indent}      <kf t="${kf.time}" v="${kf.value}" ${serializeEasing(kf.easing)} />`
        );
      }
      lines.push(`${indent}    </property>`);
    }
    lines.push(`${indent}  </keyframes>`);
  }

  if (l.effects.length > 0) {
    lines.push(`${indent}  <effects>`);
    for (const fx of l.effects) {
      lines.push(
        `${indent}    <effect type="${escapeXml(fx.type)}" name="${escapeXml(fx.name)}" enabled="${fx.enabled}">`
      );
      for (const [pk, pv] of Object.entries(fx.params)) {
        lines.push(
          `${indent}      <param key="${escapeXml(pk)}" value="${escapeXml(pv)}" />`
        );
      }
      lines.push(`${indent}    </effect>`);
    }
    lines.push(`${indent}  </effects>`);
  }

  lines.push(`${indent}</layer>`);
  return lines.join('\n');
}

export function serializeProjectToXML(
  project: ProjectConfig,
  layers: Layer[]
): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>`;
  const projOpen = `<scene format="kinetix-alight-xml" version="1.0" id="${escapeXml(project.id)}" title="${escapeXml(project.name)}" aspectRatio="${escapeXml(project.aspectRatio)}" width="${project.width}" height="${project.height}" fps="${project.fps}" duration="${project.duration}" background="${escapeXml(project.background)}" beatMarkers="${escapeXml(project.beatMarkers.join(','))}">`;
  const layersXml = layers.map((l) => serializeLayerXml(l, '  ')).join('\n');
  return `${header}\n${projOpen}\n${layersXml}\n</scene>`;
}

export function serializeLayerPresetToXML(layer: Layer): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>`;
  return `${header}\n<alightPreset format="kinetix-alight-xml" version="1.0">\n${serializeLayerXml(layer, '  ')}\n</alightPreset>`;
}

function parseEasingFromElement(el: Element): EasingCurve {
  const type = el.getAttribute('type') || el.getAttribute('e') || 'bezier';
  if (type === 'steps') {
    return {
      type: 'steps',
      steps: Math.max(2, Number(el.getAttribute('steps') || 4)),
    };
  }
  const p1x = Number(el.getAttribute('p1x'));
  const p1y = Number(el.getAttribute('p1y'));
  const p2x = Number(el.getAttribute('p2x'));
  const p2y = Number(el.getAttribute('p2y'));
  if (
    !Number.isNaN(p1x) &&
    !Number.isNaN(p1y) &&
    !Number.isNaN(p2x) &&
    !Number.isNaN(p2y)
  ) {
    return { type: 'bezier', p1x, p1y, p2x, p2y };
  }
  // Support Alight Motion cubicBezier="p1x p1y p2x p2y"
  const cb = el.getAttribute('cubicBezier') || el.getAttribute('e');
  if (cb && cb.includes(' ')) {
    const parts = cb.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      return {
        type: 'bezier',
        p1x: parts[0],
        p1y: parts[1],
        p2x: parts[2],
        p2y: parts[3],
      };
    }
  }
  return { type: 'bezier', p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 };
}

function mapXmlEffectType(rawType: string): EffectType {
  const norm = rawType.toLowerCase();
  if (norm.includes('glow')) return norm.includes('deep') ? 'deepGlow' : 'glow';
  if (norm.includes('blur')) return norm.includes('dir') ? 'directionalBlur' : 'gaussianBlur';
  if (norm.includes('rgb') || norm.includes('chrom')) return 'chromaticAberration';
  if (norm.includes('wave')) return 'waveWarp';
  if (norm.includes('osc')) return 'oscillate';
  if (norm.includes('draw') || norm.includes('progress')) return 'drawingProgress';
  if (norm.includes('extrude')) return 'extrude3d';
  if (norm.includes('bevel')) return 'smoothBevel';
  if (norm.includes('count')) return 'countUpDown';
  if (norm.includes('textprogress')) return 'textProgress';
  if (norm.includes('random')) return 'textRandomizer';
  if (norm.includes('timecode')) return 'timecode';
  if (norm.includes('hue')) return 'hueShift';
  if (norm.includes('fade')) return 'fadeInOut';
  if (norm.includes('vignette')) return 'vignette';
  if (norm.includes('shake')) return 'shake';
  if (norm.includes('blink')) return 'blink';
  if (norm.includes('radial')) return 'radialRepeat';
  if (norm.includes('linear')) return 'linearRepeat';
  if (norm.includes('squeeze')) return 'squeeze';
  if (norm.includes('colorize')) return 'colorize';
  if (norm.includes('chroma')) return 'chromaKey';
  if (norm.includes('invert')) return 'invert';
  return 'glow';
}

function parseLayerElement(el: Element, index: number, defaultDuration: number): Layer {
  const tag = el.tagName.toLowerCase();
  let type: LayerType = (el.getAttribute('type') as LayerType) || 'shape';
  if (tag === 'text') type = 'text';
  else if (tag === 'nullobj') type = 'null';
  else if (tag === 'camera') type = 'camera';
  else if (tag === 'group') type = 'group';
  else if (tag === 'shape') type = 'shape';

  const tEl = el.querySelector(':scope > transform');
  const numAttr = (node: Element | null, attr: string, fallback: number) => {
    const val = node?.getAttribute(attr);
    if (val === null || val === undefined || val === '') return fallback;
    const n = Number(val);
    return Number.isNaN(n) ? fallback : n;
  };

  const keyframes: Partial<Record<NumericAnimatableProp, Keyframe<number>[]>> = {};
  const propEls = el.querySelectorAll(':scope > keyframes > property, :scope > property');
  propEls.forEach((pEl) => {
    const rawName = (pEl.getAttribute('name') || 'x').trim();
    const mappedProp: NumericAnimatableProp =
      rawName === 'alpha' || rawName === 'opacity'
        ? 'opacity'
        : rawName === 'rot' || rawName === 'rotation'
          ? 'rotation'
          : rawName === 'posX' || rawName === 'x'
            ? 'x'
            : rawName === 'posY' || rawName === 'y'
              ? 'y'
              : (rawName as NumericAnimatableProp);

    const kfs: Keyframe<number>[] = [];
    pEl.querySelectorAll(':scope > kf').forEach((kfEl, ki) => {
      const t = Number(kfEl.getAttribute('t') ?? 0);
      const v = Number(kfEl.getAttribute('v') ?? 0);
      if (!Number.isNaN(t) && !Number.isNaN(v)) {
        kfs.push({
          id: `xml_kf_${index}_${mappedProp}_${ki}_${Date.now()}`,
          time: t,
          value: v,
          easing: parseEasingFromElement(kfEl),
        });
      }
    });
    if (kfs.length > 0) {
      keyframes[mappedProp] = kfs.sort((a, b) => a.time - b.time);
    }
  });

  const effects: EffectInstance[] = [];
  el.querySelectorAll(':scope > effects > effect, :scope > effect').forEach((fxEl) => {
    const rawType = fxEl.getAttribute('type') || fxEl.getAttribute('id') || 'glow';
    const baseFx = createEffectInstance(mapXmlEffectType(rawType));
    baseFx.name = fxEl.getAttribute('name') || baseFx.name;
    baseFx.enabled = fxEl.getAttribute('enabled') !== 'false';
    fxEl.querySelectorAll(':scope > param').forEach((pEl) => {
      const key = pEl.getAttribute('key') || pEl.getAttribute('name');
      const val = pEl.getAttribute('value');
      if (key && val !== null) {
        const asNum = Number(val);
        baseFx.params[key] = Number.isNaN(asNum) ? val : asNum;
      }
    });
    effects.push(baseFx);
  });

  const textNode = el.querySelector(':scope > textContent');
  const gradNode = el.querySelector(':scope > gradient');
  const shadowNode = el.querySelector(':scope > shadow');

  const rawStart = numAttr(el, 'startTime', 0);
  const rawEnd = numAttr(el, 'endTime', defaultDuration);

  return {
    id: el.getAttribute('id') || `xml_layer_${Date.now()}_${index}`,
    name: el.getAttribute('name') || el.getAttribute('label') || `${type.toUpperCase()} ${index + 1}`,
    type,
    startTime: rawStart > 50 ? rawStart / 1000 : rawStart, // handle ms or seconds
    endTime: rawEnd > 50 ? rawEnd / 1000 : rawEnd,
    visible: el.getAttribute('visible') !== 'false',
    locked: el.getAttribute('locked') === 'true',
    parentId: el.getAttribute('parentId') || null,
    blendMode: (el.getAttribute('blendMode') as BlendMode) || 'normal',
    shapeKind: (el.getAttribute('shapeKind') as ShapeKind) || (el.getAttribute('s') as ShapeKind) || 'roundedRect',
    width: numAttr(el, 'width', 260),
    height: numAttr(el, 'height', 260),
    fillColor: el.getAttribute('fillColor') || '#2BE0A5',
    strokeColor: el.getAttribute('strokeColor') || '#FFFFFF',
    strokeWidth: numAttr(el, 'strokeWidth', 0),
    cornerRadius: numAttr(el, 'cornerRadius', 24),
    isMask: el.getAttribute('isMask') === 'true',
    maskMode: (el.getAttribute('maskMode') as 'none' | 'clip') || 'none',
    cameraActive: el.getAttribute('cameraActive') === 'true',
    text: textNode?.textContent || el.getAttribute('text') || (type === 'text' ? 'XML TEXT' : undefined),
    fontFamily: textNode?.getAttribute('fontFamily') || 'Outfit',
    fontSize: numAttr(textNode, 'fontSize', 68),
    fontWeight: numAttr(textNode, 'fontWeight', 700),
    letterSpacing: numAttr(textNode, 'letterSpacing', 2),
    lineHeight: numAttr(textNode, 'lineHeight', 1.15),
    textAlign: (textNode?.getAttribute('textAlign') as 'left' | 'center' | 'right') || 'center',
    fillGradient: gradNode
      ? {
          enabled: gradNode.getAttribute('enabled') !== 'false',
          color1: gradNode.getAttribute('color1') || '#2BE0A5',
          color2: gradNode.getAttribute('color2') || '#38B2CE',
          angle: numAttr(gradNode, 'angle', 135),
        }
      : undefined,
    shadow: shadowNode
      ? {
          enabled: shadowNode.getAttribute('enabled') !== 'false',
          color: shadowNode.getAttribute('color') || 'rgba(0,0,0,0.65)',
          blur: numAttr(shadowNode, 'blur', 20),
          offsetX: numAttr(shadowNode, 'offsetX', 0),
          offsetY: numAttr(shadowNode, 'offsetY', 10),
        }
      : undefined,
    transform: {
      x: numAttr(tEl, 'x', 0),
      y: numAttr(tEl, 'y', 0),
      scaleX: numAttr(tEl, 'scaleX', 1),
      scaleY: numAttr(tEl, 'scaleY', 1),
      rotation: numAttr(tEl, 'rotation', 0),
      rotateX: numAttr(tEl, 'rotateX', 0),
      rotateY: numAttr(tEl, 'rotateY', 0),
      skewX: numAttr(tEl, 'skewX', 0),
      skewY: numAttr(tEl, 'skewY', 0),
      anchorX: numAttr(tEl, 'anchorX', 0),
      anchorY: numAttr(tEl, 'anchorY', 0),
      opacity: numAttr(tEl, 'opacity', 100),
    },
    keyframes,
    effects,
  };
}

export function parseXMLToProjectOrLayers(xmlText: string): {
  kind: 'project' | 'preset';
  project?: ProjectConfig;
  layers: Layer[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const errNode = doc.querySelector('parsererror');
  if (errNode) {
    throw new Error('Invalid XML syntax. Please verify the XML file.');
  }

  const root = doc.documentElement;
  const tag = root.tagName.toLowerCase();

  if (tag === 'scene' || tag === 'alightmotionproject' || tag === 'project') {
    const duration = Number(root.getAttribute('duration') || 6);
    const width = Number(root.getAttribute('width') || 1280);
    const height = Number(root.getAttribute('height') || 720);
    const fpsRaw = Number(root.getAttribute('fps') || 60);
    const fps: 24 | 30 | 60 = fpsRaw === 24 || fpsRaw === 30 ? fpsRaw : 60;
    const bgRaw = (root.getAttribute('background') || 'black') as ProjectBackground;
    const background: ProjectBackground =
      bgRaw === 'white' || bgRaw === 'transparent' || bgRaw === 'slate' ? bgRaw : 'black';
    const beatRaw = root.getAttribute('beatMarkers') || '';
    const beatMarkers = beatRaw
      ? beatRaw
          .split(',')
          .map(Number)
          .filter((n) => !Number.isNaN(n))
      : [];

    const project: ProjectConfig = {
      id: `proj_xml_${Date.now()}`,
      name: root.getAttribute('title') || root.getAttribute('name') || 'Imported XML Project',
      mode: 'project',
      aspectRatio: (root.getAttribute('aspectRatio') as ProjectConfig['aspectRatio']) || '16:9',
      width,
      height,
      fps,
      background,
      duration: Number.isNaN(duration) ? 6 : duration,
      beatMarkers,
    };

    const layerNodes = Array.from(
      root.querySelectorAll(':scope > layer, :scope > shape, :scope > text, :scope > nullobj, :scope > camera, :scope > group')
    );
    const layers = layerNodes.map((node, i) =>
      parseLayerElement(node, i, project.duration)
    );
    return { kind: 'project', project, layers };
  }

  // Preset XML
  const layerNodes = Array.from(
    root.querySelectorAll('layer, shape, text, nullobj, camera, group')
  );
  if (layerNodes.length === 0) {
    throw new Error('No layers found inside XML file.');
  }
  const layers = layerNodes.map((node, i) => parseLayerElement(node, i, 6));
  return { kind: 'preset', layers };
}
