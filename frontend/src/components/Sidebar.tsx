import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderGit2, 
  GitFork, 
  Ship, 
  Activity, 
  Terminal, 
  Cpu, 
  Settings,
  LogOut,
  GitCompare,
  FileCode,
  HeartPulse,
  Flame,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { logout, user } = useAuth();

  const navigation = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Projects', to: '/projects', icon: FolderGit2 },
    { name: 'Pipelines', to: '/pipelines', icon: GitFork },
    { name: 'Deployments', to: '/deployments', icon: Ship },
    { name: 'GitOps Controller', to: '/gitops', icon: GitCompare },
    { name: 'Terraform IaC', to: '/terraform', icon: FileCode },
    { name: 'SRE SLO Targets', to: '/sre', icon: HeartPulse },
    { name: 'Resilience Lab', to: '/chaos', icon: Flame },
    { name: 'Monitoring', to: '/monitoring', icon: Activity },
    { name: 'Logs', to: '/logs', icon: Terminal },
    { name: 'AI Assistant', to: '/ai-assistant', icon: Cpu },
    { name: 'Audit Logs', to: '/audit-logs', icon: ShieldCheck },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-border bg-panel/80 backdrop-blur-md">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-secondary">
            <span className="text-sm font-bold text-white">DM</span>
          </div>
          <div>
            <span className="font-bold text-lg text-text">DEPLOYMATE</span>
            <span className="block text-[10px] text-primary-light font-mono -mt-1">ENTERPRISE PLATFORM</span>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border-l-2 border-primary shadow-glow'
                    : 'text-muted hover:bg-slate-800/40 hover:text-text'
                }`
              }
            >
              <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* User Session Info / Logout */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-text border border-border">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <h4 className="truncate text-sm font-medium text-text">{user?.name}</h4>
            <span className="block truncate text-xs text-muted font-mono">{user?.role}</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
