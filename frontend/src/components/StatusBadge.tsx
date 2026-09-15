import React from 'react';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = (status || '').toUpperCase();

  let styles = 'bg-slate-900 border-border text-muted';

  if (['RUNNING', 'SYNCING', 'PENDING', 'SCHEDULED'].includes(normalized)) {
    styles = 'bg-primary/10 border-primary/20 text-primary-light animate-pulse';
  } else if (['SUCCESS', 'SYNCED', 'HEALTHY', 'DEPLOYED', 'PASSED', 'RESOLVED', 'COMPLETED'].includes(normalized)) {
    styles = 'bg-success/10 border-success/20 text-success';
  } else if (['FAILED', 'OUTOFSYNC', 'CRITICAL', 'P1', 'DRIFT_DETECTED', 'POLICY_BLOCKED'].includes(normalized)) {
    styles = 'bg-danger/10 border-danger/20 text-danger';
  } else if (['WARN', 'WARNING', 'P2', 'HIGH'].includes(normalized)) {
    styles = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-mono font-bold uppercase tracking-wider ${styles} ${sizeClasses}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
};
