import { Request, Response } from 'express';
import { aiService } from '../services/aiService';
import { sendSafeError } from '../utils/securityUtils';

const MAX_PROMPT_LENGTH = 4000;
const MAX_LOG_LENGTH = 50000;
const MAX_CONFIG_LENGTH = 50000;
const MAX_HISTORY_ITEMS = 20;

export async function failureAnalysis(req: Request, res: Response): Promise<void> {
  const { logs } = req.body;
  if (!logs || typeof logs !== 'string') {
    res.status(400).json({ message: 'logs string parameter is required.' });
    return;
  }
  if (logs.length > MAX_LOG_LENGTH) {
    res.status(400).json({ message: `Logs input size exceeds maximum allowed length of ${MAX_LOG_LENGTH} characters.` });
    return;
  }
  try {
    const analysis = await aiService.analyzeFailure(logs);
    res.status(200).json(analysis);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to process logs failure analysis.', 500);
  }
}

export async function logAnalysis(req: Request, res: Response): Promise<void> {
  const { logs } = req.body;
  if (!logs || typeof logs !== 'string') {
    res.status(400).json({ message: 'logs string parameter is required.' });
    return;
  }
  if (logs.length > MAX_LOG_LENGTH) {
    res.status(400).json({ message: `Logs input size exceeds maximum allowed length of ${MAX_LOG_LENGTH} characters.` });
    return;
  }
  try {
    const analysis = await aiService.analyzeLogs(logs);
    res.status(200).json(analysis);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to process app logs analysis.', 500);
  }
}

export async function riskAssessment(req: Request, res: Response): Promise<void> {
  const { config_yaml } = req.body;
  if (!config_yaml || typeof config_yaml !== 'string') {
    res.status(400).json({ message: 'config_yaml parameter is required.' });
    return;
  }
  if (config_yaml.length > MAX_CONFIG_LENGTH) {
    res.status(400).json({ message: `Config YAML input size exceeds maximum allowed length of ${MAX_CONFIG_LENGTH} characters.` });
    return;
  }
  try {
    const assessment = await aiService.assessRisk(config_yaml);
    res.status(200).json(assessment);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to assess manifest risks.', 500);
  }
}

export async function pipelineGenerator(req: Request, res: Response): Promise<void> {
  const { project_type } = req.body;
  if (!project_type || typeof project_type !== 'string') {
    res.status(400).json({ message: 'project_type parameter is required.' });
    return;
  }
  if (project_type.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ message: `Project type prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters.` });
    return;
  }
  try {
    const pipeline = await aiService.generatePipeline(project_type);
    res.status(200).json(pipeline);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to generate pipeline workflow.', 500);
  }
}

export async function chatAssistant(req: Request, res: Response): Promise<void> {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string') {
    res.status(400).json({ message: 'message string is required.' });
    return;
  }
  if (message.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ message: `Chat message exceeds maximum allowed length of ${MAX_PROMPT_LENGTH} characters.` });
    return;
  }
  if (history && Array.isArray(history) && history.length > MAX_HISTORY_ITEMS) {
    res.status(400).json({ message: `Chat history exceeds maximum allowed limit of ${MAX_HISTORY_ITEMS} messages.` });
    return;
  }
  try {
    const reply = await aiService.chat(message, history || []);
    res.status(200).json(reply);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to process chat query.', 500);
  }
}

