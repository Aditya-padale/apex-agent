import React, { useRef, useEffect, useState } from 'react';
import {
  Brain,
  Wrench,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowDownCircle,
} from 'lucide-react';

export default function TrajectoryStream({ events, status, currentStep, maxTurns }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const startEvent = events.find((e) => e.event === 'agent_start');
  const currentMode = startEvent?.data?.mode || (startEvent ? (startEvent.data.has_api_key ? 'live' : 'demo') : null);

  const renderEvent = (ev, index) => {
    const isCopied = copiedIndex === index;

    switch (ev.event) {
      case 'agent_start': {
        const isCustomWorkspace = ev.data.workspace_type === 'custom';
        const isLive = ev.data.mode === 'live' || (ev.data.mode === undefined && ev.data.has_api_key);
        return (
          <div key={index} className="bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-950/80 border border-indigo-500/30 rounded-xl p-3.5 space-y-2.5 shadow-lg shadow-indigo-500/5 animate-fade-in-up">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Agent Initialized — {ev.data.title}</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border shadow-sm ${
                  isLive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {isLive ? '● Live Agent' : '▲ Scripted Demo'}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">{ev.data.goal}</p>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                Model: <strong className="text-indigo-300">{ev.data.model}</strong>
              </span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                Mode: <strong className={isLive ? 'text-emerald-400' : 'text-amber-400'}>
                  {isLive ? 'Live Autonomous Agent' : isCustomWorkspace ? 'Validation-only (no key)' : 'Scripted demo (no API key)'}
                </strong>
              </span>
            </div>
            {isCustomWorkspace && ev.data.validation_command && (
              <div className="text-[10px] font-mono text-cyan-300/90 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800 break-all">
                $ {ev.data.validation_command}
              </div>
            )}
          </div>
        );
      }

      case 'step_start': {
        const turn = ev.data.step || 1;
        const total = ev.data.max_turns || maxTurns || 12;
        const progressPercent = Math.min(100, Math.round((turn / total) * 100));
        return (
          <div key={index} className="my-3 space-y-1">
            <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
              <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-slate-800 flex-1" />
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-indigo-300 font-semibold text-[11px] shadow-sm">
                <span>Turn {turn} of {total}</span>
                <span className="text-[10px] text-slate-500 font-normal">({progressPercent}%)</span>
              </div>
              <div className="h-px bg-gradient-to-l from-transparent via-slate-800 to-slate-800 flex-1" />
            </div>
          </div>
        );
      }

      case 'thought':
        return (
          <div key={index} className="glass-panel-glow p-3.5 border-l-4 border-l-violet-500 space-y-2 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-violet-300 font-semibold text-xs">
                <Brain className="w-4 h-4 text-violet-400" />
                <span>Agent Reasoning & Strategy</span>
              </div>
              <button
                onClick={() => handleCopy(ev.data.thought, index)}
                className="text-slate-500 hover:text-slate-300 text-[10px] flex items-center gap-1 transition-colors"
                title="Copy thought"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-200 font-sans leading-relaxed whitespace-pre-wrap">
              {ev.data.thought}
            </p>
          </div>
        );

      case 'tool_call': {
        const argsJson = JSON.stringify(ev.data.arguments || {}, null, 2);
        return (
          <div key={index} className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 space-y-2 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                <Wrench className="w-3.5 h-3.5" />
                <span>Tool Execution:</span>
                <code className="bg-slate-950 text-cyan-300 px-2 py-0.5 rounded font-mono text-[11px] border border-cyan-500/20">
                  {ev.data.tool_name}
                </code>
              </div>
              {argsJson && argsJson !== '{}' && (
                <button
                  onClick={() => handleCopy(argsJson, index)}
                  className="text-slate-500 hover:text-slate-300 text-[10px] flex items-center gap-1 transition-colors"
                  title="Copy tool arguments"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
            {Object.keys(ev.data.arguments || {}).length > 0 && (
              <pre className="bg-slate-950 p-2.5 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-850">
                {argsJson}
              </pre>
            )}
          </div>
        );
      }

      case 'observation': {
        const res = ev.data.result || {};
        const isClean = res.success !== false && (!res.exit_code || res.exit_code === 0);
        const fullOutput = [res.stdout, res.stderr, res.message, res.error].filter(Boolean).join('\n');
        return (
          <div key={index} className="bg-slate-950 border border-slate-800/90 rounded-xl p-3.5 space-y-2 animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span>Sandbox Observation ({ev.data.tool_name})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(fullOutput, index)}
                  className="text-slate-500 hover:text-slate-300 text-[10px] flex items-center gap-1 transition-colors"
                  title="Copy output"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                  isClean ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}>
                  {isClean ? 'PASS / SUCCESS' : `FAIL (Exit ${res.exit_code ?? 1})`}
                </span>
              </div>
            </div>

            {/* Stdout / Stderr Content */}
            <div className="space-y-2 font-mono text-[11px] max-h-64 overflow-y-auto pr-1">
              {res.stdout && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-slate-500 uppercase font-sans font-medium">STDOUT</div>
                  <pre className="text-emerald-300/90 whitespace-pre-wrap bg-slate-900/60 p-2 rounded border border-slate-850">{res.stdout}</pre>
                </div>
              )}
              {res.stderr && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-rose-400 uppercase font-sans font-medium">STDERR / TRACEBACK</div>
                  <pre className="text-rose-300/90 whitespace-pre-wrap bg-rose-950/20 p-2 rounded border border-rose-900/30">{res.stderr}</pre>
                </div>
              )}
              {res.message && (
                <div className="text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-850">{res.message}</div>
              )}
              {res.error && (
                <div className="text-rose-400 font-semibold bg-rose-950/30 p-2 rounded border border-rose-900/40">{res.error}</div>
              )}
            </div>
          </div>
        );
      }

      case 'workspace_update':
        return (
          <div key={index} className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-2.5 flex items-center justify-between text-xs text-emerald-300 animate-fade-in-up">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>Updated file in sandbox workspace:</span>
              <strong className="font-mono">{ev.data.file_path}</strong>
            </div>
            <span className="text-[10px] font-mono bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded text-emerald-200">SAVED</span>
          </div>
        );

      case 'finished': {
        const didSucceed = ev.data.success !== false;
        return (
          <div key={index} className={`bg-gradient-to-r to-slate-900 border-2 rounded-xl p-4 space-y-2 shadow-lg animate-fade-in-up ${
            didSucceed ? 'from-emerald-950/60 border-emerald-500/50 shadow-emerald-500/10' : 'from-amber-950/50 border-amber-500/50 shadow-amber-500/10'
          }`}>
            <div className={`flex items-center gap-2 font-bold text-sm ${didSucceed ? 'text-emerald-400' : 'text-amber-400'}`}>
              {didSucceed ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              <span>{didSucceed ? 'Task Completed & Verified' : 'Validation Needs Attention'}</span>
            </div>
            <p className="text-xs text-slate-200 font-sans leading-relaxed">
              {ev.data.summary}
            </p>
            <div className={`text-[11px] font-mono pt-1 ${didSucceed ? 'text-emerald-300/80' : 'text-amber-200/80'}`}>
              Completed in {ev.data.turns} turn{ev.data.turns === 1 ? '' : 's'}{didSucceed ? ' with successful validation tests.' : ' without a verified passing result.'}
            </div>
          </div>
        );
      }

      case 'error':
        return (
          <div key={index} className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-4 space-y-2 animate-fade-in-up">
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
    <div className="glass-panel p-4 flex flex-col h-full overflow-hidden">
      {/* Feed Header */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">ReAct Trajectory & Thought Stream</h2>
          {currentMode && (
            <span
              className={`ml-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${
                currentMode === 'live'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {currentMode === 'live' ? '● Live' : '▲ Demo'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900 text-indigo-300 border border-slate-800 font-semibold">
              Turn {currentStep} / {maxTurns || 12}
            </span>
          )}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
              autoScroll
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title="Toggle automatic scrolling to latest step"
          >
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Stream List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 py-12">
            <div className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center shadow-inner">
              <Brain className="w-6 h-6 text-slate-600 stroke-1" />
            </div>
            <div className="text-center space-y-1 max-w-xs">
              <p className="text-xs font-semibold text-slate-300">No active execution trajectory</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Configure your project or choose a benchmark scenario on the left, then click "Run" to watch ApexAgent work in real-time.
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
