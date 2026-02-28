import { Router } from 'express';
import {
    ChannelManagerState,
    initChannelManager
} from '../../chat/channel-manager';
import { hashCanonical } from '../../chat/determinism';
import {
    createMessageSnapshot,
    ingestMessage,
    initMessageStore,
    MessageStoreState
} from '../../chat/message-store';
import {
    createPresenceSnapshot,
    initPresenceTracker,
    PresenceTrackerState,
    updatePresence,
} from '../../chat/presence-tracker';
import {
    initSessionManager,
    SessionManagerState,
    startSession
} from '../../chat/session-manager';
import type {
    ChatLedgerEvent
} from '../../contracts/chat';
import {
    ChatMessageSentEventSchema,
    ChatPresenceChangedEventSchema,
    ChatSessionStartedEventSchema
} from '../../contracts/chat';

/**
 * Chat Engine Router
 *
 * Nucleus tools for deterministic messaging:
 * - chat.send.v1: send message to channel
 * - chat.history.v1: retrieve message history with stable ordering
 * - chat.presence.v1: query who's online in channel(s)
 * - chat.subscribe.v1: subscribe to channel for real-time updates
 */

const router = Router();

/**
 * In-memory state (would be persistent in production)
 */
const chatState = {
  messages: initMessageStore() as MessageStoreState,
  presence: initPresenceTracker() as PresenceTrackerState,
  sessions: initSessionManager() as SessionManagerState,
  channels: initChannelManager() as ChannelManagerState,
  ledger: [] as ChatLedgerEvent[],
};

/**
 * Tool: chat.send.v1 — Send Message
 *
 * POST /chat/send.v1
 *
 * Input:
 *   channel_id: string
 *   sender_id: string
 *   text: string
 *   session_id: string (for activity tracking)
 *
 * Output:
 *   message: ChatMessage (with sequence + hash assigned)
 *   snapshot: ChatMessageSnapshot (channel state after message)
 *   event: ChatMessageSentEvent (ledger entry)
 */
