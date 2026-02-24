#!/usr/bin/env python3
"""
Agent Suite Main Entry Point

Starts the agent framework with HTTP server for nucleus communication.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add packages to path
sys.path.insert(0, str(Path(__file__).parent / "packages"))

from packages.core.nucleus_server import start_agent_server

async def main():
    """Main entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger = logging.getLogger(__name__)
    logger.info("Starting Agent Suite HTTP server for Nucleus communication")
    logger.info("Agent will be available at http://127.0.0.1:3001")
    logger.info("Health check: http://127.0.0.1:3001/health")
    logger.info("Tool execution: POST http://127.0.0.1:3001/tool/execute")

    try:
        await start_agent_server()
    except KeyboardInterrupt:
        logger.info("Shutting down Agent Suite")
    except Exception as e:
        logger.error(f"Error running Agent Suite: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
