import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  FilePlus2,
  FolderOpen,
  Play,
  ShieldAlert,
  Square,
  Trash2,
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
      setImportMessage('No supported text files found. Dependencies and files over 1 MB are skipped.');
      return;
    }

    try {
      const entries = await Promise.all(sourceFiles.map(async ({ file, path }) => [path, await file.text()]));
      onImportFiles(Object.fromEntries(entries));
      setImportMessage(`${entries.length} files imported into workspace.`);
    } catch (error) {
      setImportMessage(`Could not read project files: ${error.message}`);
    }
  };

  const handleAddFile = () => {
    const path = newFilePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path || path.split('/').includes('..')) {
      setImportMessage('Please enter a valid relative path such as src/index.js.');
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
    <div className="neo-panel bg-white p-4 flex flex-col h-full gap-3 overflow-y-auto">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-black stroke-[2.5]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-black">MY PROJECT SETUP</h2>
          </div>
          <span className="neo-badge-sm bg-[#FFE600] text-black px-2 py-0.5 rounded text-[10px] font-mono">
            {fileCount} {fileCount === 1 ? 'FILE' : 'FILES'}
          </span>
        </div>
        <p className="text-[11px] text-slate-600 font-semibold">
          Set up project files & validation command for the ReAct sandbox.
        </p>
      </div>

      {/* Quick Starters Presets */}
      <div className="bg-[#F8FAFC] border-2 border-black shadow-[2px_2px_0px_0px_#000] rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-black uppercase text-black tracking-wider">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#d97706] stroke-[2.5]" /> QUICK STARTERS
          </span>
          <span className="text-slate-500 font-mono font-bold">CLICK TO LOAD</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {WORKSPACE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              disabled={isRunning}
              className="text-left p-1.5 rounded bg-white hover:bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all text-xs group disabled:opacity-50"
            >
              <div className="font-black text-black text-[11px] truncate">
                {preset.label}
              </div>
              <div className="text-[9px] text-slate-500 group-hover:text-black line-clamp-1 font-mono font-medium">
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Project Name */}
      <div className="space-y-1">
        <label className="text-[11px] font-black text-black uppercase flex items-center gap-1.5">
          <FileText className="w-3 h-3 text-[#0284c7] stroke-[2.5]" />
          PROJECT NAME
        </label>
        <input
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          disabled={isRunning}
          maxLength={120}
          placeholder="e.g. Authentication Service"
          className="w-full neo-input rounded-md px-2.5 py-1.5 text-xs font-mono font-bold disabled:opacity-50"
        />
      </div>

      {/* Folder Import Dropzone */}
      <div
        className={`rounded-lg border-2 border-dashed transition-all p-3 space-y-2 text-center shadow-[3px_3px_0px_0px_#000] ${
          isDragOver
            ? 'border-black bg-[#FEF08A]'
            : 'border-black bg-[#FEFCE8] hover:bg-[#FEF08A]'
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
          className="neo-btn bg-[#FFE600] text-black w-full py-2 rounded-md font-black uppercase text-xs flex items-center justify-center gap-2"
        >
          <FolderOpen className="w-3.5 h-3.5 stroke-[2.5]" />
          IMPORT PROJECT FOLDER
        </button>
        <p className="text-[10px] text-slate-700 font-mono font-bold">
          Drag & drop folder • Skips node_modules & .git
        </p>
      </div>

      {/* Add / Replace File Drawer */}
      <div className="border-2 border-black rounded-lg overflow-hidden bg-[#F8FAFC] shadow-[2px_2px_0px_0px_#000]">
        <button
          type="button"
          onClick={() => setShowAddFile(!showAddFile)}
          className="w-full px-2.5 py-1.5 flex items-center justify-between text-xs font-black text-black hover:bg-slate-200 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <FilePlus2 className="w-3.5 h-3.5 text-[#16a34a] stroke-[2.5]" />
            ADD / EDIT FILE MANUALLY
          </span>
          {showAddFile ? <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" /> : <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />}
        </button>

        {showAddFile && (
          <div className="p-2.5 border-t-2 border-black space-y-2 bg-white">
            <input
              value={newFilePath}
              onChange={(event) => setNewFilePath(event.target.value)}
              disabled={isRunning}
              placeholder="e.g. src/auth.py"
              className="w-full neo-input rounded-md px-2 py-1 text-xs font-mono font-bold"
            />
            <textarea
              rows={3}
              value={newFileContent}
              onChange={(event) => setNewFileContent(event.target.value)}
              disabled={isRunning}
              placeholder="File code contents..."
              className="w-full neo-input rounded-md p-2 text-xs font-mono resize-y"
            />
            <button
              type="button"
              onClick={handleAddFile}
              disabled={isRunning || !newFilePath.trim()}
              className="neo-btn bg-[#A3E635] text-black w-full py-1.5 rounded-md font-black uppercase text-xs flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" /> SAVE TO WORKSPACE
            </button>
          </div>
        )}
      </div>

      {/* Goal / Objective */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-black text-black uppercase">GOAL / INSTRUCTIONS</label>
          <span className="text-[10px] font-mono text-slate-500 font-bold">{goal.length} chars</span>
        </div>
        <textarea
          rows={3}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          disabled={isRunning}
          placeholder="Describe what the agent should accomplish (e.g. Fix failing tests, implement the missing method)..."
          className="w-full neo-input rounded-md p-2 text-xs text-black placeholder-slate-400 font-medium resize-none"
        />
      </div>

      {/* Validation & Setup Commands */}
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-black uppercase flex items-center gap-1">
              <Terminal className="w-3 h-3 text-[#0284c7] stroke-[2.5]" /> VALIDATION COMMAND
            </label>
            <div className="flex gap-1 text-[9px] font-mono font-bold">
              <button
                type="button"
                onClick={() => setValidationCommand('python -m pytest -q')}
                className="neo-btn bg-white hover:bg-[#38BDF8] text-black px-1.5 py-0.5 rounded text-[9px]"
              >
                pytest
              </button>
              <button
                type="button"
                onClick={() => setValidationCommand('npm test')}
                className="neo-btn bg-white hover:bg-[#38BDF8] text-black px-1.5 py-0.5 rounded text-[9px]"
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
            className="w-full neo-input rounded-md px-2.5 py-1.5 text-xs font-mono font-bold"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-700 uppercase">OPTIONAL SETUP COMMAND</label>
          <input
            value={setupCommand}
            onChange={(event) => setSetupCommand(event.target.value)}
            disabled={isRunning}
            placeholder="e.g. pip install -r requirements.txt"
            className="w-full neo-input rounded-md px-2.5 py-1.5 text-xs font-mono font-bold"
          />
        </div>
      </div>

      {/* Import / Message Feedback */}
      {importMessage && (
        <div className="neo-badge bg-[#FFE600] text-black rounded-md p-2 text-[11px] font-black flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 stroke-[2.5]" />
          <span>{importMessage}</span>
        </div>
      )}

      {/* Workspace Files Count & Clear */}
      <div className="flex items-center justify-between text-[11px] border-t-2 border-black pt-2">
        <span className="font-mono font-black text-black">
          {fileCount} {fileCount === 1 ? 'FILE' : 'FILES'} IN WORKSPACE
        </span>
        <button
          type="button"
          onClick={onClearWorkspace}
          disabled={isRunning || fileCount === 0}
          className="neo-btn bg-[#FF3366] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 disabled:opacity-40"
        >
          <Trash2 className="w-3 h-3 stroke-[2.5]" /> CLEAR ALL
        </button>
      </div>

      {/* Sandbox Advisory Banner */}
      <div className="neo-card bg-[#FEF08A] p-2 flex gap-2 text-[10px] font-mono font-bold text-black border-2 border-black shadow-[2px_2px_0_0_#000]">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-black stroke-[2.5] mt-0.5" />
        <span>
          {customExecutionDisabled
            ? 'Custom workspace execution is disabled. Built-in benchmarks remain available.'
            : 'Sandbox limits: Subprocesses execute in isolated POSIX resource limits.'}
        </span>
      </div>

      {/* Action CTA Button */}
      <div className="pt-1">
        {isRunning ? (
          <button
            onClick={onCancelAgent}
            className="neo-btn bg-[#FF3366] text-white w-full py-2.5 rounded-lg font-black uppercase text-xs flex items-center justify-center gap-2"
          >
            <Square className="w-3.5 h-3.5 fill-white" /> HALT AGENT EXECUTION
          </button>
        ) : (
          <button
            onClick={onRunAgent}
            disabled={!fileCount || !goal.trim() || customExecutionDisabled}
            className="neo-btn bg-[#A3E635] text-black hover:bg-[#86efac] w-full py-2.5 rounded-lg font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-black" /> RUN MY WORKSPACE
          </button>
        )}
      </div>
    </div>
  );
}