router.post('/chat/send.v1', (req, res) => {
  try {
    const { channel_id, sender_id, text, session_id } = req.body;

    // Validate inputs
    if (!channel_id || !sender_id || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (text.length === 0 || text.length > 4096) {
      return res.status(400).json({ error: 'Text must be 1-4096 characters' });
    }

    // Update session activity if provided
    if (session_id) {
      if (!chatState.sessions.sessionsById.has(session_id)) {
        return res.status(404).json({ error: 'Session not found' });
      }
    }

    const timestampMs = Date.now();

    // Ingest message
    const message = ingestMessage(chatState.messages, {
      id: '', // Will be set by ingestMessage via hash
      channel_id,
      sender_id,
      text,
      timestamp_ms: timestampMs,
      causal_clock: { [sender_id]: Date.now() },
    });

    // Create snapshot after message
    const snapshot = createMessageSnapshot(chatState.messages, channel_id);

    // Create ledger event
    const event = ChatMessageSentEventSchema.parse({
      event_id: `evt:${Date.now()}-${Math.random()}`,
      event_type: 'chat:message:sent.v1',
      message_id: message.id,
      channel_id,
      sender_id,
      text,
      sequence: message.sequence,
      message_hash: message.message_hash,
      event_timestamp_ms: timestampMs,
      deterministic_context: {
        engine_version: '1.0.0',
        tool_id: 'chat.send.v1',
        input_hash: hashCanonical({ channel_id, sender_id, text }),
        output_hash: message.message_hash,
      },
    });

    chatState.ledger.push(event);

    res.status(200).json({
      message,
      snapshot,
      event,
      ledger_size: chatState.ledger.length,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Tool: chat.history.v1 — Get Message History
 *
 * GET /chat/history.v1?channel_id=...&start_seq=0&end_seq=100
 *
 * Output:
 *   snapshot: ChatMessageSnapshot (stable-ordered messages)
 */
router.get('/chat/history.v1', (req, res) => {
  try {
    const { channel_id, start_seq = 0, end_seq = 50 } = req.query;

    if (!channel_id) {
      return res.status(400).json({ error: 'channel_id required' });
    }

    const startSeq = parseInt(String(start_seq), 10);
    const endSeq = parseInt(String(end_seq), 10);

    const snapshot = createMessageSnapshot(
      chatState.messages,
      String(channel_id),
      startSeq,
      endSeq,
    );

    res.status(200).json({
      snapshot,
      message_count: snapshot.message_count,
      snapshot_hash: snapshot.snapshot_hash,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Tool: chat.presence.v1 — Get Presence State
 *
 * GET /chat/presence.v1?channel_id=...
 *
 * Output:
 *   snapshot: ChatPresenceSnapshot (who's online)
 */
router.get('/chat/presence.v1', (req, res) => {
  try {
    const { channel_id } = req.query;

    if (!channel_id) {
      return res.status(400).json({ error: 'channel_id required' });
    }

    const snapshot = createPresenceSnapshot(chatState.presence, String(channel_id));

    res.status(200).json({
      snapshot,
      online_count: snapshot.presences.filter((p) => p.status === 'online').length,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Tool: chat.presence.update.v1 — Update Presence
 *
 * POST /chat/presence/update.v1
 *
 * Input:
 *   user_id: string
 *   channel_id: string
 *   status: 'online' | 'away' | 'offline' | 'dnd'
 *
 * Output:
 *   presence: ChatPresence
 *   event: ChatPresenceChangedEvent
 */
router.post('/chat/presence/update.v1', (req, res) => {
  try {
    const { user_id, channel_id, status } = req.body;

    if (!user_id || !channel_id || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['online', 'away', 'offline', 'dnd'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const timestampMs = Date.now();

    const presence = updatePresence(
      chatState.presence,
      user_id,
      channel_id,
      status as 'online' | 'away' | 'offline' | 'dnd',
      timestampMs,
    );

    const event = ChatPresenceChangedEventSchema.parse({
      event_id: `evt:${Date.now()}-${Math.random()}`,
      event_type: 'chat:presence:changed.v1',
      presence_id: presence.id,
      user_id,
      channel_id,
      new_status: status,
      changed_at_ms: timestampMs,
      presence_hash: presence.presence_hash,
      event_timestamp_ms: timestampMs,
      deterministic_context: {
        engine_version: '1.0.0',
        tool_id: 'chat.presence.update.v1',
      },
    });

    chatState.ledger.push(event);

    res.status(200).json({
      presence,
      event,
      ledger_size: chatState.ledger.length,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Tool: chat.session.start.v1 — Start Session
 *
 * POST /chat/session/start.v1
 *
 * Input:
 *   user_id: string
 *   device_id?: string
 *   client_version?: string
 *
 * Output:
 *   session: ChatSession
 *   event: ChatSessionStartedEvent
 */
router.post('/chat/session/start.v1', (req, res) => {
  try {
    const { user_id, device_id, client_version } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    const timestampMs = Date.now();

    const session = startSession(
      chatState.sessions,
      user_id,
      timestampMs,
      device_id,
      client_version,
    );

    const event = ChatSessionStartedEventSchema.parse({
      event_id: `evt:${Date.now()}-${Math.random()}`,
      event_type: 'chat:session:started.v1',
      session_id: session.id,
      user_id,
      started_at_ms: timestampMs,
      device_id,
      client_version,
      session_hash: session.session_hash,
      event_timestamp_ms: timestampMs,
      deterministic_context: {
        engine_version: '1.0.0',
        tool_id: 'chat.session.start.v1',
      },
    });

    chatState.ledger.push(event);

    res.status(200).json({
      session,
      event,
      active_sessions: chatState.sessions.nextSessionSequence,
      ledger_size: chatState.ledger.length,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Tool: chat.ledger.v1 — Get Ledger Events
 *
 * GET /chat/ledger.v1?limit=100
 *
 * Output:
 *   events: ChatLedgerEvent[]
 *   ledger_size: number
 */
router.get('/chat/ledger.v1', (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const limitNum = Math.min(parseInt(String(limit), 10) || 100, 1000);

    const events = chatState.ledger.slice(-limitNum);

    res.status(200).json({
      events,
      ledger_size: chatState.ledger.length,
      returned: events.length,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export { router as chatRouter, chatState };
