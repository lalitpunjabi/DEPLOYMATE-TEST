import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_REQUEST_TIMEOUT_MS = 30000;

/**
 * Raised whenever the AI microservice cannot produce a real response
 * (unreachable, timeout, or non-2xx). Hardening spec §5: the platform must
 * NEVER fall back to unlabeled mock/fabricated AI diagnostics. Controllers
 * translate this into an honest HTTP 503 with `execution_mode: "DEGRADED"`.
 */
export class AiUnavailableError extends Error {
  public readonly execution_mode = 'DEGRADED' as const;

  constructor(public readonly feature: string, cause?: unknown) {
    super(`AI service is unavailable for "${feature}".`);
    this.name = 'AiUnavailableError';
    const reason = cause instanceof Error ? cause.message : String(cause ?? '');
    if (reason) {
      console.warn(`[AI] ${this.message} Reason: ${reason}`);
    } else {
      console.warn(`[AI] ${this.message}`);
    }
  }
}

function isAiUnavailable(err: unknown): err is AiUnavailableError {
  return err instanceof AiUnavailableError || (err as any)?.name === 'AiUnavailableError';
}

export { isAiUnavailable };

function getAiInternalToken(): string {
  const token = process.env.AI_INTERNAL_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'FATAL SECURITY ERROR: AI_INTERNAL_TOKEN is required. Set a unique token in the environment; no built-in default exists.'
    );
  }
  return token;
}

class AiService {
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Internal-Token': getAiInternalToken(),
    };
  }

  /**
   * Single honest gateway to the AI module. Returns the parsed response with
   * the module's `engine` label (LIVE when Gemini truly executed, SIMULATED
   * when the built-in simulator answered). Throws on any failure — callers
   * must surface DEGRADED, never fabricate.
   */
  private async post<T extends { engine?: string }>(feature: string, endpoint: string, body: Record<string, unknown>): Promise<T & { execution_mode: 'LIVE' | 'SIMULATED' }> {
    let res: Response;
    try {
      res = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new AiUnavailableError(feature, err);
    }

    if (!res.ok) {
      throw new AiUnavailableError(feature, new Error(`AI module responded with HTTP ${res.status}`));
    }

    let data: T;
    try {
      data = (await res.json()) as T;
    } catch (err) {
      throw new AiUnavailableError(feature, err);
    }

    const execution_mode = data && data.engine === 'LIVE' ? 'LIVE' : 'SIMULATED';
    return { ...data, execution_mode };
  }

  public async analyzeFailure(logs: string) {
    return this.post('Pipeline Failure Analysis', '/api/v1/ai/pipeline-failure-analysis', { logs });
  }

  public async analyzeLogs(logs: string) {
    return this.post('Log Analysis', '/api/v1/ai/log-analysis', { logs });
  }

  public async assessRisk(configYaml: string) {
    return this.post('Deployment Risk Assessment', '/api/v1/ai/deployment-risk', { config_yaml: configYaml });
  }

  public async generatePipeline(projectType: string) {
    return this.post('Pipeline Generator', '/api/v1/ai/generate-pipeline', { project_type: projectType });
  }

  public async chat(message: string, history: any[]) {
    return this.post('Chat Assistant', '/api/v1/ai/chat', { message, history });
  }
}

export const aiService = new AiService();
