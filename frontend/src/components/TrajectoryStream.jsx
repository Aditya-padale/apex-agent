import React, { useRef, useEffect } from 'react';
import {
  Brain,
  Wrench,
  Terminal,
  CheckCircle,
  AlertTriangle,
  FileCode,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

export default function TrajectoryStream({ events, status, currentStep, maxTurns }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const renderEvent = (ev, index) => {
    switch (ev.event) {
      case 'agent_start':
        const isCustomWorkspace = ev.data.workspace_type === 'custom';
        return (
          <div key={index} className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Agent Initialized — {ev.data.title}
            </div>
            <p className="text-xs text-slate-300 font-sans">{ev.data.goal}</p>
            <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400 pt-1">
              <span>Model: <strong className="text-indigo-300">{ev.data.model}</strong></span>
              <span>Mode: <strong className={ev.data.has_api_key ? "text-emerald-400" : "text-amber-400"}>
                {ev.data.has_api_key ? 'Gemini Live API' : isCustomWorkspace ? 'Validation-only (no key)' : 'Sandbox Simulation'}
              </strong></span>
            </div>
            {isCustomWorkspace && ev.data.validation_command && (
              <div className="text-[10px] font-mono text-slate-400 pt-1 break-all">Validate: {ev.data.validation_command}</div>
            )}
          </div>
        );

      case 'step_start':
        return (
          <div key={index} className="flex items-center gap-2 my-2 font-mono text-xs text-slate-400">
            <div className="h-px bg-slate-800 flex-1" />
            <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-indigo-300 font-semibold text-[11px]">
              Turn {ev.data.step} / {ev.data.max_turns}
            </span>
            <div className="h-px bg-slate-800 flex-1" />
          </div>
        );

      case 'thought':
        return (
          <div key={index} className="glass-panel-glow p-3.5 border-l-4 border-l-violet-500 space-y-1.5">
            <div className="flex items-center gap-2 text-violet-300 font-semibold text-xs">
              <Brain className="w-4 h-4 text-violet-400" />
              Reasoning & Strategy (Thought)
            </div>
            <p className="text-xs text-slate-200 font-sans leading-relaxed whitespace-pre-wrap">
              {ev.data.thought}
            </p>
          </div>
        );

      case 'tool_call':
        return (
          <div key={index} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                <Wrench className="w-3.5 h-3.5" />
                <span>Tool Execution:</span>
                <code className="bg-slate-950 text-cyan-300 px-2 py-0.5 rounded font-mono text-[11px] border border-slate-800">
                  {ev.data.tool_name}
                </code>
              </div>
            </div>
            {Object.keys(ev.data.arguments || {}).length > 0 && (
              <pre className="bg-slate-950 p-2.5 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-850">
                {JSON.stringify(ev.data.arguments, null, 2)}
              </pre>
            )}
          </div>
        );

      case 'observation':
        const res = ev.data.result || {};
        const isClean = res.success !== false && (!res.exit_code || res.exit_code === 0);
        return (
          <div key={index} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span>Sandbox Observation ({ev.data.tool_name})</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                isClean ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}>
                {isClean ? 'PASS / SUCCESS' : `FAIL (Exit ${res.exit_code ?? 1})`}
              </span>
            </div>

            {/* Stdout / Stderr Content */}
            <div className="space-y-1.5 font-mono text-[11px] max-h-60 overflow-y-auto pr-1">
              {res.stdout && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-sans font-medium">STDOUT</div>
                  <pre className="text-emerald-300/90 whitespace-pre-wrap">{res.stdout}</pre>
                </div>
              )}
              {res.stderr && (
                <div>
                  <div className="text-[10px] text-rose-400 uppercase font-sans font-medium">STDERR / TRACEBACK</div>
                  <pre className="text-rose-300/90 whitespace-pre-wrap">{res.stderr}</pre>
                </div>
              )}
              {res.message && (
                <div className="text-slate-300">{res.message}</div>
              )}
              {res.error && (
                <div className="text-rose-400 font-semibold">{res.error}</div>
              )}
            </div>
          </div>
        );

      case 'workspace_update':
        return (
          <div key={index} className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-2.5 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>Updated file in sandbox workspace:</span>
              <strong className="font-mono">{ev.data.file_path}</strong>
            </div>
            <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-200">SAVED</span>
          </div>
        );

      case 'finished':
        const didSucceed = ev.data.success !== false;
        return (
          <div key={index} className={`bg-gradient-to-r to-slate-900 border-2 rounded-xl p-4 space-y-2 shadow-lg ${
            didSucceed ? 'from-emerald-950/60 border-emerald-500/50 shadow-emerald-500/10' : 'from-amber-950/50 border-amber-500/50 shadow-amber-500/10'
          }`}>
            <div className={`flex items-center gap-2 font-bold text-sm ${didSucceed ? 'text-emerald-400' : 'text-amber-400'}`}>
              {didSucceed ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {didSucceed ? 'Task Execution Finished' : 'Validation Needs Attention'}
            </div>
            <p className="text-xs text-slate-200 font-sans leading-relaxed">
              {ev.data.summary}
            </p>
            <div className={`text-[11px] font-mono pt-1 ${didSucceed ? 'text-emerald-300/80' : 'text-amber-200/80'}`}>
              Completed in {ev.data.turns} turn{ev.data.turns === 1 ? '' : 's'}{didSucceed ? ' with successful validation.' : ' without a verified passing result.'}
            </div>
          </div>
        );

      case 'error':
        return (
          <div key={index} className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              Execution Error
            </div>
            <p className="text-xs text-rose-200 font-mono">
              {ev.data.error}
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="glass-panel p-5 flex flex-col h-full overflow-hidden">
      {/* Feed Header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">ReAct Trajectory & Thought Stream</h2>
        </div>
        {currentStep > 0 && (
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
            Turn {currentStep} / {maxTurns || 10}
          </span>
        )}
      </div>

      {/* Stream List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 py-12">
            <Brain className="w-10 h-10 text-slate-700 stroke-1" />
            <div className="text-center space-y-1">
              <p className="text-xs font-medium text-slate-400">No active execution trajectory</p>
              <p className="text-[11px] text-slate-500">
                Select a benchmark scenario on the left and click "Start ApexAgent Execution".
              </p>
            </div>
          </div>
        ) : (
          events.map((ev, i) => renderEvent(ev, i))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
