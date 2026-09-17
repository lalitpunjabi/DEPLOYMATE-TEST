import { Request, Response } from 'express';
import { policyEngine } from '../services/policyEngine';

export async function listPolicies(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    rules: policyEngine.getRules()
  });
}

export async function evaluatePolicy(req: Request, res: Response): Promise<void> {
  const { content, type } = req.body;
  
  if (!content) {
    res.status(400).json({ message: 'Content is required for policy evaluation' });
    return;
  }

  const evalType = type === 'terraform' ? 'terraform' : 'k8s';
  const result = policyEngine.evaluate(content, evalType);

  res.status(200).json(result);
}
