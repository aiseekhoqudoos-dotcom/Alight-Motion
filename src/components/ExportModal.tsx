import React, { useState } from 'react';
import { Download, FileCode2, FileJson, Film, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { Layer, ProjectConfig } from '../types/editor';
import { renderProjectFrame } from '../engine/compositor';
import { serializeProjectToXML } from '../engine/xmlEngine';

interface ExportModalProps {
  open: boolean;
  project: ProjectConfig;
  layers: Layer[];
  currentTime: number;
  onClose: () => void;
  onImportProjectJSON: (data: { project: ProjectConfig; layers: Layer[] }) => void;
  onImportXMLFile: (file: File) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  project,
  layers,
  currentTime,
  onClose,
  onImportProjectJSON,
  onImportXMLFile,
}) => {
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleExportVideo = async () => {
    setRendering(true);
    setProgress(0);
    setStatusMsg('Initializing WebM encoder...');

    try {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = project.width;
      offCanvas.height = project.height;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');

      const fps = project.fps || 30;
      const stream = offCanvas.captureStream(fps);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const finished = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }));
        };
      });

      recorder.start();
      setStatusMsg('Rendering motion frames...');

      const totalFrames = Math.ceil(project.duration * fps);
      const frameIntervalMs = 1000 / fps;

      for (let f = 0; f <= totalFrames; f++) {
        const t = (f / totalFrames) * project.duration;
        renderProjectFrame(ctx, project, layers, t, {
          selectedLayerIds: [],
          showGizmos: false,
          showGrid: false,
        });
        setProgress(Math.round((f / totalFrames) * 100));
        await new Promise((r) => setTimeout(r, Math.min(frameIntervalMs, 24)));
      }

      recorder.stop();
      const blob = await finished;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_').toLowerCase()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg('Video exported successfully.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setRendering(false);
    }
  };

  const handleExportPNG = () => {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = project.width;
    offCanvas.height = project.height;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    renderProjectFrame(ctx, project, layers, currentTime, {
      selectedLayerIds: [],
      showGizmos: false,
      showGrid: false,
    });

    const url = offCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_').toLowerCase()}_frame.png`;
    a.click();
  };

  const handleExportJSON = () => {
    const payload = JSON.stringify({ project, layers }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_').toLowerCase()}.kinetix.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXML = () => {
    const xml = serializeProjectToXML(project, layers);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_').toLowerCase()}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('XML project file exported.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#1E2231] border border-white/10 rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Export Composition</h2>
            <p className="text-[11px] text-slate-400 font-mono-tabular">
              {project.width}×{project.height} · {project.fps}fps · {project.duration}s
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <button
            onClick={handleExportVideo}
            disabled={rendering}
            className="w-full p-3.5 rounded-xl bg-[#2BE0A5] hover:bg-[#23C790] disabled:opacity-60 text-[#0E131D] flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3 text-left">
              {rendering ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Film className="w-5 h-5" />
              )}
              <div>
                <div className="text-xs font-bold">
                  {rendering ? `Rendering Video (${progress}%)` : 'Export Video (WebM)'}
                </div>
                <div className="text-[11px] opacity-80">
                  Full-resolution canvas animation capture
                </div>
              </div>
            </div>
            <Download className="w-4 h-4" />
          </button>

          {rendering && (
            <div className="w-full h-2 bg-[#141722] rounded-full overflow-hidden">
              <div
                style={{ width: `${progress}%` }}
                className="h-full bg-[#2BE0A5] transition-all duration-150"
              />
            </div>
          )}

          {statusMsg && (
            <div className="text-xs text-slate-300 px-1">{statusMsg}</div>
          )}

          <button
            onClick={handleExportPNG}
            className="w-full p-3 rounded-xl bg-[#252A3C] hover:bg-[#2F364D] border border-white/[0.07] text-white flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3 text-left">
              <ImageIcon className="w-4 h-4 text-[#38B2CE]" />
              <div>
                <div className="text-xs font-semibold">Current Frame (PNG)</div>
                <div className="text-[11px] text-slate-400">
                  High-resolution still at playhead
                </div>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400" />
          </button>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1">
            <button
              onClick={handleExportJSON}
              className="px-1.5 py-2.5 sm:p-2.5 rounded-xl bg-[#252A3C] hover:bg-[#2F364D] border border-white/[0.07] text-[11px] sm:text-xs font-medium text-slate-200 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F2A833] shrink-0" />
              <span>Save JSON</span>
            </button>

            <button
              onClick={handleExportXML}
              className="px-1.5 py-2.5 sm:p-2.5 rounded-xl bg-[#252A3C] hover:bg-[#2F364D] border border-white/[0.07] text-[11px] sm:text-xs font-medium text-slate-200 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#38B2CE] shrink-0" />
              <span>Export XML</span>
            </button>

            <label className="px-1.5 py-2.5 sm:p-2.5 rounded-xl bg-[#252A3C] hover:bg-[#2F364D] border border-white/[0.07] text-[11px] sm:text-xs font-medium text-slate-200 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer">
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2BE0A5] shrink-0" />
              <span>Import</span>
              <input
                type="file"
                accept=".json,.xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.name.toLowerCase().endsWith('.xml')) {
                    onImportXMLFile(file);
                    onClose();
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const parsed = JSON.parse(String(reader.result));
                      if (parsed.project && Array.isArray(parsed.layers)) {
                        onImportProjectJSON(parsed);
                        onClose();
                      }
                    } catch {
                      setStatusMsg('Invalid project JSON or XML file.');
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
