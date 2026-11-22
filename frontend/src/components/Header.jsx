import React from 'react';
import { Zap, Key, Cpu, AlertCircle, CheckCircle2, Terminal, ShieldCheck, Sparkles } from 'lucide-react';

export default function Header({
  status,
  runSucceeded,
  hasApiKey,
  modelName,
  setModelName,
  onOpenApiKeyModal,
  workspaceMode,
}) {
  return (
    <header className="glass-panel border-b border-slate-800/80 px-6 py-3 flex items-center justify-between sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3.5">
        <div className="relative group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow duration-300">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400/20" />
            </div>
          </div>
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-slate-950 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-extrabold text-base tracking-tight gradient-text">ApexAgent</h1>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              v1.0 ReAct
            </span>
            <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
              {workspaceMode === 'custom' ? 'My Workspace' : 'Benchmark'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400/90 leading-tight">Autonomous Coding & Verification Agent</p>
        </div>
      </div>

      {/* Middle Status Indicator */}
      <div className="hidden md:flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800/90 shadow-inner">
        {status === 'idle' && (
          <>
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-xs font-medium text-slate-400">System Ready</span>
          </>
        )}
        {status === 'running' && (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 status-running" />
            </span>
            <span className="text-xs font-semibold text-emerald-400">Agent Active • ReAct Loop</span>
          </>
        )}
        {status === 'finished' && runSucceeded !== false && (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Task Completed & Verified</span>
          </>
        )}
        {status === 'finished' && runSucceeded === false && (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-medium text-amber-300">Run Finished • Needs Attention</span>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-xs font-medium text-rose-400">Execution Error</span>
          </>
        )}
      </div>

      {/* Right Controls: Model & API Key */}
      <div className="flex items-center space-x-2.5">
        {/* Model Selector */}
        <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs hover:border-slate-700 transition-colors">
          <Cpu className="w-3.5 h-3.5 text-violet-400" />
          <select
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            disabled={status === 'running'}
            className="bg-transparent text-slate-200 font-mono text-[11px] focus:outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="openai/gpt-oss-20b" className="bg-slate-900 text-slate-200">
              openai/gpt-oss-20b (Default)
            </option>
            <option value="openai/gpt-oss-120b" className="bg-slate-900 text-slate-200">
              openai/gpt-oss-120b
            </option>
            <option value="qwen/qwen3.8-27b" className="bg-slate-900 text-slate-200">
              qwen/qwen3.8-27b
            </option>
          </select>
        </div>

        {/* API Key Modal Button */}
        <button
          onClick={onOpenApiKeyModal}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border shadow-sm ${
            hasApiKey
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
          }`}
          title={hasApiKey ? 'Groq API Key Configured' : 'No API Key: Running in Scripted Demo mode'}
        >
          {hasApiKey ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Groq Key Active</span>
              <span className="sm:hidden">Key Active</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Scripted demo (no API key)</span>
              <span className="sm:hidden">Demo Mode</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
