import { Client } from 'pg';
import { WebSocket } from 'ws';
import { resolveRuntimeDbConfig } from '../config/dbRuntimeConfig';

/**
 * Multi-replica safe WebSocket log-stream broadcaster.
 *
 * The interactive log stream Map is process-local by nature (sockets live in
 * this process), but pipeline runs may execute on a different backend replica.
 * Every stream message is therefore published through PostgreSQL
 * LISTEN/NOTIFY: the executing replica sends `pg_notify`, each replica listens
 * and forwards the message to whichever of its own sockets subscribed to the
 * run. This keeps log streaming correct with backend replicas >= 2 without
 * introducing new infrastructure (same shared-database rationale as wsTicketStore).
 */

const CHANNEL = 'pipeline_log_stream';

export const activeLogStreams = new Map<string, Set<WebSocket>>();

export function attachClient(runId: string, ws: WebSocket): void {
  if (!activeLogStreams.has(runId)) {
    activeLogStreams.set(runId, new Set());
  }
  activeLogStreams.get(runId)!.add(ws);
}

export function detachClient(runId: string, ws: WebSocket): void {
  const streams = activeLogStreams.get(runId);
  if (streams) {
    streams.delete(ws);
    if (streams.size === 0) {
      activeLogStreams.delete(runId);
    }
  }
}

function deliverLocally(runId: string, payload: string): void {
  const clients = activeLogStreams.get(runId);
  if (!clients) return;
  clients.forEach((ws) => {
    try {
      ws.send(payload);
    } catch {
      // Socket closed or errored; will be cleaned up on close event.
    }
  });
}

/**
 * Publish a stream message for a pipeline run to every WebSocket client across
 * all backend replicas (Postgres fan-out) and to local clients.
 */
export async function publishToRun(runId: string, message: object): Promise<void> {
  const payload = JSON.stringify(message);
  try {
    // NOTIFY reaches every listening replica, including this one — local
    // delivery happens in the listener callback, so no direct send here.
    // Payload is size-checked because pg_notify truncates beyond 8 KB.
    if (Buffer.byteLength(payload, 'utf8') + runId.length > 7900) {
      deliverLocally(runId, JSON.stringify({ type: 'log', line: '[stream] Message too large to broadcast.\n' }));
      return;
    }
    await new Promise<void>((resolve, reject) => {
      listenerClient.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify({ runId, payload })], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err) {
    // Broadcast transport failure must never crash pipeline execution;
    // fall back to local delivery so at least same-replica clients see output.
    console.error('[LOG_STREAM_BUS] Notify failed, delivering locally only:', (err as Error).message);
    deliverLocally(runId, payload);
  }
}

// --- Dedicated LISTEN connection with reconnect handling -------------------

let listenerClient: Client;
let shuttingDown = false;

function connectListener(): void {
  const runtime = resolveRuntimeDbConfig();
  listenerClient = new Client({
    host: runtime.host,
    port: runtime.port,
    user: runtime.user,
    password: runtime.password,
    database: runtime.database,
  });

  listenerClient.on('notification', (msg) => {
    try {
      if (!msg.payload) return;
      const parsed = JSON.parse(msg.payload) as { runId: string; payload: string };
      deliverLocally(parsed.runId, parsed.payload);
    } catch (err) {
      console.error('[LOG_STREAM_BUS] Malformed notification ignored:', (err as Error).message);
    }
  });

  listenerClient.on('error', (err) => {
    console.error('[LOG_STREAM_BUS] Listener connection error:', err.message);
    if (!shuttingDown) {
      setTimeout(connectListener, 5000);
    }
  });

  listenerClient
    .connect()
    .then(() => listenerClient.query(`LISTEN ${CHANNEL}`))
    .then(() => console.log(`[LOG_STREAM_BUS] Listening on channel "${CHANNEL}".`))
    .catch((err) => {
      console.error('[LOG_STREAM_BUS] Listener connect failed, retrying in 5s:', err.message);
      if (!shuttingDown) {
        setTimeout(connectListener, 5000);
      }
    });
}

connectListener();

export function closeLogStreamBus(): void {
  shuttingDown = true;
  listenerClient.end().catch(() => undefined);
}
