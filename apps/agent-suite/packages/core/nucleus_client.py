"""
Nucleus Communication Client for Agent Suite

Connects the agent framework to the Nucleus WebSocket hub for:
- Receiving tool execution requests
- Sending tool results back to nucleus
- Handling real-time communication with the world-engine system
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timezone

import websockets
from websockets.client import ClientConnection
from websockets.exceptions import ConnectionClosedError

from packages.core.action_schema import Action
from packages.core.contracts import Observation

logger = logging.getLogger(__name__)

@dataclass
class BusEnvelope:
    """Bus envelope format for nucleus communication"""
    v: str = "1.0"
    id: str = ""
    ts: str = ""
    traceId: str = ""
    source: str = "agent-suite"
    kind: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)

class NucleusClient:
    """WebSocket client for communicating with Nucleus"""

    def __init__(self, nucleus_url: str = "ws://localhost:3000/ws/bus"):
        self.nucleus_url = nucleus_url
        self.websocket: Optional[ClientConnection] = None
        self.connected = False
        self.welcomed = False
        self.session_id = ""
        self.token = ""
        self.message_handlers: Dict[str, Callable[[Dict[str, Any], str], Awaitable[None]]] = {}

    async def connect(self) -> None:
        """Connect to nucleus WebSocket hub"""
        try:
            self.websocket = await websockets.connect(self.nucleus_url)
            self.connected = True
            logger.info(f"Connected to nucleus at {self.nucleus_url}")

            # Send handshake
            await self._send_handshake()

            # Register default message handlers
            self.register_handler("system.welcome", self._handle_welcome)
            self.register_handler("tool.execute", self._handle_tool_execute)
            self.register_handler("agent.observe", self._handle_observe_request)

            # Start message loop
            await self._message_loop()

        except Exception as e:
            logger.error(f"Failed to connect to nucleus: {e}")
            self.connected = False
            raise

    async def _send_handshake(self) -> None:
        """Send initial handshake to establish role"""
        import uuid
        handshake = {
            "v": 2,
            "id": f"hello-{uuid.uuid4().hex[:8]}",
            "type": "system.hello",
            "ts": int(time.time() * 1000),
            "from": {"role": "preview", "instanceId": f"agent-suite-{uuid.uuid4().hex[:8]}"},
            "sessionId": "pending",  # Will be assigned by server
            "client_seq": 1,
            "payload": {"requestedRole": "preview"}
        }
        await self.websocket.send(json.dumps(handshake))
        logger.info("Sent handshake to nucleus")

    async def _handle_welcome(self, payload: Dict[str, Any], _trace_id: str) -> None:
        """Handle welcome message from nucleus"""
        self.session_id = payload.get("sessionId", "")
        auth = payload.get("auth", {})
        self.token = auth.get("token", "")
        self.welcomed = True
        logger.info(f"Welcomed by nucleus with session {self.session_id}")

    async def disconnect(self) -> None:
        """Disconnect from nucleus"""
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            logger.info("Disconnected from nucleus")

    def register_handler(self, message_type: str, handler: Callable[[Dict[str, Any], str], Awaitable[None]]) -> None:
        """Register a handler for a specific message type"""
        self.message_handlers[message_type] = handler

    async def send_message(self, envelope: BusEnvelope) -> None:
        """Send a message to nucleus"""
        if not self.connected or not self.websocket or not self.welcomed:
            raise ConnectionError("Not connected or not welcomed by nucleus")

        # Set timestamp if not provided
        if not envelope.ts:
            envelope.ts = datetime.now(timezone.utc).isoformat() + "Z"

        # Generate ID if not provided
        if not envelope.id:
            import uuid
            envelope.id = f"env-{uuid.uuid4().hex[:8]}"

        message = {
            "v": 2,
            "id": envelope.id,
            "ts": envelope.ts,
            "type": envelope.kind,
            "from": {"role": "preview", "instanceId": f"agent-suite-{id(self)}"},
            "sessionId": self.session_id,
            "auth": {"kind": "session", "token": self.token},
            "payload": envelope.payload
        }

        await self.websocket.send(json.dumps(message))
        logger.debug(f"Sent message: {envelope.kind}")

    async def _message_loop(self) -> None:
        """Main message processing loop"""
        try:
            while self.connected and self.websocket is not None:
                message: str = await self.websocket.recv()
                await self._process_message(message)
        except ConnectionClosedError:
            logger.warning("Nucleus connection closed")
            self.connected = False
        except Exception as e:
            logger.error(f"Error in message loop: {e}")
            self.connected = False

    async def _process_message(self, message: str) -> None:
        """Process incoming message from nucleus"""
        try:
            data = json.loads(message)
            message_type = data.get("kind", "")
            payload = data.get("payload", {})
            trace_id = data.get("traceId", "")

            logger.debug(f"Received message: {message_type}")

            # Call registered handler
            if message_type in self.message_handlers:
                await self.message_handlers[message_type](payload, trace_id)
            else:
                logger.warning(f"No handler for message type: {message_type}")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message: {e}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")

    async def _handle_tool_execute(self, payload: Dict[str, Any], trace_id: str) -> None:
        """Handle tool execution request from nucleus"""
        action_data: Dict[str, Any] = {}
        try:
            action_data = payload.get("action", {})
            action = Action(**action_data)

            # Execute the action using the agent framework
            result = await self._execute_action(action)

            # Send result back to nucleus
            response = BusEnvelope(
                traceId=trace_id,
                kind="tool.result",
                payload={
                    "action": action_data,
                    "result": result,
                    "success": True
                }
            )
            await self.send_message(response)

        except Exception as e:
            logger.error(f"Error executing tool: {e}")
            # Send error response
            response = BusEnvelope(
                traceId=trace_id,
                kind="tool.result",
                payload={
                    "action": action_data,
                    "error": str(e),
                    "success": False
                }
            )
            await self.send_message(response)

    async def _handle_observe_request(self, _payload: Dict[str, Any], trace_id: str) -> None:
        """Handle observation request from nucleus"""
        try:
            observation = await self._get_observation()

            response = BusEnvelope(
                traceId=trace_id,
                kind="agent.observation",
                payload={
                    "observation": observation.__dict__ if observation else None
                }
            )
            await self.send_message(response)

        except Exception as e:
            logger.error(f"Error getting observation: {e}")

    async def _execute_action(self, action: Action) -> Dict[str, Any]:
        """Execute an action using the agent framework"""
        # This should be implemented to use the actual agent drivers
        # For now, return a mock result
        logger.info(f"Executing action: {action.kind}")

        # Import and use the appropriate driver based on action
        if action.kind in ["click", "type", "press"]:
            # Use desktop driver
            from packages.drivers.desktop_windows_uia.driver import DesktopDriver
            driver = DesktopDriver()
            result = await driver.execute_action(action)
        elif action.kind in ["launch", "focus"]:
            # Use appropriate driver
            result = {"status": "executed", "action": action.kind}
        else:
            result = {"status": "unknown_action", "action": action.kind}

        return result

    async def _get_observation(self) -> Optional[Observation]:
        """Get current observation from the environment"""
        # This should be implemented to use the appropriate observation driver
        from packages.drivers.desktop_windows_uia.driver import DesktopDriver
        driver = DesktopDriver()
        return await driver.get_observation()

# Global client instance
nucleus_client = NucleusClient()

async def start_nucleus_client() -> None:
    """Start the nucleus client connection"""
    await nucleus_client.connect()

async def stop_nucleus_client() -> None:
    """Stop the nucleus client connection"""
    await nucleus_client.disconnect()

if __name__ == "__main__":
    # Test the client
    logging.basicConfig(level=logging.INFO)

    async def test():
        await start_nucleus_client()
        # Keep running
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            await stop_nucleus_client()

    asyncio.run(test())
