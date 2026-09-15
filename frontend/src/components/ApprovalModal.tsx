import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';

export interface ApprovalModalProps {
  isOpen: boolean;
  title: string;
  actionType: string;
  summary: string;
  evidence?: string[];
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  onApprove: () => void;
  onReject: () => void;
  loading?: boolean;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  isOpen,
  title,
  actionType,
  summary,
  evidence = [],
  riskLevel = 'MEDIUM',
  onApprove,
  onReject,
  loading = false
}) => {
  if (!isOpen) return null;

  const getRiskBadge = () => {
    if (riskLevel === 'HIGH') {
      return <span className="px-2 py-0.5 rounded bg-danger/10 border border-danger/20 text-danger text-[10px] font-mono font-bold">HIGH RISK</span>;
    }
    if (riskLevel === 'MEDIUM') {
      return <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">MEDIUM RISK</span>;
    }
    return <span className="px-2 py-0.5 rounded bg-success/10 border border-success/20 text-success text-[10px] font-mono font-bold">LOW RISK</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="glass-panel w-full max-w-lg p-6 bg-[#090E1A] border-white/10 space-y-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.05] pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-mono text-text">{title}</h3>
              <span className="text-xs text-muted font-mono">{actionType}</span>
            </div>
          </div>
          {getRiskBadge()}
        </div>

        {/* Content Summary */}
        <div className="space-y-3 text-xs">
          <p className="text-slate-300 font-mono leading-relaxed bg-slate-950 p-3 rounded-lg border border-white/[0.04]">
            {summary}
          </p>

          {/* Evidence List */}
          {evidence.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] text-muted font-mono uppercase tracking-wider block">Correlated Telemetry Evidence:</span>
              <div className="bg-slate-950 p-3 rounded-lg border border-white/[0.04] space-y-1 font-mono text-[10px] text-slate-400">
                {evidence.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-primary-light font-bold">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 rounded border border-primary/20 bg-primary/5 flex items-center gap-2 text-[11px] font-mono text-primary-light">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Human-in-the-Loop policy gate active. Action requires explicit user authorization.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onReject}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-slate-900 border border-border text-xs font-mono font-bold text-muted hover:text-text hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-danger" />
              Reject Action
            </div>
          </button>
          
          <button
            onClick={onApprove}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-xs font-mono font-bold text-white hover:opacity-90 transition-opacity shadow-glow"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" />
              {loading ? 'Executing...' : 'Approve & Execute'}
            </div>
          </button>
        </div>

      </div>
    </div>
  );
};
