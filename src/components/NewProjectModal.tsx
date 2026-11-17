import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  AspectRatioPreset,
  ProjectBackground,
  ProjectConfig,
} from '../types/editor';
import { ASPECT_RATIO_DIMENSIONS } from '../engine/presets';

interface NewProjectModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  currentProject: ProjectConfig;
  onClose: () => void;
  onSaveProject: (config: ProjectConfig, isNew: boolean) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  open,
  mode,
  currentProject,
  onClose,
  onSaveProject,
}) => {
  const [tab, setTab] = useState<'project' | 'element'>(
    mode === 'create' ? 'project' : currentProject.mode
  );
  const [name, setName] = useState(
    mode === 'create' ? 'New Project 1' : currentProject.name
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>(
    currentProject.aspectRatio
  );
  const [fps, setFps] = useState<24 | 30 | 60>(currentProject.fps);
  const [background, setBackground] = useState<ProjectBackground>(
    currentProject.background
  );
  const [duration, setDuration] = useState<number>(currentProject.duration);
  const [resScale, setResScale] = useState<'720p' | '1080p'>('1080p');

  useEffect(() => {
    if (open) {
      setTab(mode === 'create' ? 'project' : currentProject.mode);
      setName(mode === 'create' ? 'New Project 1' : currentProject.name);
      setAspectRatio(currentProject.aspectRatio);
      setFps(currentProject.fps);
      setBackground(currentProject.background);
      setDuration(currentProject.duration);
    }
  }, [open, mode, currentProject]);

  if (!open) return null;

  const ratios: AspectRatioPreset[] = ['16:9', '9:16', '4:5', '1:1', '4:3'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseDims = ASPECT_RATIO_DIMENSIONS[aspectRatio];
    const mult = resScale === '1080p' ? 1 : 0.75;
    onSaveProject(
      {
        ...currentProject,
        id: mode === 'create' ? `proj_${Date.now()}` : currentProject.id,
        name: name.trim() || 'Untitled Project',
        mode: tab,
        aspectRatio,
        width: Math.round(baseDims.width * mult),
        height: Math.round(baseDims.height * mult),
        fps,
        background,
        duration: Math.max(2, Math.min(60, duration)),
      },
      mode === 'create'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#1E2231] border border-white/10 rounded-2xl shadow-2xl">
        <div className="px-5 pt-4 pb-3 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            {mode === 'create' ? 'New Project' : 'Project Settings'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* PROJECT | ELEMENT segmented switch matching Screenshot 7 middle */}
          <div className="grid grid-cols-2 bg-[#141722] p-1 rounded-xl border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setTab('project')}
              className={`py-2 rounded-lg text-xs font-bold tracking-wider transition-colors cursor-pointer ${
                tab === 'project'
                  ? 'bg-[#2B3044] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              PROJECT
            </button>
            <button
              type="button"
              onClick={() => setTab('element')}
              className={`py-2 rounded-lg text-xs font-bold tracking-wider transition-colors cursor-pointer ${
                tab === 'element'
                  ? 'bg-[#2B3044] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ELEMENT
            </button>
          </div>

          {/* Project Name input with clear button */}
          <div className="relative">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project Name"
              className="w-full bg-transparent border-b border-white/20 focus:border-[#2BE0A5] py-2 pr-8 text-sm font-semibold text-white outline-none"
            />
            {name && (
              <button
                type="button"
                onClick={() => setName('')}
                className="absolute right-1 top-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Aspect Ratio Tiles (Screenshot 7 middle) */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-300 block">
              Aspect Ratio
            </span>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {ratios.map((r) => {
                const active = aspectRatio === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAspectRatio(r)}
                    className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#2BE0A5] border-[#2BE0A5] text-[#0E131D] font-bold'
                        : 'bg-[#252A3C] border-white/[0.08] text-slate-200 hover:border-white/25'
                    }`}
                  >
                    <span className="text-xs font-mono-tabular">{r}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resolution / Frame Rate / Duration / Background */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Resolution</span>
              <select
                value={resScale}
                onChange={(e) => setResScale(e.target.value as '720p' | '1080p')}
                className="w-40 bg-[#252A3C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              >
                <option value="1080p">1080p HD</option>
                <option value="720p">720p Fast</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Frame Rate</span>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as 24 | 30 | 60)}
                className="w-40 bg-[#252A3C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              >
                <option value={60}>60 fps (Smooth)</option>
                <option value={30}>30 fps</option>
                <option value={24}>24 fps (Cinema)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Duration (sec)</span>
              <input
                type="number"
                min={2}
                max={60}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-40 bg-[#252A3C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono-tabular text-white outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Background</span>
              <select
                value={background}
                onChange={(e) =>
                  setBackground(e.target.value as ProjectBackground)
                }
                className="w-40 bg-[#252A3C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              >
                <option value="black">Black</option>
                <option value="slate">Dark Slate</option>
                <option value="white">Light Gray / White</option>
                <option value="transparent">Transparent</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-10 rounded-xl bg-[#2BE0A5] hover:bg-[#23C790] text-[#0E131D] text-xs font-bold tracking-wider uppercase cursor-pointer"
          >
            {mode === 'create' ? 'CREATE PROJECT' : 'SAVE SETTINGS'}
          </button>
        </form>
      </div>
    </div>
  );
};
