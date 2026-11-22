import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  FilePlus2,
  FolderOpen,
  Play,
  ShieldAlert,
  Square,
  Trash2,
  Upload,
  Sparkles,
  Terminal,
  FolderGit2,
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { WORKSPACE_PRESETS } from '../presets';

const IGNORED_DIRECTORIES = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', 'coverage',
  '__pycache__', '.venv', 'venv', 'target', '.turbo', '.cache',
]);
const BINARY_EXTENSIONS = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|mp4|mov|woff2?|ttf|eot)$/i;
const SENSITIVE_FILE = /(^|\/)\.env(?:\.|$)|\.(pem|key|p12|pfx)$/i;
const MAX_IMPORT_FILES = 300;
const MAX_IMPORT_FILE_BYTES = 1_000_000;

function normaliseImportedFiles(fileList) {
  const candidates = Array.from(fileList)
    .map((file) => ({ file, path: (file.webkitRelativePath || file.name).replace(/\\/g, '/') }))
    .filter(({ path, file }) => {
      const directories = path.split('/').slice(0, -1);
      return !directories.some((directory) => IGNORED_DIRECTORIES.has(directory))
        && !BINARY_EXTENSIONS.test(path)
        && !SENSITIVE_FILE.test(path)
        && file.size <= MAX_IMPORT_FILE_BYTES;
    })
    .slice(0, MAX_IMPORT_FILES);

  const topLevelNames = new Set(candidates.map(({ path }) => path.split('/')[0]));
  const shouldStripProjectRoot = topLevelNames.size === 1 && candidates.every(({ path }) => path.includes('/'));

  return candidates.map(({ file, path }) => ({
    file,
    path: shouldStripProjectRoot ? path.split('/').slice(1).join('/') : path,
  }));
}

