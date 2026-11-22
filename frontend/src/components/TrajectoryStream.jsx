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
          <div key={index} className="neo-card bg-[#181928] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#FFE600] font-black text-xs uppercase">
                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                <span>AGENT INITIALIZED — {ev.data.title}</span>
              </div>
              <span
                className={`neo-badge-sm px-2.5 py-0.5 rounded text-[10px] font-mono ${
                  isLive
                    ? 'bg-[#A3E635] text-black'
                    : 'bg-[#FFE600] text-black'
                }`}
              >
                {isLive ? '● LIVE AGENT' : '▲ SCRIPTED DEMO'}
              </span>
            </div>
            <p className="text-xs text-white font-medium leading-relaxed">{ev.data.goal}</p>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] pt-1 border-t-2 border-black">
              <span className="bg-[#0f101b] text-slate-300 px-2 py-0.5 rounded border border-black">
                MODEL: <strong className="text-[#38BDF8]">{ev.data.model}</strong>
              </span>
              <span className="bg-[#0f101b] px-2 py-0.5 rounded border border-black">
                MODE: <strong className={isLive ? 'text-[#A3E635]' : 'text-[#FFE600]'}>
                  {isLive ? 'Live Autonomous Agent' : isCustomWorkspace ? 'Validation-only' : 'Scripted demo'}
                </strong>
              </span>
            </div>
            {isCustomWorkspace && ev.data.validation_command && (
              <div className="text-[10px] font-mono text-[#38BDF8] bg-[#0c0d14] px-2.5 py-1 rounded border-2 border-black break-all font-bold">
                $ {ev.data.validation_command}
              </div>
            )}
          </div>
        );
      }

      case 'step_start': {
        const turn = ev.data.step || 1;
        const total = ev.data.max_turns || maxTurns || 12;
        return (
          <div key={index} className="my-3 flex items-center justify-center">
            <div className="neo-badge bg-[#FFE600] text-black px-3.5 py-1 rounded-md text-xs font-mono font-black shadow-[2px_2px_0px_0px_#000]">
              TURN {turn} OF {total}
            </div>
          </div>
        );
      }

      case 'thought':
        return (
          <div key={index} className="neo-card bg-[#211a38] border-2 border-[#A78BFA] shadow-[4px_4px_0px_0px_#000] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#A78BFA] font-black text-xs uppercase tracking-wide">
                <Brain className="w-4 h-4 stroke-[2.5]" />
                <span>AGENT REASONING & STRATEGY</span>
              </div>
              <button
                onClick={() => handleCopy(ev.data.thought, index)}
                className="neo-btn bg-[#0c0d14] text-slate-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"
                title="Copy thought"
              >
                {isCopied ? <Check className="w-3 h-3 text-[#A3E635]" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-100 font-mono leading-relaxed whitespace-pre-wrap">
              {ev.data.thought}
            </p>
          </div>
        );

      case 'tool_call': {
        const argsJson = JSON.stringify(ev.data.arguments || {}, null, 2);
        return (
          <div key={index} className="neo-card bg-[#0f1c2b] border-2 border-[#38BDF8] shadow-[4px_4px_0px_0px_#000] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs uppercase text-white">
                <Wrench className="w-3.5 h-3.5 text-[#38BDF8] stroke-[2.5]" />
                <span>TOOL EXECUTION:</span>
                <span className="neo-badge-sm bg-[#38BDF8] text-black px-2 py-0.5 rounded font-mono text-[11px]">
                  {ev.data.tool_name}
                </span>
              </div>
              {argsJson && argsJson !== '{}' && (
                <button
                  onClick={() => handleCopy(argsJson, index)}
                  className="neo-btn bg-[#0c0d14] text-slate-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"
                  title="Copy tool arguments"
                >
                  {isCopied ? <Check className="w-3 h-3 text-[#A3E635]" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? 'COPIED' : 'COPY'}</span>
                </button>
              )}
            </div>
            {Object.keys(ev.data.arguments || {}).length > 0 && (
              <pre className="bg-[#0c0d14] border-2 border-black p-2.5 rounded text-[11px] font-mono text-slate-200 overflow-x-auto">
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
          <div key={index} className="neo-card bg-[#0c0d14] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-white">
                <Terminal className="w-3.5 h-3.5 text-slate-400 stroke-[2.5]" />
                <span>SANDBOX OBSERVATION ({ev.data.tool_name})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(fullOutput, index)}
                  className="neo-btn bg-[#181928] text-slate-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"
                  title="Copy output"
                >
                  {isCopied ? <Check className="w-3 h-3 text-[#A3E635]" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? 'COPIED' : 'COPY'}</span>
                </button>
                <span className={`neo-badge-sm px-2 py-0.5 rounded font-mono text-[10px] ${
                  isClean ? 'bg-[#A3E635] text-black' : 'bg-[#FF3366] text-white'
                }`}>
                  {isClean ? 'PASS (EXIT 0)' : `FAIL (EXIT ${res.exit_code ?? 1})`}
                </span>
              </div>
            </div>

            {/* Stdout / Stderr Content */}
            <div className="space-y-2 font-mono text-[11px] max-h-64 overflow-y-auto pr-1">
              {res.stdout && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase font-black">STDOUT</div>
                  <pre className="text-[#A3E635] whitespace-pre-wrap bg-[#101912] p-2 rounded border border-black">{res.stdout}</pre>
                </div>
              )}
              {res.stderr && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-[#FF3366] uppercase font-black">STDERR / TRACEBACK</div>
                  <pre className="text-[#FF8099] whitespace-pre-wrap bg-[#241217] p-2 rounded border border-black">{res.stderr}</pre>
                </div>
              )}
              {res.message && (
                <div className="text-slate-200 bg-[#181928] p-2 rounded border border-black">{res.message}</div>
              )}
              {res.error && (
                <div className="text-[#FF3366] font-bold bg-[#241217] p-2 rounded border border-black">{res.error}</div>
              )}
            </div>
          </div>
        );
      }

      case 'workspace_update':
        return (
          <div key={index} className="neo-card bg-[#122319] border-2 border-[#A3E635] shadow-[3px_3px_0px_0px_#000] p-2.5 flex items-center justify-between text-xs text-[#A3E635]">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 stroke-[2.5]" />
              <span className="font-bold">MODIFIED WORKSPACE FILE:</span>
              <strong className="font-mono bg-black text-white px-1.5 py-0.5 rounded border border-black">{ev.data.file_path}</strong>
            </div>
            <span className="neo-badge-sm bg-[#A3E635] text-black px-2 py-0.5 rounded text-[10px] font-mono">SAVED</span>
          </div>
        );

      case 'finished': {
        const didSucceed = ev.data.success !== false;
        return (
          <div key={index} className={`neo-panel-lg p-4 space-y-2 ${
            didSucceed ? 'bg-[#12261b] border-[#A3E635]' : 'bg-[#291b10] border-[#FB923C]'
          }`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 font-black text-sm uppercase ${didSucceed ? 'text-[#A3E635]' : 'text-[#FB923C]'}`}>
                {didSucceed ? <CheckCircle2 className="w-5 h-5 stroke-[2.5]" /> : <AlertTriangle className="w-5 h-5 stroke-[2.5]" />}
                <span>{didSucceed ? 'TASK COMPLETED & VERIFIED' : 'VALIDATION NEEDS ATTENTION'}</span>
              </div>
              <span className={`neo-badge px-2.5 py-0.5 rounded text-xs font-mono ${didSucceed ? 'bg-[#A3E635] text-black' : 'bg-[#FB923C] text-black'}`}>
                {didSucceed ? 'PASSED' : 'UNVERIFIED'}
              </span>
            </div>
            <p className="text-xs text-white font-medium leading-relaxed">
              {ev.data.summary}
            </p>
            <div className="text-[11px] font-mono pt-1 text-slate-300 font-bold border-t-2 border-black">
              Completed in {ev.data.turns} turn{ev.data.turns === 1 ? '' : 's'}{didSucceed ? ' with successful validation tests.' : ' without passing verification.'}
            </div>
          </div>
        );
      }

      case 'error':
        return (
          <div key={index} className="neo-panel-lg bg-[#281218] border-2 border-[#FF3366] p-4 space-y-2">
            <div className="flex items-center gap-2 text-[#FF3366] font-black text-sm uppercase">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              EXECUTION ERROR
            </div>
            <p className="text-xs text-white font-mono font-bold">
              {ev.data.error}
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="neo-panel p-4 flex flex-col h-full overflow-hidden">
      {/* Feed Header */}
      <div className="flex items-center justify-between mb-3 border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FFE600] stroke-[2.5]" />
          <h2 className="text-xs font-black uppercase tracking-wider text-white">REACT TRAJECTORY STREAM</h2>
          {currentMode && (
            <span
              className={`neo-badge-sm px-2 py-0.5 rounded text-[9px] font-mono ${
                currentMode === 'live'
                  ? 'bg-[#A3E635] text-black'
                  : 'bg-[#FFE600] text-black'
              }`}
            >
              {currentMode === 'live' ? '● LIVE' : '▲ DEMO'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <span className="neo-badge-sm bg-[#1c1d30] text-[#FFE600] px-2.5 py-0.5 rounded text-[11px] font-mono font-black">
              TURN {currentStep} / {maxTurns || 12}
            </span>
          )}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`neo-btn px-2 py-0.5 rounded text-[10px] font-mono ${
              autoScroll
                ? 'bg-[#FFE600] text-black'
                : 'bg-[#181928] text-slate-400'
            }`}
            title="Toggle automatic scrolling"
          >
            SCROLL {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Stream List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 py-12">
            <div className="w-12 h-12 rounded-xl bg-[#10111a] border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center">
              <Brain className="w-6 h-6 text-[#FFE600] stroke-[2.5]" />
            </div>
            <div className="text-center space-y-1 max-w-xs">
              <p className="text-xs font-black uppercase text-white tracking-wide">NO ACTIVE EXECUTION</p>
              <p className="text-[11px] text-slate-400 font-medium">
                Set up your project or choose a scenario on the left, then click "Run" to trigger the ReAct loop.
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
