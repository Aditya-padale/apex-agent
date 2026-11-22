import React from 'react';
import { Zap, Key, Cpu, AlertCircle, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

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
    <header className="border-b-2 border-black bg-[#151624] px-5 py-2.5 flex items-center justify-between sticky top-0 z-40 shadow-[0_3px_0_0_#000]">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-[#FFE600] border-2 border-black shadow-[3px_3px_0_0_#000] flex items-center justify-center">
          <Zap className="w-5 h-5 text-black fill-black" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-black text-lg tracking-tight text-white uppercase">ApexAgent</h1>
            <span className="neo-badge-sm bg-[#A3E635] text-black px-2 py-0.5 rounded text-[10px] font-mono">
              v1.0 ReAct
            </span>
            <span className="neo-badge-sm bg-[#38BDF8] text-black px-2 py-0.5 rounded text-[10px] font-mono hidden sm:inline-block">
              {workspaceMode === 'custom' ? 'My Project' : 'Benchmark'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Autonomous Coding & Verification Engine</p>
        </div>
      </div>

      {/* Middle Status Indicator */}
      <div className="hidden md:flex items-center space-x-2">
        {status === 'idle' && (
          <div className="neo-badge bg-[#1c1d30] text-slate-300 px-3 py-1 rounded-md text-xs font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>SYSTEM READY</span>
          </div>
        )}
        {status === 'running' && (
          <div className="neo-badge bg-[#A3E635] text-black px-3 py-1 rounded-md text-xs font-mono flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-black neo-pulse" />
            <span>AGENT ACTIVE (REACT LOOP)</span>
          </div>
        )}
        {status === 'finished' && runSucceeded !== false && (
          <div className="neo-badge bg-[#38BDF8] text-black px-3 py-1 rounded-md text-xs font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>TASK VERIFIED (PASSED)</span>
          </div>
        )}
        {status === 'finished' && runSucceeded === false && (
          <div className="neo-badge bg-[#FB923C] text-black px-3 py-1 rounded-md text-xs font-mono flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>NEEDS ATTENTION</span>
          </div>
        )}
        {status === 'error' && (
          <div className="neo-badge bg-[#FF3366] text-white px-3 py-1 rounded-md text-xs font-mono flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>HALTED WITH ERROR</span>
          </div>
        )}
      </div>

      {/* Right Controls: Model & API Key */}
      <div className="flex items-center space-x-2.5">
        {/* Model Selector */}
        <div className="flex items-center space-x-1.5 bg-[#0f101b] border-2 border-black shadow-[2px_2px_0_0_#000] rounded-md px-2.5 py-1 text-xs">
          <Cpu className="w-3.5 h-3.5 text-[#38BDF8]" />
          <select
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            disabled={status === 'running'}
            className="bg-transparent text-white font-mono text-[11px] font-bold focus:outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="openai/gpt-oss-20b" className="bg-[#151624] text-white">
              openai/gpt-oss-20b
            </option>
            <option value="openai/gpt-oss-120b" className="bg-[#151624] text-white">
              openai/gpt-oss-120b
            </option>
            <option value="qwen/qwen3.8-27b" className="bg-[#151624] text-white">
              qwen/qwen3.8-27b
            </option>
          </select>
        </div>

        {/* API Key Modal Button */}
        <button
          onClick={onOpenApiKeyModal}
          className={`neo-btn flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-mono ${
            hasApiKey
              ? 'bg-[#A3E635] text-black'
              : 'bg-[#FFE600] text-black'
          }`}
          title={hasApiKey ? 'Groq API Key Configured' : 'No API Key: Running in Scripted Demo mode'}
        >
          {hasApiKey ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">KEY ACTIVE</span>
              <span className="sm:hidden">KEY</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">SCRIPTED DEMO</span>
              <span className="sm:hidden">DEMO</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
