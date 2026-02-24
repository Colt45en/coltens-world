# test_render_file.py - Test HTML file rendering via WebSocket
import asyncio
import websockets
import json
from typing import TypedDict

class MessagePayload(TypedDict):
    text: str
    convoId: str

class Message(TypedDict):
    v: str
    kind: str
    payload: MessagePayload

async def test_render_file():
    uri = "ws://127.0.0.1:3000/ws/chat"

    async with websockets.connect(uri) as websocket:
        # Send a render file command using correct envelope format
        message: Message = {
            "v": "1.0",
            "kind": "chat.request",
            "payload": {
                "text": "render file test_file_render.html",
                "convoId": "test-convo"
            }
        }

        await websocket.send(json.dumps(message))
        print("Sent render file command")

        # Wait for response with timeout
        try:
            response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
            print(f"Received: {response}")
        except asyncio.TimeoutError:
            print("Timeout waiting for response")

if __name__ == "__main__":
    asyncio.run(test_render_file())
