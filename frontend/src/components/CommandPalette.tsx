import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemo } from '../context/DemoContext';
import { 
  Search, 
  Terminal, 
  Layers, 
  GitFork, 
  Settings, 
  ShieldAlert, 
  Flame, 
  Cpu, 
  Play, 
  RefreshCw,
  FolderGit2
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { startSimulation, stopSimulation, resetDemo } = useDemo();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = [
    { name: 'Go to Dashboard', shortcut: 'G D', icon: Layers, action: () => { navigate('/'); onClose(); } },
    { name: 'Go to Projects', shortcut: 'G P', icon: FolderGit2, action: () => { navigate('/projects'); onClose(); } },
    { name: 'Go to Pipelines Stages', shortcut: 'G L', icon: GitFork, action: () => { navigate('/pipelines'); onClose(); } },
    { name: 'Go to Deployments Explorer', shortcut: 'G E', icon: Layers, action: () => { navigate('/deployments'); onClose(); } },
    { name: 'Go to GitOps Controller', shortcut: 'G G', icon: GitFork, action: () => { navigate('/gitops'); onClose(); } },
    { name: 'Go to Terraform IaC Platform', shortcut: 'G T', icon: Terminal, action: () => { navigate('/terraform'); onClose(); } },
    { name: 'Go to SRE SLO Console', shortcut: 'G S', icon: ShieldAlert, action: () => { navigate('/sre'); onClose(); } },
    { name: 'Go to Chaos Monkey Space', shortcut: 'G C', icon: Flame, action: () => { navigate('/chaos'); onClose(); } },
    { name: 'Go to LogQL Logs aggregates', shortcut: 'G H', icon: Terminal, action: () => { navigate('/logs'); onClose(); } },
    { name: 'Go to AIOps Diagnostics Copilot', shortcut: 'G A', icon: Cpu, action: () => { navigate('/ai-assistant'); onClose(); } },
    { name: 'Go to Settings Console', shortcut: 'G O', icon: Settings, action: () => { navigate('/settings'); onClose(); } },
    { name: 'Trigger E2E Demo Simulation', shortcut: 'D T', icon: Play, action: () => { startSimulation(); onClose(); } },
    { name: 'Pause Demo Mode', shortcut: 'D P', icon: ShieldAlert, action: () => { stopSimulation(); onClose(); } },
    { name: 'Reset Demo State', shortcut: 'D R', icon: RefreshCw, action: () => { resetDemo(); onClose(); } },
  ];

  const filtered = commands.filter(cmd => 
    cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filtered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-[#090E1A]/90 border border-white/[0.08] rounded-xl shadow-glow overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.04]">
          <Search className="h-5 w-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Type a command or navigation shortcut..."
            className="flex-1 bg-transparent text-sm text-text focus:outline-none placeholder:text-slate-650"
          />
          <span className="text-[10px] font-mono border border-white/10 px-1.5 py-0.5 rounded text-muted">ESC</span>
        </div>

        {/* Command list */}
        <div className="max-h-[300px] overflow-y-auto p-2 space-y-0.5">
          {filtered.length > 0 ? (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.name}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    selectedIndex === idx 
                      ? 'bg-primary/20 text-text border border-white/[0.02]' 
                      : 'text-muted hover:text-text border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${selectedIndex === idx ? 'text-primary-light' : 'text-slate-500'}`} />
                    <span className="text-xs font-semibold truncate">{cmd.name}</span>
                  </div>
                  <span className="text-[9px] font-mono border border-white/5 bg-slate-900 px-2 py-0.5 rounded text-muted">
                    {cmd.shortcut}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted text-xs font-mono">
              No matching command shortcuts found.
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="flex justify-between items-center px-4 py-3 bg-[#050810] border-t border-white/[0.04] text-[10px] text-muted font-mono">
          <span>Use ↑↓ keys to select, ENTER to trigger command</span>
          <span>Deploymate Operating System</span>
        </div>
      </div>
    </div>
  );
};
