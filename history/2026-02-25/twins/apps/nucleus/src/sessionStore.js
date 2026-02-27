/**
 * Session Store for WebSocket Hub
 *
 * Manages:
 *   - Session → role, token, capabilities
 *   - Replay protection (nonce cache with TTL)
 *   - Rate limiting (token bucket per session)
 */
const SESSION_NONCE_TTL_MS = 60 * 1000; // 60 seconds
const SESSION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
const RATE_LIMIT_MAX_PER_WINDOW = 100; // 100 messages per second per session
export class SessionStore {
    sessions = new Map();
    nonces = new Map(); // sessionId → nonces
    rateLimits = new Map(); // sessionId → rate limit
    /**
     * Create a new session after handshake
     */
    createSession(sessionId, token, role, capabilities) {
        const now = Date.now();
        const session = {
            sessionId,
            token,
            role,
            capabilities,
            createdAt: now,
            expiresAt: now + SESSION_TOKEN_TTL_MS,
            lastSeenAt: now
        };
        this.sessions.set(sessionId, session);
        this.nonces.set(sessionId, []);
        return session;
    }
    /**
     * Get session by ID, return null if expired
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const now = Date.now();
        if (now > session.expiresAt) {
            this.sessions.delete(sessionId);
            this.nonces.delete(sessionId);
            this.rateLimits.delete(sessionId);
            return null;
        }
        session.lastSeenAt = now;
        return session;
    }
    /**
     * Verify token matches session
     * In production, this would be HMAC-SHA256 or JWT validation
     */
    verifyToken(sessionId, token) {
        const session = this.getSession(sessionId);
        if (!session)
            return false;
        return session.token === token;
    }
    /**
     * Check and register nonce (replay protection)
     *
     * Returns true if nonce is valid (new)
     * Returns false if nonce was already seen (replay attempt)
     */
    checkNonce(sessionId, nonce) {
        const now = Date.now();
        let nonces = this.nonces.get(sessionId);
        if (!nonces) {
            this.nonces.set(sessionId, []);
            nonces = this.nonces.get(sessionId);
        }
        // Clean expired nonces
        nonces = nonces.filter(n => n.expiresAt > now);
        this.nonces.set(sessionId, nonces);
        // Check if nonce exists
        if (nonces.some(n => n.nonce === nonce)) {
            return false; // Replay attempt
        }
        // Add nonce
        nonces.push({
            nonce,
            seenAt: now,
            expiresAt: now + SESSION_NONCE_TTL_MS
        });
        return true; // Nonce is valid
    }
    /**
     * Check rate limit (token bucket)
     *
     * Returns true if within limit
     * Returns false if rate limit exceeded
     */
    checkRateLimit(sessionId) {
        const now = Date.now();
        let limit = this.rateLimits.get(sessionId);
        if (!limit || now - limit.windowStart > RATE_LIMIT_WINDOW_MS) {
            // New window
            this.rateLimits.set(sessionId, { count: 1, windowStart: now });
            return true;
        }
        if (limit.count >= RATE_LIMIT_MAX_PER_WINDOW) {
            return false; // Rate limited
        }
        limit.count++;
        return true;
    }
    /**
     * Invalidate session (on close or logout)
     */
    deleteSession(sessionId) {
        this.sessions.delete(sessionId);
        this.nonces.delete(sessionId);
        this.rateLimits.delete(sessionId);
    }
    /**
     * Cleanup old sessions (call periodically, e.g. every 5 minutes)
     */
    cleanup() {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now > session.expiresAt) {
                this.deleteSession(sessionId);
            }
        }
    }
}
