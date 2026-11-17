import React, { useState } from 'react';
import {
  BookOpen,
  Clapperboard,
  Copy,
  FileCode2,
  FolderOpen,
  Home,
  Layers,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Type as TypeIcon,
} from 'lucide-react';
import { Layer, ProjectConfig } from '../types/editor';
import { TRAILER_TEMPLATES } from '../engine/presets';

export interface SavedProjectRecord {
  id: string;
  updatedAt: number;
  project: ProjectConfig;
  layers: Layer[];
}

interface HomeScreenProps {
  savedProjects: SavedProjectRecord[];
  onOpenProject: (record: SavedProjectRecord) => void;
  onDuplicateProject: (record: SavedProjectRecord) => void;
  onDeleteProject: (id: string) => void;
  onCreateNewProject: () => void;
  onOpenAIGenerate: () => void;
  onOpenAITrailer: () => void;
  onOpenAIScript?: () => void;
  onOpenTrailerTemplate: (trailerId: string) => void;
  onLaunchTutorial: (tutorialId: string) => void;
  onImportXMLFile: (file: File) => void;
}

type HomeTab = 'home' | 'tutorials' | 'projects';

const TUTORIALS = [
  {
    id: 'tut_easing',
    index: '01.',
    title: 'Smooth Keyframes & Bezier Overshoot',
    duration: '2 min interactive',
    summary:
      'Learn how to place white diamond keyframes and drag cubic-bezier handles for snappy Alight Motion bounce curves.',
    steps: [
      'Tap any layer on stage or timeline to open the bottom control grid.',
      'Open Move & Transform, tap the Keyframe Diamond, and adjust position.',
      'Tap the Curve icon in the left rail to shape overshoot handles.',
    ],
  },
  {
    id: 'tut_mask',
    index: '02.',
    title: 'Mask & Group Clipping',
    duration: '2 min interactive',
    summary:
      'Long-press layers in the timeline to multi-select, then use Mask or Group & Mask from the top menu to clip shapes.',
    steps: [
      'Hold (long-press) a layer in the timeline to enter multi-select mode.',
      'Select two overlapping layers, then tap Group & Mask in the top bar.',
      'Select the mask child to resize or animate the reveal window.',
    ],
  },
  {
    id: 'tut_null_cam',
    index: '03.',
    title: 'Null Rigging & Camera Zoom',
    duration: '3 min interactive',
    summary:
      'Parent shapes and kinetic titles to a Null controller and animate a smooth Camera push-in across all layers at once.',
    steps: [
      'Tap the bottom + button and choose Object -> Null or Camera.',
      'In Move & Transform, set Parent Layer to your Null controller.',
      'Animate Camera Scale from 1.25x to 1.0x for a cinematic opener.',
    ],
  },
  {
    id: 'tut_ai',
    index: '04.',
    title: 'AI Motion Graphics Choreography',
    duration: '1 min interactive',
    summary:
      'Describe any kinetic typography intro, lower-third, or HUD and generate multi-layer bezier animations automatically.',
    steps: [
      'Tap AI Motion in the top bar or from Home.',
      'Enter a scene prompt and choose your visual style.',
      'Refine any generated keyframe, color, or effect in the bottom dock.',
    ],
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  savedProjects,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  onCreateNewProject,
  onOpenAIGenerate,
  onOpenAITrailer,
  onOpenAIScript,
  onOpenTrailerTemplate,
  onLaunchTutorial,
  onImportXMLFile,
}) => {
  const [activeTab, setActiveTab] = useState<HomeTab>('home');
  const [expandedTutorial, setExpandedTutorial] = useState<string | null>(
    TUTORIALS[0].id
  );

  return (
    <div className="h-[100dvh] w-screen bg-[#12151E] text-[#EEF1F7] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 bg-[#161925] border-b border-white/[0.08] px-5 flex items-center justify-between gap-6 shrink-0">
        <span className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Kinetix Motion
        </span>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={() => setActiveTab('home')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'home' ? 'text-[#2BE0A5]' : ''
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'projects' ? 'text-[#2BE0A5]' : ''
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => setActiveTab('tutorials')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'tutorials' ? 'text-[#2BE0A5]' : ''
            }`}
          >
            Tutorials
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <label className="h-9 px-3 rounded-lg bg-[#24293B] hover:bg-[#2F364D] border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer">
            <FileCode2 className="w-3.5 h-3.5 text-[#38B2CE]" />
            <span className="hidden sm:inline">Import XML</span>
            <input
              type="file"
              accept=".xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportXMLFile(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
          <button
            onClick={onOpenAITrailer}
            className="h-9 px-3 rounded-lg bg-[#F2A833]/15 border border-[#F2A833]/40 text-[#F2A833] hover:bg-[#F2A833]/25 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Trailer</span>
          </button>
          <button
            onClick={onOpenAIGenerate}
            className="h-9 px-3 rounded-lg bg-[#2BE0A5]/15 border border-[#2BE0A5]/40 text-[#2BE0A5] hover:bg-[#2BE0A5]/25 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Scene</span>
          </button>
          <button
            onClick={onCreateNewProject}
            className="h-9 px-3.5 sm:px-4 rounded-lg bg-[#2BE0A5] hover:bg-[#23C790] text-[#0E131D] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Home Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 sm:py-6">
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
          {/* Welcome / Quick Action Hero (shown on Home tab) */}
          {activeTab === 'home' && (
            <section className="bg-[#1A1E2B] border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="space-y-2 max-w-xl">
                <h1 className="text-xl sm:text-3xl font-bold text-white tracking-tight">
                  Motion graphics &amp; AI trailers, keyframed smoothly
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Open a recent project, generate multi-beat AI motion trailers, or learn bezier keyframes &amp; masking hands-on.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={onCreateNewProject}
                  className="h-10 px-4 sm:px-5 rounded-xl bg-[#2BE0A5] hover:bg-[#23C790] text-[#0E131D] text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Blank Project</span>
                </button>
                <button
                  onClick={onOpenAITrailer}
                  className="h-10 px-4 rounded-xl bg-[#F2A833]/15 hover:bg-[#F2A833]/25 border border-[#F2A833]/40 text-[#F2A833] text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Clapperboard className="w-4 h-4" />
                  <span>AI Motion Trailer</span>
                </button>
                <button
                  onClick={onOpenAIGenerate}
                  className="h-10 px-4 rounded-xl bg-[#24293B] hover:bg-[#2E354D] border border-white/10 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#2BE0A5]" />
                  <span>AI Scene</span>
                </button>
                {onOpenAIScript && (
                  <button
                    onClick={onOpenAIScript}
                    className="h-10 px-4 rounded-xl bg-[#24293B] hover:bg-[#2E354D] border border-[#38B2CE]/35 text-[#7DD3FC] text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <TypeIcon className="w-4 h-4" />
                    <span>AI Script</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* AI Motion Trailers Templates & Generator */}
          {activeTab === 'home' && (
            <section className="space-y-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clapperboard className="w-4 h-4 text-[#F2A833]" />
                  <h2 className="text-base font-bold text-white">
                    AI Motion Trailers
                  </h2>
                </div>
                <button
                  onClick={onOpenAITrailer}
                  className="text-xs font-semibold text-[#F2A833] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Direct Custom AI Trailer</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {TRAILER_TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="bg-[#1A1E2B] border border-white/[0.08] hover:border-[#F2A833]/50 rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          style={{ color: tpl.accent }}
                          className="text-[11px] font-mono-tabular font-bold"
                        >
                          {tpl.tag}
                        </span>
                        <span className="text-[10px] font-mono-tabular text-slate-400">
                          {tpl.aspectRatio}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white">
                        {tpl.title}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>

                    <button
                      onClick={() => onOpenTrailerTemplate(tpl.id)}
                      className="h-8 px-3 rounded-lg bg-[#24293B] hover:bg-[#F2A833] text-slate-100 hover:text-[#0E131D] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Open Trailer</span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Previous / Recent Projects Section */}
          {(activeTab === 'home' || activeTab === 'projects') && (
            <section className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Recent Projects ({savedProjects.length})
                </h2>
                {activeTab === 'home' && savedProjects.length > 3 && (
                  <button
                    onClick={() => setActiveTab('projects')}
                    className="text-xs font-semibold text-[#2BE0A5] hover:underline cursor-pointer"
                  >
                    View all
                  </button>
                )}
              </div>

              {savedProjects.length === 0 ? (
                <div className="bg-[#1A1E2B] border border-white/[0.08] rounded-xl p-8 text-center space-y-3">
                  <p className="text-sm text-slate-300">No saved projects yet.</p>
                  <button
                    onClick={onCreateNewProject}
                    className="px-4 py-2 rounded-lg bg-[#2BE0A5] text-[#0E131D] text-xs font-bold cursor-pointer"
                  >
                    Create First Project
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedProjects.map((rec) => {
                    const updatedStr = new Date(rec.updatedAt).toLocaleDateString(
                      undefined,
                      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                    );
                    return (
                      <div
                        key={rec.id}
                        className="bg-[#1A1E2B] border border-white/[0.08] hover:border-[#2BE0A5]/50 rounded-xl overflow-hidden flex flex-col transition-colors group"
                      >
                        {/* Stage Thumbnail Preview */}
                        <div
                          onClick={() => onOpenProject(rec)}
                          className="h-36 bg-[#12151E] relative flex items-center justify-center cursor-pointer border-b border-white/[0.06]"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-[#2BE0A5]/15 border border-[#2BE0A5]/40 flex items-center justify-center text-[#2BE0A5] group-hover:scale-110 transition-transform">
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </div>
                            <span className="text-xs font-mono-tabular text-slate-400">
                              {rec.project.aspectRatio} · {rec.project.fps}fps · {rec.project.duration}s
                            </span>
                          </div>
                        </div>

                        {/* Metadata & Actions */}
                        <div className="p-3.5 flex items-center justify-between gap-2">
                          <div
                            onClick={() => onOpenProject(rec)}
                            className="min-w-0 cursor-pointer"
                          >
                            <div className="text-sm font-semibold text-white truncate">
                              {rec.project.name}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {rec.layers.length} layers · {updatedStr}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateProject(rec);
                              }}
                              title="Duplicate Project"
                              className="w-9 h-9 rounded-lg hover:bg-white/[0.07] flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onDeleteProject(rec.id);
                              }}
                              title="Delete Project"
                              className="w-9 h-9 rounded-lg hover:bg-rose-500/20 flex items-center justify-center text-rose-400 hover:text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Tutorials & Interactive Guides Section */}
          {(activeTab === 'home' || activeTab === 'tutorials') && (
            <section className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Interactive Motion Tutorials
                </h2>
                <span className="text-xs text-slate-400">
                  Learn keyframes, masks, and easing curves hands-on
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TUTORIALS.map((tut) => {
                  const isExpanded = expandedTutorial === tut.id;
                  return (
                    <div
                      key={tut.id}
                      className="bg-[#1A1E2B] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() =>
                              setExpandedTutorial(isExpanded ? null : tut.id)
                            }
                            className="text-left cursor-pointer"
                          >
                            <h3 className="text-sm font-bold text-white hover:text-[#2BE0A5] transition-colors">
                              {tut.index} {tut.title}
                            </h3>
                          </button>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                            {tut.duration}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {tut.summary}
                        </p>

                        {isExpanded && (
                          <ol className="pt-2 space-y-1.5 border-t border-white/[0.06] text-xs text-slate-300 list-decimal list-inside">
                            {tut.steps.map((st, idx) => (
                              <li key={idx}>{st}</li>
                            ))}
                          </ol>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() =>
                            setExpandedTutorial(isExpanded ? null : tut.id)
                          }
                          className="text-xs text-slate-400 hover:text-white cursor-pointer"
                        >
                          {isExpanded ? 'Hide steps' : 'Show steps'}
                        </button>

                        <button
                          onClick={() => onLaunchTutorial(tut.id)}
                          className="h-8 px-3.5 rounded-lg bg-[#24293B] hover:bg-[#2BE0A5] text-slate-100 hover:text-[#0E131D] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Try in Studio</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Bottom Alight-Style Dock with Centered Mint + Button */}
      <footer className="h-14 bg-[#161925] border-t border-white/[0.08] px-4 flex items-center justify-around relative shrink-0">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            activeTab === 'home' ? 'text-[#2BE0A5]' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveTab('tutorials')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            activeTab === 'tutorials'
              ? 'text-[#2BE0A5]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Tutorials</span>
        </button>

        {/* Center Floating Mint + Button */}
        <button
          onClick={onCreateNewProject}
          title="Create New Project"
          className="w-12 h-12 -mt-6 rounded-full bg-[#2BE0A5] hover:bg-[#23C790] text-[#0E131D] shadow-[0_6px_22px_rgba(43,224,165,0.45)] flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
        >
          <Plus className="w-6 h-6 stroke-[2.75]" />
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            activeTab === 'projects'
              ? 'text-[#2BE0A5]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Projects</span>
        </button>

        <button
          onClick={onOpenAIGenerate}
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-slate-400 hover:text-[#2BE0A5] cursor-pointer"
        >
          <Layers className="w-4 h-4" />
          <span>AI Motion</span>
        </button>
      </footer>
    </div>
  );
};
