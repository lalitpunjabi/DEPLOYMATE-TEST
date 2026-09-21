import crypto from 'crypto';
import { query } from '../config/db';
import { hashToken } from '../utils/securityUtils';

/**
 * Shared, multi-replica safe WebSocket ticket store.
 *
 * Architecture decision (documented per hardening spec §3):
 * The backend already requires PostgreSQL as shared state, so tickets are stored
 * there instead of introducing a Redis deployment. This satisfies the same
 * requirements with zero new infrastructure:
 *   - Backend replica A creates ticket → row is visible to replica B (shared DB).
 *   - Atomic single-use consumption → DELETE ... RETURNING is atomic in
 *     PostgreSQL, so concurrent replays of the same ticket can consume it once.
 *   - 60-second expiration enforced in SQL (expires_at > NOW()).
 *   - Only the SHA-256 hash of the ticket is persisted (leaked rows cannot be replayed).
 *
 * If Redis is later introduced, only this module needs to change.
 */

export interface WsTicketRecord {
  userId: string;
  projectId: string | null;
  allowsTerminal: boolean;
}

export const WS_TICKET_TTL_SECONDS = 60;

export async function createWsTicket(
  userId: string,
  options: { projectId?: string | null; allowsTerminal?: boolean } = {}
): Promise<string> {
  const ticket = crypto.randomBytes(24).toString('hex');
  const ticketHash = hashToken(ticket);

  // Opportunistic cleanup of expired tickets keeps the table bounded without a cron.
  await query('DELETE FROM ws_tickets WHERE expires_at < NOW() - INTERVAL \'1 hour\'');

  await query(
    `INSERT INTO ws_tickets (ticket_hash, user_id, project_id, allows_terminal, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + make_interval(secs => $5))`,
    [
      ticketHash,
      userId,
      options.projectId ?? null,
      options.allowsTerminal === true,
      WS_TICKET_TTL_SECONDS,
    ]
  );

  return ticket;
}

/**
 * Atomically consumes a single-use ticket. Returns the associated user/project
 * only if the ticket exists, is unexpired, and had not been used before.
 * Replay protection: a second concurrent call for the same ticket returns null.
 */
export async function consumeWsTicket(ticket: string | null | undefined): Promise<WsTicketRecord | null> {
  if (!ticket || typeof ticket !== 'string' || !/^[0-9a-f]{48}$/.test(ticket)) {
    return null; // malformed ticket rejected without touching the DB
  }

  const ticketHash = hashToken(ticket);
  const res = await query(
    `DELETE FROM ws_tickets
      WHERE ticket_hash = $1 AND expires_at > NOW()
      RETURNING user_id, project_id, allows_terminal`,
    [ticketHash]
  );

  if (!res.rowCount || res.rowCount === 0) {
    return null;
  }

  const row = res.rows[0];
  return {
    userId: row.user_id,
    projectId: row.project_id ?? null,
    allowsTerminal: row.allows_terminal === true,
  };
}
