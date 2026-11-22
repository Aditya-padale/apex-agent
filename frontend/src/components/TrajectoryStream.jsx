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
          <div key={index} className="neo-card bg-[#FEF08A] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-3.5 space-y-2.5 text-black">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-black text-xs uppercase">
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
            <p className="text-xs font-semibold leading-relaxed text-black">{ev.data.goal}</p>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] pt-1 border-t-2 border-black">
              <span className="bg-white text-black px-2 py-0.5 rounded border border-black font-bold">
                MODEL: <strong>{ev.data.model}</strong>
              </span>
              <span className="bg-white px-2 py-0.5 rounded border border-black font-bold">
                MODE: <strong>
                  {isLive ? 'Live Autonomous Agent' : isCustomWorkspace ? 'Validation-only' : 'Scripted demo'}
                </strong>
              </span>
            </div>
            {isCustomWorkspace && ev.data.validation_command && (
              <div className="text-[10px] font-mono text-black bg-white px-2.5 py-1 rounded border-2 border-black break-all font-black">
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
          <div key={index} className="neo-card bg-[#EDE9FE] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-3.5 space-y-2 text-black">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wide text-purple-950">
                <Brain className="w-4 h-4 stroke-[2.5]" />
                <span>AGENT REASONING & STRATEGY</span>
              </div>
              <button
                onClick={() => handleCopy(ev.data.thought, index)}
                className="neo-btn bg-white text-black px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"
                title="Copy thought"
              >
                {isCopied ? <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" /> : <Copy className="w-3 h-3 stroke-[2.5]" />}
                <span>{isCopied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-900 font-mono font-medium leading-relaxed whitespace-pre-wrap">
              {ev.data.thought}
            </p>
          </div>
        );

      case 'tool_call': {
        const argsJson = JSON.stringify(ev.data.arguments || {}, null, 2);
        return (
          <div key={index} className="neo-card bg-[#E0F2FE] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-3 space-y-2 text-black">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs uppercase text-black">
                <Wrench className="w-3.5 h-3.5 text-[#0284c7] stroke-[2.5]" />
                <span>TOOL EXECUTION:</span>
                <span className="neo-badge-sm bg-[#38BDF8] text-black px-2 py-0.5 rounded font-mono text-[11px]">
                  {ev.data.tool_name}
                </span>
              </div>
              {argsJson && argsJson !== '{}' && (
                <button
                  onClick={() => handleCopy(argsJson, index)}
                  className="neo-btn bg-white text-black px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"
                  title="Copy tool arguments"
                >
                  {isCopied ? <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" /> : <Copy className="w-3 h-3 stroke-[2.5]" />}
                  <span>{isCopied ? 'COPIED' : 'COPY'}</span>
                </button>
              )}
            </div>
            {Object.keys(ev.data.arguments || {}).length > 0 && (
              <pre className="bg-white border-2 border-black p-2.5 rounded text-[11px] font-mono font-bold text-slate-900 overflow-x-auto shadow-inner">
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
          <div key={index} className="neo-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-black">
                <Terminal className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                <span>SANDBOX OBSERVATION ({ev.data.tool_name})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(fullOutput, index)}
                  className="neo-btn bg-[#f1f5f9] text-black px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"
                  title="Copy output"
                >
                  {isCopied ? <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" /> : <Copy className="w-3 h-3 stroke-[2.5]" />}
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
                  <div className="text-[10px] text-emerald-800 uppercase font-black">STDOUT</div>
                  <pre className="text-emerald-950 whitespace-pre-wrap bg-[#F0FDF4] p-2 rounded border-2 border-black font-bold">{res.stdout}</pre>
                </div>
              )}
              {res.stderr && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-rose-800 uppercase font-black">STDERR / TRACEBACK</div>
                  <pre className="text-rose-950 whitespace-pre-wrap bg-[#FEF2F2] p-2 rounded border-2 border-black font-bold">{res.stderr}</pre>
                </div>
              )}
              {res.message && (
                <div className="text-slate-800 bg-slate-100 p-2 rounded border-2 border-black font-semibold">{res.message}</div>
              )}
              {res.error && (
                <div className="text-rose-950 bg-[#FEF2F2] font-black p-2 rounded border-2 border-black">{res.error}</div>
              )}
            </div>
          </div>
        );
      }

      case 'workspace_update':
        return (
          <div key={index} className="neo-card bg-[#DCFCE7] border-2 border-black shadow-[3px_3px_0px_0px_#000] p-2.5 flex items-center justify-between text-xs text-black">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 stroke-[2.5] text-emerald-800" />
              <span className="font-black">MODIFIED WORKSPACE FILE:</span>
              <strong className="font-mono bg-white text-black px-1.5 py-0.5 rounded border border-black">{ev.data.file_path}</strong>
            </div>
            <span className="neo-badge-sm bg-[#A3E635] text-black px-2 py-0.5 rounded text-[10px] font-mono">SAVED</span>
          </div>
        );

      case 'finished': {
        const didSucceed = ev.data.success !== false;
        return (
          <div key={index} className={`neo-panel-lg p-4 space-y-2 ${
            didSucceed ? 'bg-[#DCFCE7] border-black' : 'bg-[#FED7AA] border-black'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm uppercase text-black">
                {didSucceed ? <CheckCircle2 className="w-5 h-5 stroke-[2.5] text-emerald-800" /> : <AlertTriangle className="w-5 h-5 stroke-[2.5] text-amber-800" />}
                <span>{didSucceed ? 'TASK COMPLETED & VERIFIED' : 'VALIDATION NEEDS ATTENTION'}</span>
              </div>
              <span className={`neo-badge px-2.5 py-0.5 rounded text-xs font-mono ${didSucceed ? 'bg-[#A3E635] text-black' : 'bg-[#FB923C] text-black'}`}>
                {didSucceed ? 'PASSED' : 'UNVERIFIED'}
              </span>
            </div>
            <p className="text-xs text-black font-semibold leading-relaxed">
              {ev.data.summary}
            </p>
            <div className="text-[11px] font-mono pt-1 text-slate-800 font-bold border-t-2 border-black">
              Completed in {ev.data.turns} turn{ev.data.turns === 1 ? '' : 's'}{didSucceed ? ' with successful validation tests.' : ' without passing verification.'}
            </div>
          </div>
        );
      }

      case 'error':
        return (
          <div key={index} className="neo-panel-lg bg-[#FEE2E2] border-2 border-black p-4 space-y-2">
            <div className="flex items-center gap-2 text-[#b91c1c] font-black text-sm uppercase">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              EXECUTION ERROR
            </div>
            <p className="text-xs text-black font-mono font-bold">
              {ev.data.error}
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="neo-panel bg-white p-4 flex flex-col h-full overflow-hidden">
      {/* Feed Header */}
      <div className="flex items-center justify-between mb-3 border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
          <h2 className="text-xs font-black uppercase tracking-wider text-black">REACT TRAJECTORY STREAM</h2>
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
            <span className="neo-badge-sm bg-[#FFE600] text-black px-2.5 py-0.5 rounded text-[11px] font-mono font-black">
              TURN {currentStep} / {maxTurns || 12}
            </span>
          )}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`neo-btn px-2 py-0.5 rounded text-[10px] font-mono ${
              autoScroll
                ? 'bg-[#FFE600] text-black'
                : 'bg-white text-slate-700'
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
            <div className="w-12 h-12 rounded-xl bg-[#FEF08A] border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center">
              <Brain className="w-6 h-6 text-black stroke-[2.5]" />
            </div>
            <div className="text-center space-y-1 max-w-xs">
              <p className="text-xs font-black uppercase text-black tracking-wide">NO ACTIVE EXECUTION</p>
              <p className="text-[11px] text-slate-600 font-semibold">
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
