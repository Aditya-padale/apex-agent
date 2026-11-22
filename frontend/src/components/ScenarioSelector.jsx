import React, { useState } from 'react';
import { Play, Square, Code, Bug, Layers, RefreshCw, MessageSquare, Search, Sparkles } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');

  const getCategoryIcon = (category = '') => {
    if (category.includes('Algorithmic')) return <Bug className="w-3.5 h-3.5 text-cyan-400" />;
    if (category.includes('Pipeline')) return <Layers className="w-3.5 h-3.5 text-violet-400" />;
    return <Code className="w-3.5 h-3.5 text-emerald-400" />;
  };

  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Hard':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const getDifficultyBorder = (difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return 'border-l-emerald-500';
      case 'Medium':
        return 'border-l-amber-500';
      case 'Hard':
        return 'border-l-rose-500';
      default:
        return 'border-l-slate-500';
    }
  };

  const filteredScenarios = scenarios.filter((sc) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      sc.title?.toLowerCase().includes(query) ||
      sc.description?.toLowerCase().includes(query) ||
      sc.category?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="glass-panel p-4 flex flex-col h-full gap-3.5 overflow-hidden">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">Demo Benchmark Scenarios</h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
            {scenarios.length} Available
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Pre-configured benchmark challenges with reproducible bugfixes and isolated test validation.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter scenarios by name or category..."
          className="w-full bg-slate-900/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors"
        />
      </div>

      {/* Scenario Card List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loadingScenarios ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-xs gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            <span>Loading benchmark scenarios...</span>
          </div>
        ) : filteredScenarios.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No scenarios match "{searchQuery}"
          </div>
        ) : (
          filteredScenarios.map((sc) => {
            const isSelected = selectedScenario?.id === sc.id;
            const fileCount = Object.keys(sc.initial_files || {}).length;
            return (
              <div
                key={sc.id}
                onClick={() => {
                  if (status !== 'running') {
                    onSelectScenario(sc);
                  }
                }}
                className={`p-3 rounded-xl transition-all duration-200 cursor-pointer border border-l-4 ${
                  isSelected
                    ? `bg-indigo-950/40 border-indigo-500/60 ${getDifficultyBorder(sc.difficulty)} shadow-md shadow-indigo-500/10`
                    : `bg-slate-900/60 border-slate-800/80 ${getDifficultyBorder(sc.difficulty)} hover:bg-slate-850 hover:border-slate-700`
                } ${status === 'running' ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {getCategoryIcon(sc.category)}
                    <h3 className="text-xs font-semibold text-slate-200 truncate">{sc.title}</h3>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded-full border shrink-0 ${getDifficultyBadge(
                      sc.difficulty
                    )}`}
                  >
                    {sc.difficulty}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">{sc.description}</p>
                <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                  <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800/80 text-[10px]">
                    {sc.category}
                  </span>
                  <span>{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Custom Prompt Override */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
        <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3 text-cyan-400" />
          Custom Instructions (Optional Override)
        </label>
        <textarea
          rows={2}
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          disabled={status === 'running'}
          placeholder="Override default scenario instructions or give specific guidance..."
          className="w-full bg-slate-900/90 border border-slate-800/90 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 resize-none font-sans disabled:opacity-50"
        />
      </div>

      {/* Action Button */}
      <div className="pt-1">
        {status === 'running' ? (
          <button
            onClick={onCancelAgent}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/10"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Halt Agent Execution
          </button>
        ) : (
          <button
            onClick={onRunAgent}
            disabled={!selectedScenario || loadingScenarios}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Scenario Execution
          </button>
        )}
      </div>
    </div>
  );
}
