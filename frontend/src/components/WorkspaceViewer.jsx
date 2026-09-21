import React, { useEffect, useState } from 'react';
import { FileCode, Play, Terminal, AlertCircle, RefreshCw, PencilLine } from 'lucide-react';
import { runSandboxTest } from '../api';

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

  const handleRunManualTest = async () => {
    if (!canRun) return;
    setTesting(true);
    setSandboxResult(null);
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

  return (
    <div className="glass-panel p-5 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Sandbox workspace</h2>
            <p className="text-[10px] text-slate-500">{isEditable ? 'Editable custom-project files' : 'Benchmark files'}</p>
          </div>
        </div>

        <button
          onClick={handleRunManualTest}
          disabled={testing || !canRun}
          title={isEditable && !validationCommand.trim() ? 'Add a validation command first' : undefined}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-mono font-medium transition-all disabled:opacity-50"
        >
          {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />}
          <span>{testing ? 'Running…' : isEditable ? 'Run validation' : 'Run file'}</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
        {fileNames.map((fileName) => {
          const isActive = fileName === displayFileName;
          return (
            <button
              key={fileName}
              onClick={() => setActiveFile(fileName)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 border whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-300 font-semibold'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-slate-400" />
              <span>{fileName}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 bg-slate-950 border border-slate-850 rounded-xl overflow-hidden flex flex-col font-mono text-xs min-h-0">
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-850 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="truncate">{displayFileName || 'No file open'}</span>
          <span className="flex items-center gap-1.5 shrink-0">{isEditable && <PencilLine className="w-3 h-3 text-cyan-400" />}{currentContent.split('\n').length} lines</span>
        </div>

        {isEditable && displayFileName ? (
          <textarea
            value={currentContent}
            onChange={(event) => onFileChange?.(displayFileName, event.target.value)}
            spellCheck="false"
            className="flex-1 w-full min-h-0 resize-none bg-slate-950 p-4 leading-relaxed text-slate-200 text-[12px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500/50"
            aria-label={`Edit ${displayFileName}`}
          />
        ) : (
          <div className="flex-1 overflow-auto p-4 leading-relaxed text-slate-200 selection:bg-indigo-500/30">
            <table className="w-full border-collapse">
              <tbody>
                {currentContent.split('\n').map((line, index) => (
                  <tr key={index} className="hover:bg-slate-900/40">
                    <td className="w-10 select-none text-right pr-4 text-slate-600 font-mono text-[11px]">{index + 1}</td>
                    <td className="whitespace-pre font-mono text-[12px] text-slate-200">{line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sandboxResult && (
        <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 max-h-44 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Validation result
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              sandboxResult.exit_code === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              Exit code: {sandboxResult.exit_code ?? '—'}
            </span>
          </div>
          {sandboxResult.command && <div className="text-[10px] font-mono text-slate-500 break-all">$ {sandboxResult.command}</div>}
          {sandboxResult.stdout && <pre className="text-[11px] font-mono text-emerald-300 whitespace-pre-wrap">{sandboxResult.stdout}</pre>}
          {sandboxResult.stderr && <pre className="text-[11px] font-mono text-rose-300 whitespace-pre-wrap">{sandboxResult.stderr}</pre>}
          {sandboxResult.error && <div className="text-[11px] font-mono text-rose-400 flex gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{sandboxResult.error}</div>}
        </div>
      )}
    </div>
  );
}
