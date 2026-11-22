import React, { useEffect, useState, useRef } from 'react';
import {
  FileCode,
  Play,
  Terminal,
  AlertCircle,
  RefreshCw,
  PencilLine,
  Copy,
  Check,
  Code2,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { runSandboxTest } from '../api';

function getFileIcon(fileName = '') {
  if (fileName.endsWith('.py')) return <span className="text-yellow-400 font-mono text-[10px] font-bold">PY</span>;
  if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return <span className="text-cyan-400 font-mono text-[10px] font-bold">JS</span>;
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return <span className="text-blue-400 font-mono text-[10px] font-bold">TS</span>;
  if (fileName.endsWith('.json')) return <span className="text-amber-400 font-mono text-[10px] font-bold">JSON</span>;
  if (fileName.endsWith('.md')) return <span className="text-purple-400 font-mono text-[10px] font-bold">MD</span>;
  return <FileCode className="w-3.5 h-3.5 text-slate-400" />;
}

export default function WorkspaceViewer({
  workspaceFiles,
  onFileChange,
  isEditable = false,
  validationCommand = '',
  setupCommand = '',
}) {
  const fileNames = Object.keys(workspaceFiles).sort();
  const [activeFile, setActiveFile] = useState(fileNames[0] || '');
  const [sandboxResult, setSandboxResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConsole, setShowConsole] = useState(true);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!fileNames.includes(activeFile)) {
      setActiveFile(fileNames[0] || '');
    }
  }, [workspaceFiles, activeFile, fileNames]);

  const currentContent = workspaceFiles[activeFile] ?? workspaceFiles[fileNames[0]] ?? '';
  const displayFileName = Object.prototype.hasOwnProperty.call(workspaceFiles, activeFile)
    ? activeFile
    : fileNames[0] || '';
  const canRun = isEditable ? Boolean(validationCommand.trim() && fileNames.length) : Boolean(displayFileName);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRunManualTest = async () => {
    if (!canRun) return;
    setTesting(true);
    setSandboxResult(null);
    setShowConsole(true);
    try {
      const res = isEditable
        ? await runSandboxTest({
          workspaceFiles,
          command: validationCommand.trim(),
          setupCommand: setupCommand.trim() || undefined,
        })
        : await runSandboxTest({ code: currentContent, scriptName: displayFileName });
      setSandboxResult(res.sandbox_result);
    } catch (err) {
      setSandboxResult({ error: err.message, exit_code: 1 });
    } finally {
      setTesting(false);
    }
  };

  const lines = currentContent.split('\n');

  return (
    <div className="glass-panel p-4 flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">Sandbox Workspace</h2>
              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                isEditable ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isEditable ? 'Live Editable' : 'Benchmark Read-only'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">{fileNames.length} file{fileNames.length === 1 ? '' : 's'} loaded</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {displayFileName && (
            <button
              onClick={handleCopyCode}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
              title="Copy current file code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={handleRunManualTest}
            disabled={testing || !canRun}
            title={isEditable && !validationCommand.trim() ? 'Add a validation command first' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{testing ? 'Executing…' : isEditable ? 'Run Validation' : 'Run File'}</span>
          </button>
        </div>
      </div>

      {/* File Tabs */}
      <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-1 scrollbar-none">
        {fileNames.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-1">No files in workspace</div>
        ) : (
          fileNames.map((fileName) => {
            const isActive = fileName === displayFileName;
            return (
              <button
                key={fileName}
                onClick={() => setActiveFile(fileName)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 border whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-950/70 border-indigo-500/60 text-indigo-200 font-semibold shadow-sm shadow-indigo-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                {getFileIcon(fileName)}
                <span>{fileName}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Code Editor & Viewer */}
      <div className="flex-1 bg-slate-950 border border-slate-850 rounded-xl overflow-hidden flex flex-col font-mono text-xs min-h-0 shadow-inner">
        {/* File info banner */}
        <div className="bg-slate-900/90 px-3.5 py-1.5 border-b border-slate-850 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-slate-300 truncate">{displayFileName || 'No file selected'}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-[10px] text-slate-500">
            {isEditable && (
              <span className="flex items-center gap-1 text-cyan-400">
                <PencilLine className="w-3 h-3" /> Auto-saved
              </span>
            )}
            <span>{lines.length} lines</span>
          </div>
        </div>

        {/* Content area */}
        {isEditable && displayFileName ? (
          <div className="flex-1 flex overflow-hidden min-h-0 relative">
            <div className="select-none py-3 pl-3 pr-2 bg-slate-950 text-slate-600 font-mono text-[11px] text-right border-r border-slate-900 overflow-hidden shrink-0">
              {lines.map((_, i) => (
                <div key={i} className="leading-relaxed">{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={currentContent}
              onChange={(event) => onFileChange?.(displayFileName, event.target.value)}
              spellCheck="false"
              className="flex-1 w-full min-h-0 resize-none bg-slate-950 p-3 leading-relaxed text-slate-200 text-[11px] font-mono focus:outline-none focus:ring-0 selection:bg-indigo-500/30 overflow-auto"
              aria-label={`Edit ${displayFileName}`}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-3 leading-relaxed text-slate-200 selection:bg-indigo-500/30">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="hover:bg-slate-900/40">
                    <td className="w-8 select-none text-right pr-3 text-slate-600 font-mono text-[11px]">{index + 1}</td>
                    <td className="whitespace-pre font-mono text-[11px] text-slate-200">{line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Terminal Sandbox Result Drawer */}
      {sandboxResult && (
        <div className="mt-2.5 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div
            onClick={() => setShowConsole(!showConsole)}
            className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-850 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-semibold text-slate-200">Validation Console Output</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                sandboxResult.exit_code === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}>
                {sandboxResult.exit_code === 0 ? 'PASS (Exit 0)' : `FAIL (Exit ${sandboxResult.exit_code ?? 1})`}
              </span>
              {showConsole ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </div>

          {showConsole && (
            <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto text-[11px] font-mono">
              {sandboxResult.command && (
                <div className="text-[10px] font-mono text-cyan-300/80 bg-slate-900/80 p-1.5 rounded border border-slate-800 break-all">
                  $ {sandboxResult.command}
                </div>
              )}
              {sandboxResult.stdout && (
                <pre className="text-emerald-300 whitespace-pre-wrap">{sandboxResult.stdout}</pre>
              )}
              {sandboxResult.stderr && (
                <pre className="text-rose-300 whitespace-pre-wrap">{sandboxResult.stderr}</pre>
              )}
              {sandboxResult.error && (
                <div className="text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{sandboxResult.error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
