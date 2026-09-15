import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDemo } from '../context/DemoContext';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Bell, 
  Cpu, 
  Play, 
  RefreshCw,
  Server
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSimulating, startSimulation, resetDemo, demoStage } = useDemo();
  const [infraMode, setInfraMode] = useState<'REAL' | 'SIMULATED'>('SIMULATED');

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    const segment = path.split('/')[1];
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ');
  };

  const triggerSearch = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);
  };

  return (
    <header className="fixed top-0 right-0 left-64 z-20 flex h-16 items-center justify-between border-b border-white/[0.04] bg-background/60 backdrop-blur-md px-8 select-none">
      
      {/* Left: Page Title & Infrastructure Mode */}
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-bold tracking-tight text-text font-mono uppercase">{getPageTitle()}</h2>
        <span className="text-white/10">/</span>
        
        {/* Infrastructure Mode Selector */}
        <div className="flex items-center gap-2 border border-white/[0.06] bg-slate-950/60 px-2.5 py-1 rounded-md">
          <Server className={`h-3.5 w-3.5 ${infraMode === 'REAL' ? 'text-success' : 'text-amber-400'}`} />
          <span className="text-[10px] font-mono text-muted uppercase">Infra:</span>
          <button 
            onClick={() => setInfraMode(infraMode === 'REAL' ? 'SIMULATED' : 'REAL')}
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${
              infraMode === 'REAL' ? 'bg-success/20 text-success' : 'bg-amber-400/20 text-amber-400'
            }`}
            title="Click to toggle between Real Kubernetes cluster API and Simulation mode"
          >
            {infraMode === 'REAL' ? 'REAL CLUSTER' : 'SIMULATION MODE'}
          </button>
        </div>
      </div>

      {/* Center/Right: Controllers & Command triggers */}
      <div className="flex items-center gap-6">
        
        {/* Search Input Bar (Raycast command palette trigger) */}
        <div 
          onClick={triggerSearch}
          className="flex items-center gap-2 border border-white/[0.05] bg-slate-950/40 rounded-lg px-3 py-1.5 w-64 text-muted cursor-pointer hover:border-white/10 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs text-slate-500 font-semibold flex-1">Search command center...</span>
          <kbd className="text-[9px] font-mono border border-white/10 px-1 py-0.5 rounded bg-slate-900 leading-none">⌘K</kbd>
        </div>

        {/* E2E Centerpiece Simulation controller (DEMO MODE) */}
        <div className="flex items-center gap-2 border-l border-white/[0.04] pl-6">
          {isSimulating ? (
            <div className="flex items-center gap-2 border border-warning/20 bg-warning/5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono text-warning animate-pulse">
              <RefreshCw className="h-3 w-3 animate-spin" /> SIM STAGE {demoStage}/8
            </div>
          ) : (
            <button
              onClick={startSimulation}
              className="flex items-center gap-1.5 border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-2.5 py-1 rounded-full text-[10px] font-bold font-mono text-primary shadow-glow"
            >
              <Play className="h-3 w-3" /> DEMO SEQUENCE
            </button>
          )}
          
          {demoStage > 0 && (
            <button 
              onClick={resetDemo}
              className="p-1 rounded hover:bg-white/5 text-muted hover:text-text transition-colors"
              title="Reset state"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Alerts count */}
        <button 
          onClick={() => navigate('/sre')}
          className="relative p-1 rounded hover:bg-white/5 text-muted hover:text-text transition-colors"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-danger shadow-glow-danger" />
        </button>

        {/* AI Assistant shortcut */}
        <button 
          onClick={() => navigate('/ai-assistant')}
          className="p-1 rounded hover:bg-white/5 text-muted hover:text-text transition-colors"
        >
          <Cpu className="h-4.5 w-4.5" />
        </button>

        {/* User initials bubble */}
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-text border border-white/[0.08] cursor-pointer">
          {user?.name.charAt(0).toUpperCase() || 'A'}
        </div>

      </div>

    </header>
  );
};
