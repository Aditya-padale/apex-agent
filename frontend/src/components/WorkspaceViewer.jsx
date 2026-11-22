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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { runSandboxTest } from '../api';

function getFileIcon(fileName = '') {
  if (fileName.endsWith('.py')) return <span className="text-black bg-[#FFE600] px-1 rounded border border-black font-mono text-[9px] font-black">PY</span>;
  if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return <span className="text-black bg-[#38BDF8] px-1 rounded border border-black font-mono text-[9px] font-black">JS</span>;
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return <span className="text-black bg-[#A78BFA] px-1 rounded border border-black font-mono text-[9px] font-black">TS</span>;
  if (fileName.endsWith('.json')) return <span className="text-black bg-[#FB923C] px-1 rounded border border-black font-mono text-[9px] font-black">JSON</span>;
  if (fileName.endsWith('.md')) return <span className="text-white bg-[#FF3366] px-1 rounded border border-black font-mono text-[9px] font-black">MD</span>;
  return <FileCode className="w-3.5 h-3.5 text-black stroke-[2.5]" />;
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
    <div className="neo-panel bg-white p-4 flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b-2 border-black pb-2.5 mb-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-[#A3E635] border-2 border-black shadow-[2px_2px_0_0_#000] flex items-center justify-center">
            <Code2 className="w-4 h-4 text-black stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-black uppercase tracking-wider text-black">WORKSPACE VIEWER</h2>
              <span className={`neo-badge-sm px-1.5 py-0.2 rounded text-[9px] font-mono ${
                isEditable ? 'bg-[#FFE600] text-black' : 'bg-slate-200 text-black'
              }`}>
                {isEditable ? 'EDITABLE' : 'BENCHMARK'}
              </span>
            </div>
            <p className="text-[10px] text-slate-600 font-mono font-bold">{fileNames.length} FILE{fileNames.length === 1 ? '' : 'S'} LOADED</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {displayFileName && (
            <button
              onClick={handleCopyCode}
              className="neo-btn bg-white text-black p-1.5 rounded-md text-xs"
              title="Copy current file code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#16a34a] stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5 stroke-[2.5]" />}
            </button>
          )}

          <button
            onClick={handleRunManualTest}
            disabled={testing || !canRun}
            title={isEditable && !validationCommand.trim() ? 'Add a validation command first' : undefined}
            className="neo-btn bg-[#A3E635] hover:bg-[#86efac] text-black font-black uppercase text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 disabled:opacity-40"
          >
            {testing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-black" />
            )}
            <span>{testing ? 'RUNNING…' : isEditable ? 'RUN VALIDATION' : 'RUN FILE'}</span>
          </button>
        </div>
      </div>

      {/* File Tabs */}
      <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-1">
        {fileNames.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono italic py-1 font-bold">No files in workspace</div>
        ) : (
          fileNames.map((fileName) => {
            const isActive = fileName === displayFileName;
            return (
              <button
                key={fileName}
                onClick={() => setActiveFile(fileName)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all border-2 border-black whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#FFE600] text-black font-black shadow-[2px_2px_0_0_#000] -translate-x-0.5 -translate-y-0.5'
                    : 'bg-white text-slate-700 font-bold hover:bg-slate-100 shadow-[2px_2px_0_0_#000]'
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
      <div className="flex-1 bg-white border-2 border-black rounded-lg overflow-hidden flex flex-col font-mono text-xs min-h-0 shadow-[3px_3px_0_0_#000]">
        {/* File info banner */}
        <div className="bg-[#F8FAFC] px-3 py-1.5 border-b-2 border-black text-[11px] text-black flex items-center justify-between font-black">
          <div className="flex items-center gap-2 truncate">
            <span className="truncate">{displayFileName || 'NO FILE SELECTED'}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono">
            {isEditable && (
              <span className="flex items-center gap-1 text-[#0284c7] font-black">
                <PencilLine className="w-3 h-3 stroke-[2.5]" /> AUTO-SAVED
              </span>
            )}
            <span className="text-slate-600 font-black">{lines.length} LINES</span>
          </div>
        </div>

        {/* Content area */}
        {isEditable && displayFileName ? (
          <div className="flex-1 flex overflow-hidden min-h-0 relative">
            <div className="select-none py-3 pl-3 pr-2 bg-[#F1F5F9] text-slate-500 font-mono text-[11px] font-bold text-right border-r-2 border-black overflow-hidden shrink-0">
              {lines.map((_, i) => (
                <div key={i} className="leading-relaxed">{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={currentContent}
              onChange={(event) => onFileChange?.(displayFileName, event.target.value)}
              spellCheck="false"
              className="flex-1 w-full min-h-0 resize-none bg-white p-3 leading-relaxed text-black text-[11px] font-mono font-bold focus:outline-none overflow-auto"
              aria-label={`Edit ${displayFileName}`}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-3 leading-relaxed text-black font-mono font-bold">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="hover:bg-slate-100">
                    <td className="w-8 select-none text-right pr-3 text-slate-500 font-mono text-[11px] border-r-2 border-slate-300 font-bold">{index + 1}</td>
                    <td className="whitespace-pre font-mono text-[11px] text-black pl-3">{line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Terminal Sandbox Result Drawer */}
      {sandboxResult && (
        <div className="mt-2.5 bg-white border-2 border-black rounded-lg overflow-hidden shadow-[4px_4px_0_0_#000]">
          <div
            onClick={() => setShowConsole(!showConsole)}
            className="px-3 py-1.5 bg-[#F8FAFC] border-b-2 border-black flex items-center justify-between cursor-pointer hover:bg-slate-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-black stroke-[2.5]" />
              <span className="text-[11px] font-black uppercase text-black">VALIDATION CONSOLE OUTPUT</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`neo-badge-sm px-2 py-0.5 rounded text-[10px] font-mono ${
                sandboxResult.exit_code === 0 ? 'bg-[#A3E635] text-black' : 'bg-[#FF3366] text-white'
              }`}>
                {sandboxResult.exit_code === 0 ? 'PASS (EXIT 0)' : `FAIL (EXIT ${sandboxResult.exit_code ?? 1})`}
              </span>
              {showConsole ? <ChevronUp className="w-3.5 h-3.5 text-black stroke-[2.5]" /> : <ChevronDown className="w-3.5 h-3.5 text-black stroke-[2.5]" />}
            </div>
          </div>

          {showConsole && (
            <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto text-[11px] font-mono">
              {sandboxResult.command && (
                <div className="text-[10px] font-mono text-black bg-[#FEF08A] p-1.5 rounded border border-black break-all font-black">
                  $ {sandboxResult.command}
                </div>
              )}
              {sandboxResult.stdout && (
                <pre className="text-emerald-950 bg-[#F0FDF4] p-2 rounded border border-black whitespace-pre-wrap font-bold">{sandboxResult.stdout}</pre>
              )}
              {sandboxResult.stderr && (
                <pre className="text-rose-950 bg-[#FEF2F2] p-2 rounded border border-black whitespace-pre-wrap font-bold">{sandboxResult.stderr}</pre>
              )}
              {sandboxResult.error && (
                <div className="text-rose-950 bg-[#FEF2F2] p-2 rounded border border-black flex items-center gap-1.5 font-black">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
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
