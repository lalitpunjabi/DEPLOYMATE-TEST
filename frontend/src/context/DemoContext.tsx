import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface DemoContextType {
  isDemoMode: boolean;
  demoStage: number; // 0 to 8
  demoLogs: string[];
  demoProgress: number;
  isSimulating: boolean;
  setDemoMode: (val: boolean) => void;
  startSimulation: () => void;
  stopSimulation: () => void;
  resetDemo: () => void;
  setStageDirectly: (stage: number) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoStage, setDemoStage] = useState(0);
  const [demoLogs, setDemoLogs] = useState<string[]>([]);
  const [demoProgress, setDemoProgress] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const timerRef = useRef<any>(null);
  const progressTimerRef = useRef<any>(null);

  const addLog = (log: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDemoLogs((prev) => [...prev, `[${timestamp}] ${log}`]);
  };

  const setStageDirectly = (stage: number) => {
    setDemoStage(stage);
    setDemoProgress(0);
    
    // Seed appropriate logs
    if (stage === 1) {
      addLog("GitHub Push: Webhook received. Commit 'sha-8f2a10' registered.");
    } else if (stage === 2) {
      addLog("Security Scan: Trivy scanner triggered. Auditing package.json dependencies...");
    } else if (stage === 3) {
      addLog("Docker Build: Creating multi-stage production bundle node:22-alpine...");
    } else if (stage === 4) {
      addLog("GitOps Sync: Dispaching webhook. ArgoCD state comparison active.");
    } else if (stage === 5) {
      addLog("Drift Alert: Out-of-sync parameters discovered. Replica check: Requested 3, Live 1.");
    } else if (stage === 6) {
      addLog("K8s Rollout: Pod container crashed. CrashLoopBackOff: OOMKilled.");
    } else if (stage === 7) {
      addLog("AI Diagnostics: Gemini Model active. Diagnosing connection variables...");
    } else if (stage === 8) {
      addLog("Self-Healing: Automated mitigation triggered. Rolling back to git-sha-stable.");
    }
  };

  const resetDemo = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setDemoStage(0);
    setDemoProgress(0);
    setIsSimulating(false);
    setDemoLogs([`[${new Date().toLocaleTimeString()}] System Initialized. Command Center Ready.`]);
  };

  const stopSimulation = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setIsSimulating(false);
    addLog("Simulation Paused by Operator.");
  };

  const startSimulation = () => {
    resetDemo();
    setIsSimulating(true);
    setIsDemoMode(true);
    
    let currentStage = 1;
    setStageDirectly(1);
    addLog("E2E CENTERPIECE WORKFLOW INITIATED.");

    // Dynamic progress bar updates
    let progressVal = 0;
    progressTimerRef.current = setInterval(() => {
      progressVal += 4;
      if (progressVal > 100) progressVal = 0;
      setDemoProgress(progressVal);
    }, 150);

    timerRef.current = setInterval(() => {
      currentStage += 1;
      if (currentStage > 8) {
        clearInterval(timerRef.current!);
        clearInterval(progressTimerRef.current!);
        setIsSimulating(false);
        setDemoProgress(100);
        addLog("E2E PLATFORM ENGINEERING WORKFLOW COMPLETE. STATE STABILIZED.");
      } else {
        setStageDirectly(currentStage);
      }
    }, 6000); // 6 seconds per stage simulation
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  return (
    <DemoContext.Provider value={{
      isDemoMode,
      demoStage,
      demoLogs,
      demoProgress,
      isSimulating,
      setDemoMode: setIsDemoMode,
      startSimulation,
      stopSimulation,
      resetDemo,
      setStageDirectly
    }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};
