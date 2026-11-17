import React, { useState } from 'react';
import {
  Box,
  Camera,
  FolderOpen,
  Image as ImageIcon,
  Music,
  PenTool,
  Pencil,
  Shapes,
  Sparkles,
  SquareSlash,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { CreationCategory, ShapeKind } from '../types/editor';
import { SHAPE_CATALOG } from '../engine/presets';

interface AddLayerDrawerProps {
  open: boolean;
  onClose: () => void;
  onAddShape: (kind: ShapeKind, label: string) => void;
  onAddText: (presetText?: string) => void;
  onAddObject: (kind: 'camera' | 'null' | 'group') => void;
  onAddMediaFile: (file: File, kind: 'image' | 'video') => void;
  onAddAudioFile: (file: File) => void;
  onAddElementPreset: (presetId: string) => void;
  onStartDrawing: (mode: 'freehand' | 'vector') => void;
  onOpenAI: () => void;
}

export const AddLayerDrawer: React.FC<AddLayerDrawerProps> = ({
  open,
  onClose,
  onAddShape,
  onAddText,
  onAddObject,
  onAddMediaFile,
  onAddAudioFile,
  onAddElementPreset,
  onStartDrawing,
  onOpenAI,
}) => {
  const [category, setCategory] = useState<CreationCategory>('shape');

  if (!open) return null;

  const topTabs: Array<{ id: CreationCategory; label: string; icon: React.ReactNode }> = [
    { id: 'shape', label: 'Shape', icon: <Shapes className="w-5 h-5" /> },
    { id: 'media', label: 'Media', icon: <ImageIcon className="w-5 h-5" /> },
    { id: 'audio', label: 'Audio', icon: <Music className="w-5 h-5" /> },
    { id: 'object', label: 'Object', icon: <Box className="w-5 h-5" /> },
    { id: 'elements', label: 'Elements', icon: <Sparkles className="w-5 h-5" /> },
  ];

  const renderShapeGlyph = (kind: ShapeKind) => {
    switch (kind) {
      case 'circle':
        return <circle cx="24" cy="24" r="16" fill="currentColor" />;
      case 'rect':
        return <rect x="8" y="8" width="32" height="32" fill="currentColor" />;
      case 'roundedRect':
        return <rect x="8" y="8" width="32" height="32" rx="8" fill="currentColor" />;
      case 'triangle':
        return <polygon points="24,7 41,39 7,39" fill="currentColor" />;
      case 'star':
        return (
          <polygon
            points="24,6 29,18 42,19 32,27 35,40 24,33 13,40 16,27 6,19 19,18"
            fill="currentColor"
          />
        );
      case 'polygon':
        return (
          <polygon
            points="24,7 39,15 39,33 24,41 9,33 9,15"
            fill="currentColor"
          />
        );
      case 'ring':
        return (
          <circle
            cx="24"
            cy="24"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
          />
        );
      case 'arc':
        return (
          <path
            d="M 11 33 A 15 15 0 1 1 37 33"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
        );
      case 'cross':
        return (
          <path
            d="M19 8h10v11h11v10H29v11H19V29H8V19h11z"
            fill="currentColor"
          />
        );
      case 'arrow':
        return (
          <path
            d="M8 19h18v-8l14 13-14 13v-8H8z"
            fill="currentColor"
          />
        );
      case 'pill':
        return <rect x="6" y="14" width="36" height="20" rx="10" fill="currentColor" />;
      case 'diamond':
        return <polygon points="24,6 40,24 24,42 8,24" fill="currentColor" />;
      case 'heart':
        return (
          <path
            d="M24 39s-14-8.8-14-18.5C10 14.5 14.5 10 19.5 10c2.7 0 4.5 1.5 4.5 3 0-1.5 1.8-3 4.5-3 5 0 9.5 4.5 9.5 10.5C38 30.2 24 39 24 39z"
            fill="currentColor"
          />
        );
      case 'burst':
        return (
          <polygon
            points="24,5 28,15 39,9 33,20 43,24 33,28 39,39 28,33 24,43 20,33 9,39 15,28 5,24 15,20 9,9 20,15"
            fill="currentColor"
          />
        );
      case 'spiral':
        return (
          <path
            d="M24 24a2 2 0 1 1 2-2 4 4 0 1 1-4 4 7 7 0 1 1 7-7 10 10 0 1 1-10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      case 'hudGrid':
        return (
          <g fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="9" y="9" width="30" height="30" rx="2" />
            <line x1="24" y1="9" x2="24" y2="39" />
            <line x1="9" y1="24" x2="39" y2="24" />
            <circle cx="24" cy="24" r="7" />
          </g>
        );
      case 'bracket':
        return (
          <path
            d="M17 10H10v28h7M31 10h7v28h-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        );
      case 'wave':
        return (
          <path
            d="M6 26c4-10 8-10 12 0s8 10 12 0 8-10 12 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        );
      case 'badge':
        return (
          <path
            d="M24 6l14 5v11c0 9.5-5.8 16.5-14 20-8.2-3.5-14-10.5-14-20V11z"
            fill="currentColor"
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[90dvh] bg-[#1E2231] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Category Tabs matching Screenshots 2, 5, 8 */}
        <div className="flex items-center border-b border-white/[0.08] bg-[#24293B] px-2 pt-2">
          <div className="flex-1 grid grid-cols-5 gap-1">
            {topTabs.map((tab) => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCategory(tab.id)}
                  className={`py-2.5 flex flex-col items-center gap-1 rounded-t-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'text-[#2BE0A5] bg-[#1E2231]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Split Body: Left Content Grid + Right Vertical Action Rail (Screenshots 2, 5, 8) */}
        <div className="flex flex-1 min-h-[260px] overflow-hidden">
          {/* Left Category Content */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto max-h-[58dvh] sm:max-h-[340px]">
            {category === 'shape' && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-2.5">
                {SHAPE_CATALOG.map((shape) => (
                  <button
                    key={shape.kind}
                    onClick={() => {
                      onAddShape(shape.kind, shape.label);
                      onClose();
                    }}
                    className="aspect-square rounded-xl bg-[#272C3F] hover:bg-[#313850] border border-white/[0.06] hover:border-[#2BE0A5]/60 flex flex-col items-center justify-center gap-1 text-slate-200 hover:text-[#2BE0A5] transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 48 48" className="w-10 h-10">
                      {renderShapeGlyph(shape.kind)}
                    </svg>
                    <span className="text-[11px] font-medium">{shape.label}</span>
                  </button>
                ))}
              </div>
            )}

            {category === 'object' && (
              <div className="h-full flex flex-wrap items-center justify-center gap-3 sm:gap-5 py-4 sm:py-6">
                {/* Camera with Amber/Gold border matching Screenshots 2 & 5 */}
                <button
                  onClick={() => {
                    onAddObject('camera');
                    onClose();
                  }}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#1A1E2B] border-[3px] border-[#F2A833] hover:scale-105 flex flex-col items-center justify-center gap-2 text-white transition-transform cursor-pointer"
                >
                  <Camera className="w-7 h-7 sm:w-8 sm:h-8" />
                  <span className="text-xs font-semibold">Camera</span>
                </button>

                <button
                  onClick={() => {
                    onAddObject('null');
                    onClose();
                  }}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#252A3C] border border-white/10 hover:border-[#2BE0A5] flex flex-col items-center justify-center gap-2 text-white transition-colors cursor-pointer"
                >
                  <SquareSlash className="w-7 h-7 sm:w-8 sm:h-8 text-slate-300" />
                  <span className="text-xs font-semibold">Null</span>
                </button>

                <button
                  onClick={() => {
                    onAddObject('group');
                    onClose();
                  }}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#252A3C] border border-white/10 hover:border-[#2BE0A5] flex flex-col items-center justify-center gap-2 text-white transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-7 h-7 sm:w-8 sm:h-8 text-slate-300" />
                  <span className="text-xs font-semibold">Empty Group</span>
                </button>
              </div>
            )}

            {category === 'media' && (
              <div className="h-full flex flex-col items-center justify-center gap-3 py-6 text-center">
                <label className="px-5 py-3 rounded-xl bg-[#2BE0A5] hover:bg-[#23C790] text-[#0E131D] text-xs font-bold flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Import Image or Video</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const isVid = file.type.startsWith('video/');
                      onAddMediaFile(file, isVid ? 'video' : 'image');
                      onClose();
                    }}
                  />
                </label>
                <p className="text-xs text-slate-400 max-w-xs">
                  Add PNG, JPG, SVG, or MP4/WebM clips directly onto the stage with full keyframe, blend mode, and effect support.
                </p>
              </div>
            )}

            {category === 'audio' && (
              <div className="h-full flex flex-col items-center justify-center gap-3 py-6 text-center">
                <label className="px-5 py-3 rounded-xl bg-[#E86F68] hover:bg-[#D95E57] text-white text-xs font-bold flex items-center gap-2 cursor-pointer">
                  <Music className="w-4 h-4" />
                  <span>Import Audio Track (MP3 / WAV)</span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      onAddAudioFile(file);
                      onClose();
                    }}
                  />
                </label>
                <p className="text-xs text-slate-400 max-w-xs">
                  Sync motion keyframes and beat markers to your uploaded music or voiceover track with real-time waveform display.
                </p>
              </div>
            )}

            {category === 'elements' && (
              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    onClose();
                    onOpenAI();
                  }}
                  className="w-full p-3 rounded-xl bg-[#2BE0A5]/15 border border-[#2BE0A5]/50 hover:bg-[#2BE0A5]/25 flex items-center justify-between text-left cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-[#2BE0A5] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Custom Motion Graphic with AI</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      Describe any title, HUD, badge, or kinetic sequence and let Gemini build the keyframes.
                    </div>
                  </div>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'lower-third', title: 'Kinetic Lower Third', desc: 'Slide-in pill + bold headline' },
                    { id: 'pulse-radar', title: 'Orbital Pulse Ring', desc: 'Spinning glowing arc + star' },
                    { id: 'pop-badge', title: 'Overshoot Pop Badge', desc: 'Bouncy spring badge reveal' },
                    { id: 'glitch-title', title: 'RGB Split Title', desc: 'Chromatic aberration headline' },
                    { id: 'progress-ring', title: '25% Progress Ring', desc: 'Drawing Progress radial meter' },
                    { id: 'count-stat', title: 'Count-Up Stat', desc: 'Animated 0 to 100% readout' },
                    { id: 'hud-reticle', title: 'HUD Target Reticle', desc: 'Rotating sci-fi reticle + brackets' },
                    { id: 'timecode-stamp', title: 'Timecode Stamp', desc: 'Live SMPTE frame counter' },
                    { id: 'extrude-badge', title: '3D Extrude Burst', desc: 'Depth-extruded burst + DeepGlow' },
                  ].map((el) => (
                    <button
                      key={el.id}
                      onClick={() => {
                        onAddElementPreset(el.id);
                        onClose();
                      }}
                      className="p-3 rounded-xl bg-[#252A3C] hover:bg-[#2E354B] border border-white/[0.06] text-left cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-white">{el.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{el.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Vertical Rail: Freehand Drawing, Vector Drawing, Text (Screenshots 2, 5, 8) */}
          <div className="w-20 sm:w-24 shrink-0 bg-[#191D2B] border-l border-white/[0.08] p-1.5 sm:p-2 flex flex-col justify-between gap-2">
            <button
              onClick={() => {
                onStartDrawing('freehand');
                onClose();
              }}
              className="flex-1 rounded-xl hover:bg-white/[0.06] flex flex-col items-center justify-center gap-1.5 text-slate-200 hover:text-[#2BE0A5] p-1 text-center cursor-pointer"
            >
              <Pencil className="w-5 h-5" />
              <span className="text-[11px] leading-tight">Freehand Drawing</span>
            </button>

            <button
              onClick={() => {
                onStartDrawing('vector');
                onClose();
              }}
              className="flex-1 rounded-xl hover:bg-white/[0.06] flex flex-col items-center justify-center gap-1.5 text-slate-200 hover:text-[#2BE0A5] p-1 text-center cursor-pointer"
            >
              <PenTool className="w-5 h-5" />
              <span className="text-[11px] leading-tight">Vector Drawing</span>
            </button>

            <button
              onClick={() => {
                onAddText();
                onClose();
              }}
              className="flex-1 rounded-xl hover:bg-white/[0.06] flex flex-col items-center justify-center gap-1.5 text-slate-200 hover:text-[#2BE0A5] p-1 text-center cursor-pointer"
            >
              <Type className="w-5 h-5" />
              <span className="text-[11px] leading-tight">Text</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
