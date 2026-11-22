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

  const getCategoryIcon = (category = '', isSelected = false) => {
    const iconClass = isSelected ? 'text-black' : 'text-[#38BDF8]';
    if (category.includes('Algorithmic')) return <Bug className={`w-3.5 h-3.5 stroke-[2.5] ${iconClass}`} />;
    if (category.includes('Pipeline')) return <Layers className={`w-3.5 h-3.5 stroke-[2.5] ${iconClass}`} />;
    return <Code className={`w-3.5 h-3.5 stroke-[2.5] ${iconClass}`} />;
  };

  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-[#A3E635] text-black';
      case 'Medium':
        return 'bg-[#FB923C] text-black';
      case 'Hard':
        return 'bg-[#FF3366] text-white';
      default:
        return 'bg-slate-300 text-black';
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
    <div className="neo-panel p-4 flex flex-col h-full gap-3 overflow-hidden">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#38BDF8] stroke-[2.5]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-white">BENCHMARK SCENARIOS</h2>
          </div>
          <span className="neo-badge-sm bg-[#38BDF8] text-black px-2 py-0.5 rounded text-[10px] font-mono">
            {scenarios.length} READY
          </span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium">
          Select a verified scenario to debug & fix in the ReAct sandbox.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter scenarios by keyword..."
          className="w-full neo-input rounded-md pl-8 pr-3 py-1.5 text-xs font-mono"
        />
      </div>

      {/* Scenario Card List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loadingScenarios ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs gap-2 font-mono">
            <RefreshCw className="w-5 h-5 animate-spin text-[#FFE600]" />
            <span>LOADING SCENARIOS...</span>
          </div>
        ) : filteredScenarios.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 font-mono">
            No scenarios found for "{searchQuery}"
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
                className={`p-3 rounded-lg transition-all duration-150 cursor-pointer border-2 border-black ${
                  isSelected
                    ? 'bg-[#FFE600] text-black shadow-[4px_4px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                    : 'bg-[#181928] text-white shadow-[3px_3px_0px_0px_#000] hover:bg-[#202138] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                } ${status === 'running' ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {getCategoryIcon(sc.category, isSelected)}
                    <h3 className={`text-xs font-black truncate uppercase ${isSelected ? 'text-black' : 'text-white'}`}>
                      {sc.title}
                    </h3>
                  </div>
                  <span
                    className={`neo-badge-sm px-2 py-0.5 rounded text-[9px] font-mono shrink-0 ${getDifficultyBadge(
                      sc.difficulty
                    )}`}
                  >
                    {sc.difficulty}
                  </span>
                </div>
                <p className={`text-[11px] line-clamp-2 leading-relaxed mb-2 font-medium ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                  {sc.description}
                </p>
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded border border-black font-bold text-[9px] ${
                    isSelected ? 'bg-black text-white' : 'bg-[#0f101b] text-slate-300'
                  }`}>
                    {sc.category}
                  </span>
                  <span className={isSelected ? 'text-slate-900 font-bold' : 'text-slate-500 font-bold'}>
                    {fileCount} {fileCount === 1 ? 'FILE' : 'FILES'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Custom Prompt Override */}
      <div className="space-y-1 pt-2 border-t-2 border-black">
        <label className="text-[11px] font-bold text-white uppercase flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3 text-[#38BDF8]" />
          CUSTOM INSTRUCTIONS (OVERRIDE)
        </label>
        <textarea
          rows={2}
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          disabled={status === 'running'}
          placeholder="Override default scenario instructions..."
          className="w-full neo-input rounded-md p-2 text-xs font-mono resize-none disabled:opacity-50"
        />
      </div>

      {/* Action Button */}
      <div className="pt-1">
        {status === 'running' ? (
          <button
            onClick={onCancelAgent}
            className="neo-btn bg-[#FF3366] text-white w-full py-2.5 rounded-lg font-black uppercase text-xs flex items-center justify-center gap-2"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            HALT AGENT EXECUTION
          </button>
        ) : (
          <button
            onClick={onRunAgent}
            disabled={!selectedScenario || loadingScenarios}
            className="neo-btn bg-[#38BDF8] hover:bg-[#7dd3fc] text-black w-full py-2.5 rounded-lg font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            START BENCHMARK EXECUTION
          </button>
        )}
      </div>
    </div>
  );
}
