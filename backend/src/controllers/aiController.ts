import { Request, Response } from 'express';
import { aiService } from '../services/aiService';

export async function failureAnalysis(req: Request, res: Response): Promise<void> {
  const { logs } = req.body;
  if (!logs) {
    res.status(400).json({ message: 'logs string parameter is required.' });
    return;
  }
  try {
    const analysis = await aiService.analyzeFailure(logs);
    res.status(200).json(analysis);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to process logs failure analysis.', error: error.message });
  }
}

export async function logAnalysis(req: Request, res: Response): Promise<void> {
  const { logs } = req.body;
  if (!logs) {
    res.status(400).json({ message: 'logs string parameter is required.' });
    return;
  }
  try {
    const analysis = await aiService.analyzeLogs(logs);
    res.status(200).json(analysis);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to process app logs analysis.', error: error.message });
  }
}

export async function riskAssessment(req: Request, res: Response): Promise<void> {
  const { config_yaml } = req.body;
  if (!config_yaml) {
    res.status(400).json({ message: 'config_yaml parameter is required.' });
    return;
  }
  try {
    const assessment = await aiService.assessRisk(config_yaml);
    res.status(200).json(assessment);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to assess manifest risks.', error: error.message });
  }
}

export async function pipelineGenerator(req: Request, res: Response): Promise<void> {
  const { project_type } = req.body;
  if (!project_type) {
    res.status(400).json({ message: 'project_type parameter is required.' });
    return;
  }
  try {
    const pipeline = await aiService.generatePipeline(project_type);
    res.status(200).json(pipeline);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to generate pipeline workflow.', error: error.message });
  }
}

export async function chatAssistant(req: Request, res: Response): Promise<void> {
  const { message, history } = req.body;
  if (!message) {
    res.status(400).json({ message: 'message string is required.' });
    return;
  }
  try {
    const reply = await aiService.chat(message, history || []);
    res.status(200).json(reply);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to process chat query.', error: error.message });
  }
}
