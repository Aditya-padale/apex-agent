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
} from 'lucide-react';

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
}) {
  const inputRef = useRef(null);
  const [importMessage, setImportMessage] = useState('');
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');

  const isRunning = status === 'running';
  const fileCount = Object.keys(workspaceFiles).length;

  const handleFolderInput = async (event) => {
    const sourceFiles = normaliseImportedFiles(event.target.files);
    event.target.value = '';
    if (!sourceFiles.length) {
      setImportMessage('No supported text files were found. Generated folders and files over 1 MB are skipped.');
      return;
    }

    try {
      const entries = await Promise.all(sourceFiles.map(async ({ file, path }) => [path, await file.text()]));
      onImportFiles(Object.fromEntries(entries));
      setImportMessage(`${entries.length} text files imported. Dependencies, generated output, binary files, and local secret files were skipped.`);
    } catch (error) {
      setImportMessage(`Could not read the selected project: ${error.message}`);
    }
  };

  const handleAddFile = () => {
    const path = newFilePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path || path.split('/').includes('..')) {
      setImportMessage('Enter a relative file path such as src/App.jsx or test_app.py.');
      return;
    }
    onAddFile(path, newFileContent);
    setNewFilePath('');
    setNewFileContent('');
    setImportMessage(`Added ${path}. You can edit it in the workspace panel.`);
  };

  return (
    <div className="glass-panel p-5 flex flex-col h-full gap-4 overflow-y-auto">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Upload className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">My project</h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Import a trusted project folder or add files manually. The agent receives exactly these files in a temporary workspace.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300">Project name</label>
        <input
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          disabled={isRunning}
          maxLength={120}
          placeholder="My React app"
          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        />
      </div>

      <div className="rounded-xl border border-dashed border-indigo-500/40 bg-indigo-950/20 p-3.5 space-y-2">
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
          className="w-full py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <FolderOpen className="w-4 h-4" />
          Import project folder
        </button>
        <p className="text-[10px] text-slate-400 text-center">Up to 300 text files, 1 MB each. Dependencies are not imported.</p>
      </div>

      <div className="space-y-2 border-t border-slate-800 pt-3">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <FilePlus2 className="w-3.5 h-3.5 text-emerald-400" />
          Add or replace a file
        </label>
        <input
          value={newFilePath}
          onChange={(event) => setNewFilePath(event.target.value)}
          disabled={isRunning}
          placeholder="src/App.jsx"
          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <textarea
          rows={3}
          value={newFileContent}
          onChange={(event) => setNewFileContent(event.target.value)}
          disabled={isRunning}
          placeholder="Paste file contents here…"
          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 resize-y disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleAddFile}
          disabled={isRunning}
          className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 disabled:opacity-50"
        >
          Save file to workspace
        </button>
      </div>

      <div className="space-y-2 border-t border-slate-800 pt-3">
        <label className="text-xs font-medium text-slate-300">What should the agent do?</label>
        <textarea
          rows={4}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          disabled={isRunning}
          placeholder="Example: Test the login UI. An empty email must show an error and must not submit the form. Fix any failing test."
          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300">Validation command</label>
        <input
          value={validationCommand}
          onChange={(event) => setValidationCommand(event.target.value)}
          disabled={isRunning}
          placeholder="npm run test:e2e  •  python -m pytest -q  •  go test ./..."
          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <label className="text-xs font-medium text-slate-300">Optional setup command</label>
        <input
          value={setupCommand}
          onChange={(event) => setSetupCommand(event.target.value)}
          disabled={isRunning}
          placeholder="npm ci"
          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <p className="text-[10px] leading-relaxed text-slate-500">Commands run without a shell. Use one project command; pipelines and chained commands are not supported.</p>
      </div>

      {importMessage && (
        <div className="text-[11px] leading-relaxed text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>{importMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
        <span>{fileCount} workspace file{fileCount === 1 ? '' : 's'}</span>
        <button
          type="button"
          onClick={onClearWorkspace}
          disabled={isRunning || fileCount === 0}
          className="flex items-center gap-1 text-rose-300 hover:text-rose-200 disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 flex gap-2 text-[10px] leading-relaxed text-amber-100/80">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
        <span>Only import projects you trust. Build and test scripts execute project code on this machine.</span>
      </div>

      {isRunning ? (
        <button
          onClick={onCancelAgent}
          className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center justify-center gap-2"
        >
          <Square className="w-4 h-4 fill-current" /> Halt agent execution
        </button>
      ) : (
        <button
          onClick={onRunAgent}
          disabled={!fileCount || !goal.trim()}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4 fill-current" /> Run my workspace
        </button>
      )}
    </div>
  );
}
