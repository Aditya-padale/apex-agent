import React, { useState, useEffect } from 'react';
import { Key, ShieldCheck, X, Save, Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react';

export default function ApiKeyModal({ isOpen, onClose, apiKey, onSaveApiKey }) {
  const [inputKey, setInputKey] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setInputKey(apiKey || '');
  }, [apiKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(inputKey.trim());
    onClose();
  };

  const handleClear = () => {
    setInputKey('');
    onSaveApiKey('');
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="neo-panel-lg w-full max-w-md p-6 relative space-y-4 bg-white border-3 border-black shadow-[8px_8px_0px_0px_#000] text-black">
        <button
          onClick={onClose}
          className="neo-btn absolute top-4 right-4 bg-[#FF3366] text-white p-1 rounded-md"
          title="Close dialog"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#FFE600] border-2 border-black shadow-[3px_3px_0_0_#000] text-black">
            <Key className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-black uppercase text-black tracking-wide">GROQ API CONFIGURATION</h3>
            <p className="text-xs text-slate-600 font-mono font-bold">High-speed inference for live agent runs</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase text-black">GROQ API KEY</label>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#0284c7] hover:underline font-mono font-black flex items-center gap-1"
            >
              <span>Get API key</span>
              <ExternalLink className="w-3 h-3 stroke-[2.5]" />
            </a>
          </div>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="gsk_..."
              autoFocus
              className="w-full neo-input rounded-md pl-3 pr-10 py-2 text-xs font-mono font-bold text-black"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-2.5 text-slate-600 hover:text-black"
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-600 font-medium leading-normal">
            If blank, ApexAgent operates in <strong>Scripted demo (no API key)</strong> mode: the demo replays a pre-written fix for the built-in scenarios while running real pytest in the sandbox. Add a Groq key for full autonomous function calling.
          </p>
        </div>

        <div className="neo-card bg-[#FEF08A] border-2 border-black p-3 text-[11px] font-mono font-bold text-black flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-black shrink-0 mt-0.5 stroke-[2.5]" />
          <span className="leading-relaxed">
            Your key stays in browser localStorage and is sent directly via the <code className="bg-black text-[#FFE600] px-1 py-0.5 rounded font-bold">X-API-Key</code> request header to your local backend.
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t-2 border-black">
          <button
            onClick={handleClear}
            className="neo-btn px-3 py-1.5 rounded-md bg-[#FF3366] text-white text-xs font-black uppercase flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
            CLEAR KEY
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="neo-btn px-3 py-1.5 rounded-md bg-[#f1f5f9] text-black text-xs font-bold uppercase"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              className="neo-btn px-4 py-1.5 rounded-md bg-[#A3E635] text-black text-xs font-black uppercase flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 stroke-[2.5]" />
              SAVE SETTINGS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
