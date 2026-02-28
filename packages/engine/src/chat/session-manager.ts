import type { ChatSession, ChatSessionSnapshot } from '../contracts/chat';
import { hashCanonical, hashSession, stableSort } from './determinism';

/**
 * Chat Session Manager — Deterministic Session Lifecycle
 *
 * Tracks user login/logout and multi-device sessions.
 * All operations produce deterministic snapshots.
 *
 * Key properties:
 * - Multiple sessions per user allowed (multi-device)
 * - Sessions are keyed by deterministic session_id
 * - Snapshots are stable-sorted by session_id
 */

export interface SessionManagerState {
  sessionsByUserId: Map<string, ChatSession[]>;
  sessionsById: Map<string, ChatSession>;
  nextSessionSequence: number;
}

/**
 * Initialize session manager
 */
export function initSessionManager(): SessionManagerState {
  return {
    sessionsByUserId: new Map(),
    sessionsById: new Map(),
    nextSessionSequence: 0,
  };
}

/**
 * Create a new session for user
 *
 * Returns new ChatSession with deterministic ID.
 */
export function startSession(
  manager: SessionManagerState,
  userId: string,
  startedAtMs: number,
  deviceId?: string,
  clientVersion?: string,
): ChatSession {
  // Create session hash (deterministic ID)
  const sessionHash = hashSession(userId, startedAtMs, deviceId);
  const sessionId = `chat:session:${sessionHash}`;

  const session: ChatSession = {
    id: sessionId,
    user_id: userId,
    started_at_ms: startedAtMs,
    last_activity_at_ms: startedAtMs,
    device_id: deviceId,
    client_version: clientVersion,
    session_hash: sessionHash,
  };

  // Store by ID
  manager.sessionsById.set(sessionId, session);

  // Store by user
  if (!manager.sessionsByUserId.has(userId)) {
    manager.sessionsByUserId.set(userId, []);
  }
  manager.sessionsByUserId.get(userId)!.push(session);

  manager.nextSessionSequence += 1;

  return session;
}

/**
 * Update session last activity
 *
 * Called on every message or heartbeat.
 */
export function updateSessionActivity(
  manager: SessionManagerState,
  sessionId: string,
  timestampMs: number,
): ChatSession | undefined {
  const session = manager.sessionsById.get(sessionId);
  if (!session) return undefined;

  // Create updated session
  const updated: ChatSession = {
    ...session,
    last_activity_at_ms: timestampMs,
  };

  manager.sessionsById.set(sessionId, updated);

  // Update in user sessions array
  const userSessions = manager.sessionsByUserId.get(session.user_id);
  if (userSessions) {
    const idx = userSessions.findIndex((s) => s.id === sessionId);
    if (idx >= 0) {
      userSessions[idx] = updated;
    }
  }

  return updated;
}

/**
 * End a session
 *
 * Marks session as ended (soft delete).
 */
export function endSession(
  manager: SessionManagerState,
  sessionId: string,
  endedAtMs: number,
): ChatSession | undefined {
  const session = manager.sessionsById.get(sessionId);
  if (!session) return undefined;

  const updated: ChatSession = {
    ...session,
    ended_at_ms: endedAtMs,
  };

  manager.sessionsById.set(sessionId, updated);

  const userSessions = manager.sessionsByUserId.get(session.user_id);
  if (userSessions) {
    const idx = userSessions.findIndex((s) => s.id === sessionId);
    if (idx >= 0) {
      userSessions[idx] = updated;
    }
  }

  return updated;
}

/**
 * Get session by ID
 */
export function getSession(manager: SessionManagerState, sessionId: string): ChatSession | undefined {
  return manager.sessionsById.get(sessionId);
}

/**
 * Get all active sessions for user
 */
export function getActiveSessions(manager: SessionManagerState, userId: string): ChatSession[] {
  const userSessions = manager.sessionsByUserId.get(userId) ?? [];
  return userSessions.filter((s) => !s.ended_at_ms);
}

/**
 * Get all sessions for user (active + ended)
 */
export function getAllUserSessions(manager: SessionManagerState, userId: string): ChatSession[] {
  return manager.sessionsByUserId.get(userId) ?? [];
}

/**
 * Create deterministic session snapshot
 *
 * Includes all active sessions. Stable-sorted by session_id.
 */
export function createSessionSnapshot(manager: SessionManagerState): ChatSessionSnapshot {
  // Get all active sessions
  const sessions: ChatSession[] = [];
  for (const userSessions of manager.sessionsByUserId.values()) {
    for (const session of userSessions) {
      if (!session.ended_at_ms) {
        sessions.push(session);
      }
    }
  }

  // Stable sort by session_id
  const sorted = stableSort(sessions, 'id');

  // Compute snapshot hash
  const snapshotHash = hashCanonical({
    sessions: sorted,
  });

  const snapshotId = `chat:sess-snap:${snapshotHash}`;

  return {
    snapshot_id: snapshotId,
    sessions: sorted,
    session_count: sorted.length,
    snapshot_hash: snapshotHash,
    snapshot_timestamp_ms: Date.now(),
  };
}

/**
 * Timeout sessions with no activity for duration_ms
 *
 * Returns list of timed-out sessions.
 */
export function timeoutInactiveSessions(
  manager: SessionManagerState,
  inactivityMs: number,
  beforeTimestampMs: number,
): ChatSession[] {
  const timedOut: ChatSession[] = [];

  for (const session of manager.sessionsById.values()) {
    if (session.ended_at_ms) continue; // Already ended

    if (beforeTimestampMs - session.last_activity_at_ms > inactivityMs) {
      const ended = endSession(manager, session.id, beforeTimestampMs);
      if (ended) timedOut.push(ended);
    }
  }

  return timedOut;
}

/**
 * Get total active session count
 */
export function getActiveSessionCount(manager: SessionManagerState): number {
  let count = 0;
  for (const session of manager.sessionsById.values()) {
    if (!session.ended_at_ms) count += 1;
  }
  return count;
}

/**
 * Get active devices for user
 */
export function getUserDevices(manager: SessionManagerState, userId: string): string[] {
  const userSessions = manager.sessionsByUserId.get(userId) ?? [];
  const devices = new Set<string>();
  for (const session of userSessions) {
    if (!session.ended_at_ms && session.device_id) {
      devices.add(session.device_id);
    }
  }
  return Array.from(devices).sort();
}

/**
 * Validate session consistency
 */
export function validateSessionConsistency(
  manager: SessionManagerState,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const session of manager.sessionsById.values()) {
    if (session.started_at_ms > session.last_activity_at_ms) {
      errors.push(
        `Session ${session.id}: started_at (${session.started_at_ms}) > last_activity (${session.last_activity_at_ms})`,
      );
    }

    if (session.ended_at_ms && session.started_at_ms > session.ended_at_ms) {
      errors.push(
        `Session ${session.id}: started_at (${session.started_at_ms}) > ended_at (${session.ended_at_ms})`,
      );
    }

    // Verify session exists in user's sessions list
    const userSessions = manager.sessionsByUserId.get(session.user_id);
    if (!userSessions || !userSessions.some((s) => s.id === session.id)) {
      errors.push(`Session ${session.id}: not found in user ${session.user_id}'s session list`);
    }
  }

  return { valid: errors.length === 0, errors };
}
