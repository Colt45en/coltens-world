/**
 * Chat Engine Contracts
 *
 * Deterministic, causally-ordered messaging system.
 * All contracts support content-addressed IDs and replay validation via SHA-256 hashing.
 *
 * Key principles:
 * - Message sequence numbers ensure causal ordering per channel
 * - Vector clocks track cross-channel causality
 * - Every state change is hashed for determinism validation
 * - Presence is ephemeral but deterministically snapshotted
 * - Sessions enable multi-device support with deterministic state
 */

import { ChatMembershipChangedEvent, ChatMessageDeliveredEvent, ChatMessageSentEvent, ChatPresenceChangedEvent, ChatSessionEndedEvent, ChatSessionStartedEvent } from './ledger';

/* Message Contracts */
export {
    BatchChatMessageInputSchema, ChatMessageQuerySchema, ChatMessageReceiptSchema, ChatMessageSchema, ChatMessageSnapshotSchema
} from './message';
export type {
    BatchChatMessageInput, ChatMessage, ChatMessageQuery, ChatMessageReceipt,
    ChatMessageSnapshot
} from './message';

/* Channel Contracts */
export {
    ChatChannelCreateRequestSchema,
    ChatChannelMembershipEventSchema, ChatChannelSchema, ChatChannelSnapshotSchema
} from './channel';
export type {
    ChatChannel,
    ChatChannelCreateRequest,
    ChatChannelMembershipEvent,
    ChatChannelSnapshot
} from './channel';

/* User Contracts */
export {
    ChatUserSchema,
    ChatUserSnapshotSchema
} from './session';
export type {
    ChatUser,
    ChatUserSnapshot
} from './session';

/* Session Contracts */
export {
    ChatSessionEventSchema, ChatSessionSchema, ChatSessionSnapshotSchema
} from './session';
export type {
    ChatSession,
    ChatSessionEvent,
    ChatSessionSnapshot
} from './session';

/* Presence Contracts */
export {
    ChatPresenceEventSchema, ChatPresenceQuerySchema, ChatPresenceSchema, ChatPresenceSnapshotSchema
} from './presence';
export type {
    ChatPresence,
    ChatPresenceEvent, ChatPresenceQuery, ChatPresenceSnapshot
} from './presence';

/* Ledger Events */
export {
    ChatMembershipChangedEventSchema, ChatMessageDeliveredEventSchema, ChatMessageSentEventSchema, ChatPresenceChangedEventSchema, ChatSessionEndedEventSchema, ChatSessionStartedEventSchema
} from './ledger';
export type {
    ChatMembershipChangedEvent, ChatMessageDeliveredEvent, ChatMessageSentEvent, ChatPresenceChangedEvent, ChatSessionEndedEvent, ChatSessionStartedEvent
} from './ledger';

/* Type Unions */
export type ChatLedgerEvent =
  | ChatMessageSentEvent
  | ChatMessageDeliveredEvent
  | ChatPresenceChangedEvent
  | ChatSessionStartedEvent
  | ChatSessionEndedEvent
  | ChatMembershipChangedEvent;
