import React from 'react';
import { Zap, Key, Cpu, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Header({
  status,
  runSucceeded,
  hasApiKey,
  modelName,
  setModelName,
  onOpenApiKeyModal,
}) {
  return (
    <header className="glass-panel border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-lg tracking-tight gradient-text">ApexAgent</h1>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              ReAct Engine v1.0
            </span>
          </div>
          <p className="text-xs text-slate-400">Autonomous Coding & Debugging Agent with Sandbox Feedback</p>
        </div>
      </div>

      {/* Middle Status Indicator */}
      <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800">
        {status === 'idle' && (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span className="text-xs font-medium text-slate-400">System Ready</span>
          </>
        )}
        {status === 'running' && (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 status-running" />
            <span className="text-xs font-semibold text-emerald-400">Agent Active (ReAct Loop)</span>
          </>
        )}
        {status === 'finished' && runSucceeded !== false && (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Task Completed & Verified</span>
          </>
        )}
        {status === 'finished' && runSucceeded === false && (
          <>
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">Run Finished — Needs Attention</span>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-medium text-rose-400">Task Halted with Exception</span>
          </>
        )}
      </div>

      {/* Right Controls: Model & API Key */}
      <div className="flex items-center space-x-3">
        {/* Model Selector */}
        <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
          <Cpu className="w-3.5 h-3.5 text-violet-400" />
          <select
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            disabled={status === 'running'}
            className="bg-transparent text-slate-200 font-mono focus:outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="gemini-3.5-flash" className="bg-slate-900 text-slate-200">
              gemini-3.5-flash (Free)
            </option>
            <option value="gemini-2.5-pro" className="bg-slate-900 text-slate-200">
              gemini-2.5-pro
            </option>
          </select>
        </div>

        {/* API Key Modal Button */}
        <button
          onClick={onOpenApiKeyModal}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
            hasApiKey
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>{hasApiKey ? 'API Key Set' : 'Simulated (No Key)'}</span>
        </button>
      </div>
    </header>
  );
}
