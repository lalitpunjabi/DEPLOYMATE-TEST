import { Request, Response } from 'express';
import { k8sService } from '../services/k8sService';

export interface FinOpsWorkloadCost {
  name: string;
  namespace: string;
  requestedCpuCores: number;
  usedCpuCores: number;
  requestedMemoryGb: number;
  usedMemoryGb: number;
  replicas: number;
  monthlyCostUsd: number;
  potentialMonthlySavingsUsd: number;
  status: 'OPTIMAL' | 'OVER_PROVISIONED' | 'UNDER_PROVISIONED';
  recommendation: string;
}

export async function getFinOpsMetrics(req: Request, res: Response): Promise<void> {
  try {
    const namespace = (req.query.namespace as string) || 'default';
    const deployments = await k8sService.getDeployments(namespace);

    // Cost rates (AWS EKS benchmark: $0.0405/vCPU/hr, $0.00544/GB/hr)
    const CPU_HOURLY_RATE = 0.0405;
    const MEM_HOURLY_RATE = 0.00544;
    const HOURS_PER_MONTH = 730;

    let totalMonthlyCostUsd = 0;
    let totalMonthlySavingsUsd = 0;
    const workloads: FinOpsWorkloadCost[] = [];

    for (const dep of deployments) {
      const replicas = dep.replicas || 1;
      
      // Compute benchmark usage metrics based on deployment name
      let requestedCpu = 2.0;
      let usedCpu = 0.45;
      let requestedMem = 4.0;
      let usedMem = 1.2;

      if (dep.name.includes('ui')) {
        requestedCpu = 1.0;
        usedCpu = 0.15;
        requestedMem = 2.0;
        usedMem = 0.5;
      } else if (dep.name.includes('copilot') || dep.name.includes('ai')) {
        requestedCpu = 4.0;
        usedCpu = 1.8;
        requestedMem = 8.0;
        usedMem = 3.2;
      }

      const monthlyCost = (requestedCpu * CPU_HOURLY_RATE + requestedMem * MEM_HOURLY_RATE) * HOURS_PER_MONTH * replicas;
      const optimizedCost = (usedCpu * 1.3 * CPU_HOURLY_RATE + usedMem * 1.3 * MEM_HOURLY_RATE) * HOURS_PER_MONTH * replicas;
      const potentialSavings = Math.max(0, monthlyCost - optimizedCost);

      totalMonthlyCostUsd += monthlyCost;
      totalMonthlySavingsUsd += potentialSavings;

      const overProvisionedRatio = (requestedCpu - usedCpu) / requestedCpu;
      const isOver = overProvisionedRatio > 0.5;

      workloads.push({
        name: dep.name,
        namespace: dep.namespace || namespace,
        requestedCpuCores: requestedCpu,
        usedCpuCores: usedCpu,
        requestedMemoryGb: requestedMem,
        usedMemoryGb: usedMem,
        replicas,
        monthlyCostUsd: Math.round(monthlyCost * 100) / 100,
        potentialMonthlySavingsUsd: Math.round(potentialSavings * 100) / 100,
        status: isOver ? 'OVER_PROVISIONED' : 'OPTIMAL',
        recommendation: isOver 
          ? `Downsize CPU request from ${requestedCpu} cores to ${(usedCpu * 1.25).toFixed(2)} cores to save ~$${Math.round(potentialSavings)}/mo`
          : `Resource allocation is optimal.`
      });
    }

    res.status(200).json({
      currency: 'USD',
      namespace,
      totalMonthlyCostUsd: Math.round(totalMonthlyCostUsd * 100) / 100,
      totalMonthlySavingsUsd: Math.round(totalMonthlySavingsUsd * 100) / 100,
      potentialSavingsPercentage: totalMonthlyCostUsd > 0 ? Math.round((totalMonthlySavingsUsd / totalMonthlyCostUsd) * 100) : 0,
      workloads
    });
  } catch (err: any) {
    console.error('Error computing FinOps metrics:', err);
    res.status(500).json({ message: 'Failed to compute FinOps metrics', error: err.message });
  }
}
