import { query } from '../config/db';

export interface GlobalEventPayload {
  eventType: string;
  source: 'kubernetes' | 'pipeline' | 'gitops' | 'terraform' | 'sre' | 'ai' | 'chaos' | 'system';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  resource: string;
  namespace?: string;
  metadata?: Record<string, any>;
}

export class EventBus {
  public static async emit(event: GlobalEventPayload): Promise<void> {
    const { eventType, source, severity, resource, namespace, metadata } = event;
    const ns = namespace || 'default';
    const payloadJson = JSON.stringify(metadata || {});

    console.log(`[EVENT_BUS] [${severity}] ${eventType} from ${source} on ${resource} (${ns})`);

    try {
      await query(
        `INSERT INTO global_events (event_type, source, severity, resource, namespace, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [eventType, source, severity, resource, ns, payloadJson]
      );
    } catch (err: any) {
      console.error('[EVENT_BUS] Failed to persist global event:', err.message);
    }
  }

  public static async getRecentEvents(limit: number = 50): Promise<any[]> {
    try {
      const res = await query(
        `SELECT * FROM global_events ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return res.rows;
    } catch (err: any) {
      console.error('[EVENT_BUS] Failed to fetch events:', err.message);
      return [];
    }
  }
}
