import React from 'react';
import { Play, Square, Code, Bug, Layers, RefreshCw, MessageSquare } from 'lucide-react';

export default function ScenarioSelector({
  scenarios,
  selectedScenario,
  onSelectScenario,
  customPrompt,
  setCustomPrompt,
  onRunAgent,
  onCancelAgent,
  status,
  loadingScenarios,
}) {
  const getCategoryIcon = (category) => {
    if (category.includes('Algorithmic')) return <Bug className="w-4 h-4 text-cyan-400" />;
    if (category.includes('Pipeline')) return <Layers className="w-4 h-4 text-violet-400" />;
    return <Code className="w-4 h-4 text-emerald-400" />;
  };

  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Hard':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="glass-panel p-5 flex flex-col h-full gap-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Bug className="w-4 h-4 text-indigo-400" />
            Benchmark Scenarios
          </h2>
          <span className="text-xs text-slate-500 font-mono">{scenarios.length} Available</span>
        </div>
        <p className="text-xs text-slate-400">Select a coding problem for the ApexAgent to inspect, debug, and solve.</p>
      </div>

      {/* Scenario Card List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loadingScenarios ? (
          <div className="flex items-center justify-center py-10 text-slate-500 text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            Loading benchmark scenarios...
          </div>
        ) : (
          scenarios.map((sc) => {
            const isSelected = selectedScenario?.id === sc.id;
            return (
              <div
                key={sc.id}
                onClick={() => {
                  if (status !== 'running') {
                    onSelectScenario(sc);
                  }
                }}
                className={`p-3.5 rounded-xl transition-all duration-200 cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
                } ${status === 'running' ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(sc.category)}
                    <h3 className="text-xs font-semibold text-slate-200 line-clamp-1">{sc.title}</h3>
                  </div>
                  <span
                    className={`text-[10px] font-medium font-mono px-2 py-0.5 rounded-md border ${getDifficultyBadge(
                      sc.difficulty
                    )}`}
                  >
                    {sc.difficulty}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-2">{sc.description}</p>
                <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{sc.category}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Custom Goal / Prompt Override */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          Custom Prompt / Instructions (Optional)
        </label>
        <textarea
          rows={3}
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          disabled={status === 'running'}
          placeholder="Override default scenario instructions or give specific guidance to ApexAgent..."
          className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 resize-none font-sans disabled:opacity-50"
        />
      </div>

      {/* Action Button: Run / Cancel */}
      <div>
        {status === 'running' ? (
          <button
            onClick={onCancelAgent}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-rose-500/10"
          >
            <Square className="w-4 h-4 fill-current" />
            Halt Agent Execution
          </button>
        ) : (
          <button
            onClick={onRunAgent}
            disabled={!selectedScenario || loadingScenarios}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 fill-current" />
            Start ApexAgent Execution
          </button>
        )}
      </div>
    </div>
  );
}
