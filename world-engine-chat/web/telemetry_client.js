// UI Integration for Telemetry Relay
// Add this to your web UI JavaScript

class TelemetryClient {
  constructor(relayUrl = 'http://127.0.0.1:3000') {
    this.relayUrl = relayUrl;
    this.ws = null;
    this.sse = null;
    this.pollInterval = null;
    this.lastSeq = 0;
  }

  // WebSocket connection (preferred for real-time)
  connectWS(onEvent, topics = ['diamond.*', 'mirror.*', 'recorder.*']) {
    this.ws = new WebSocket(`${this.relayUrl.replace('http', 'ws')}/ws/telemetry`);

    this.ws.onopen = () => {
      console.log('Telemetry WS connected');
      this.ws.send(JSON.stringify({op: 'subscribe', topics}));
    };

    this.ws.onmessage = (event) => {
      const env = JSON.parse(event.data);
      onEvent(env);
    };

    this.ws.onclose = () => {
      console.log('Telemetry WS disconnected, reconnecting...');
      setTimeout(() => this.connectWS(onEvent, topics), 1000);
    };

    this.ws.onerror = (error) => {
      console.error('Telemetry WS error:', error);
    };
  }

  // Server-Sent Events (fallback for browsers without WS)
  connectSSE(onEvent, topics = 'diamond.*,mirror.*,recorder.*') {
    const url = `${this.relayUrl}/sse/telemetry?topics=${encodeURIComponent(topics)}`;
    this.sse = new EventSource(url);

    this.sse.onmessage = (event) => {
      const env = JSON.parse(event.data);
      onEvent(env);
    };

    this.sse.onerror = (error) => {
      console.error('SSE error, falling back to polling');
      this.startPolling(onEvent, topics);
    };
  }

  // Polling fallback (for older browsers or network issues)
  startPolling(onEvent, topics = 'diamond.*,mirror.*,recorder.*', interval = 5000) {
    this.pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${this.relayUrl}/api/telemetry/poll?since=${this.lastSeq}&topics=${encodeURIComponent(topics)}`
        );
        const data = await response.json();

        data.events.forEach(onEvent);
        this.lastSeq = data.next_since;
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, interval);
  }

  // Hybrid retrieval (semantic + keyword search)
  async retrieve(query, filters = {}, limit = 10) {
    const response = await fetch(`${this.relayUrl}/api/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, filters, limit })
    });
    return await response.json();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
    if (this.sse) {
      this.sse.close();
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}

// Usage example:
/*
const telemetry = new TelemetryClient();

// Real-time events
telemetry.connectWS((event) => {
  console.log('Received event:', event);
  if (event.topic === 'diamond.finding') {
    displayFinding(event.data);
  }
});

// Search
const results = await telemetry.retrieve('performance issues in loops');
console.log('Search results:', results);
*/