export default function ProjectSetupPanel({
  workspaceFiles,
  projectName,
  setProjectName,
  goal,
  setGoal,
  validationCommand,
  setValidationCommand,
  setupCommand,
  setSetupCommand,
  onImportFiles,
  onAddFile,
  onClearWorkspace,
  onRunAgent,
  onCancelAgent,
  status,
  codeExecutionEnabled,
}) {
  const inputRef = useRef(null);
  const [importMessage, setImportMessage] = useState('');
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [showAddFile, setShowAddFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const isRunning = status === 'running';
  const customExecutionDisabled = codeExecutionEnabled === false;
  const fileKeys = Object.keys(workspaceFiles);
  const fileCount = fileKeys.length;

  const handleFolderInput = async (event) => {
    const sourceFiles = normaliseImportedFiles(event.target.files);
    event.target.value = '';
    if (!sourceFiles.length) {
      setImportMessage('No supported text files were found. Dependencies and files over 1 MB are skipped.');
      return;
    }

    try {
      const entries = await Promise.all(sourceFiles.map(async ({ file, path }) => [path, await file.text()]));
      onImportFiles(Object.fromEntries(entries));
      setImportMessage(`${entries.length} text files imported. Dependencies, build artifacts, and secret files were excluded.`);
    } catch (error) {
      setImportMessage(`Could not read project files: ${error.message}`);
    }
  };

  const handleAddFile = () => {
    const path = newFilePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path || path.split('/').includes('..')) {
      setImportMessage('Please enter a valid relative path such as src/index.js or test_ops.py.');
      return;
    }
    onAddFile(path, newFileContent);
    setNewFilePath('');
    setNewFileContent('');
    setShowAddFile(false);
    setImportMessage(`Added ${path} to workspace.`);
  };

  const applyPreset = (preset) => {
    if (isRunning) return;
    setProjectName(preset.projectName);
    setGoal(preset.goal);
    setValidationCommand(preset.validationCommand);
    setSetupCommand(preset.setupCommand);
    onImportFiles(preset.files);
    setImportMessage(`Loaded "${preset.label}" starter workspace.`);
  };

  return (
    <div className="glass-panel p-4 flex flex-col h-full gap-3.5 overflow-y-auto">
      {/* Header & Description */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">My Project Setup</h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Provide your project files and a validation command. ApexAgent will run in an isolated sandbox to inspect, modify, and test your code.
        </p>
      </div>

      {/* Quick Starters Presets */}
      <div className="space-y-1.5 bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" /> Quick Starters
          </span>
          <span className="text-slate-500">Click to load</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {WORKSPACE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              disabled={isRunning}
              className="text-left p-1.5 rounded-lg bg-slate-950/70 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 transition-all text-xs group disabled:opacity-50"
            >
              <div className="font-medium text-slate-200 group-hover:text-indigo-300 transition-colors text-[11px] truncate">
                {preset.label}
              </div>
              <div className="text-[9px] text-slate-500 line-clamp-1">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Project Name */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
          <FileText className="w-3 h-3 text-slate-400" />
          Project Name
        </label>
        <input
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          disabled={isRunning}
          maxLength={120}
          placeholder="e.g. Authentication Service"
          className="w-full bg-slate-900/90 border border-slate-800/90 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50 transition-colors"
        />
      </div>

      {/* Folder Import Dropzone */}
      <div
        className={`rounded-xl border border-dashed transition-all p-3 space-y-2 text-center ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-950/20'
            : 'border-indigo-500/30 bg-indigo-950/10 hover:border-indigo-500/50 hover:bg-indigo-950/20'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer?.files) {
            handleFolderInput({ target: { files: e.dataTransfer.files, value: '' } });
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={handleFolderInput}
          disabled={isRunning}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isRunning}
          className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-600/90 to-cyan-600/90 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Import Project Folder
        </button>
        <p className="text-[10px] text-slate-400">
          Drop files or select folder • Skips node_modules, .git, venv
        </p>
      </div>

      {/* Add File Toggle & Drawer */}
      <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/40">
        <button
          type="button"
          onClick={() => setShowAddFile(!showAddFile)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs text-slate-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <FilePlus2 className="w-3.5 h-3.5 text-emerald-400" />
            Add / Replace File Manually
          </span>
          {showAddFile ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {showAddFile && (
          <div className="p-3 border-t border-slate-800/80 space-y-2 bg-slate-950/50">
            <input
              value={newFilePath}
              onChange={(event) => setNewFilePath(event.target.value)}
              disabled={isRunning}
              placeholder="e.g. src/auth.py or tests/test_auth.py"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <textarea
              rows={3}
              value={newFileContent}
              onChange={(event) => setNewFileContent(event.target.value)}
              disabled={isRunning}
              placeholder="File code contents..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-y disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleAddFile}
              disabled={isRunning || !newFilePath.trim()}
              className="w-full py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Save File to Workspace
            </button>
          </div>
        )}
      </div>

      {/* Goal / Objective */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-slate-300">Goal / Instructions</label>
          <span className="text-[10px] text-slate-500">{goal.length} chars</span>
        </div>
        <textarea
          rows={3}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          disabled={isRunning}
          placeholder="Describe what the agent should accomplish (e.g. Fix failing tests, implement the missing method, ensure all validations pass)..."
          className="w-full bg-slate-900/90 border border-slate-800/90 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 resize-none disabled:opacity-50 transition-colors"
        />
      </div>

      {/* Validation & Setup Commands */}
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
              <Terminal className="w-3 h-3 text-cyan-400" /> Validation Command
            </label>
            <div className="flex gap-1 text-[9px] font-mono">
              <button
                type="button"
                onClick={() => setValidationCommand('python -m pytest -q')}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
              >
                pytest
              </button>
              <button
                type="button"
                onClick={() => setValidationCommand('npm test')}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
              >
                npm test
              </button>
            </div>
          </div>
          <input
            value={validationCommand}
            onChange={(event) => setValidationCommand(event.target.value)}
            disabled={isRunning}
            placeholder="e.g. python -m pytest test_math_ops.py -q"
            className="w-full bg-slate-900/90 border border-slate-800/90 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400">Optional Setup Command</label>
          <input
            value={setupCommand}
            onChange={(event) => setSetupCommand(event.target.value)}
            disabled={isRunning}
            placeholder="e.g. pip install -r requirements.txt"
            className="w-full bg-slate-900/70 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Import / Status Feedback */}
      {importMessage && (
        <div className="text-[11px] leading-relaxed text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>{importMessage}</span>
        </div>
      )}

      {/* Files Summary & Clear */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
        <span className="font-mono text-slate-300">
          {fileCount} {fileCount === 1 ? 'file' : 'files'} in workspace
        </span>
        <button
          type="button"
          onClick={onClearWorkspace}
          disabled={isRunning || fileCount === 0}
          className="flex items-center gap-1 text-rose-400 hover:text-rose-300 text-[11px] font-medium disabled:opacity-40 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Clear All
        </button>
      </div>

      {/* Sandbox Advisory */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 flex gap-2 text-[10px] leading-relaxed text-amber-100/75">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
        <span>
          {customExecutionDisabled
            ? 'Custom workspace execution is currently disabled on this server. Demo benchmark scenarios are available.'
            : 'Sandbox limits: Subprocesses run in an isolated environment with POSIX limits.'}
        </span>
      </div>

      {/* CTA Button */}
      <div className="pt-1">
        {isRunning ? (
          <button
            onClick={onCancelAgent}
            className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/10"
          >
            <Square className="w-3.5 h-3.5 fill-current" /> Halt Agent Execution
          </button>
        ) : (
          <button
            onClick={onRunAgent}
            disabled={!fileCount || !goal.trim() || customExecutionDisabled}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Run My Workspace
          </button>
        )}
      </div>
    </div>
  );
}
