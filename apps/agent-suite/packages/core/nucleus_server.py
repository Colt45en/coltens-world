"""
Nucleus Communication Server for Agent Suite

Provides HTTP server for tool execution requests from Nucleus.
Nucleus can POST tool execution requests to the agent service.
"""

import asyncio
import logging
from typing import Any, Dict

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from packages.core.action_schema import Action

logger = logging.getLogger(__name__)


class ToolExecuteRequest(BaseModel):
    """Tool execution request from nucleus"""

    action: Dict[str, Any]
    trace_id: str
    session_id: str


class NucleusAgentServer:
    """HTTP server for receiving tool execution requests from nucleus"""

    def __init__(self, host: str = "127.0.0.1", port: int = 3001):
        self.host = host
        self.port = port
        self.app = FastAPI(title="Agent Suite", version="1.0.0")

        # Register routes
        self._setup_routes()

    def _setup_routes(self) -> None:
        """Set up FastAPI routes"""

        @self.app.post("/tool/execute")
        async def execute_tool(request: ToolExecuteRequest) -> Dict[str, Any]:
            """Execute a tool and return the result"""
            try:
                action_data = request.action
                action = Action(**action_data)

                # Execute the action
                result = await self._execute_action(action)

                return {
                    "action": action_data,
                    "result": result,
                    "success": True,
                    "trace_id": request.trace_id,
                }

            except Exception as e:
                logger.error(f"Error executing tool: {e}")
                return {
                    "action": request.action,
                    "error": str(e),
                    "success": False,
                    "trace_id": request.trace_id,
                }

        @self.app.get("/health")
        async def health_check() -> Dict[str, str]:
            """Health check endpoint"""
            return {"status": "healthy"}

    async def _execute_action(self, action: Action) -> Dict[str, Any]:
        """Execute an action using the agent framework"""
        logger.info(f"Executing action: {action.kind}")

        # Import and use the appropriate driver based on action
        try:
            if action.kind in ["click", "type", "press"]:
                # For now, return a mock result since the desktop driver needs implementation
                result = {
                    "status": "mock_executed",
                    "action": action.kind,
                    "target": action.target,
                }
            elif action.kind == "launch":
                # Use notepad demo as an example
                from packages.drivers.desktop_windows_uia.driver import notepad_demo

                demo_result = notepad_demo()
                result = {"status": "demo_executed", "result": demo_result.__dict__}
            elif action.kind == "focus":
                result = {"status": "executed", "action": action.kind}
            else:
                result = {"status": "unknown_action", "action": action.kind}
        except Exception as e:
            logger.error(f"Error in action execution: {e}")
            result = {"status": "error", "error": str(e)}

        return result

    async def start(self) -> None:
        """Start the HTTP server"""
        logger.info(f"Starting Agent Suite server on {self.host}:{self.port}")
        config = uvicorn.Config(
            self.app, host=self.host, port=self.port, log_level="info"
        )
        server = uvicorn.Server(config)
        await server.serve()


# Global server instance
agent_server = NucleusAgentServer()


async def start_agent_server() -> None:
    """Start the agent HTTP server"""
    await agent_server.start()


if __name__ == "__main__":
    # Test the server
    logging.basicConfig(level=logging.INFO)
    asyncio.run(start_agent_server())
