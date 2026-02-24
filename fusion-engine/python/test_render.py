# test_render.py - Test HTML rendering via WebSocket
import asyncio
import websockets
import json

async def test_render():
    uri = "ws://127.0.0.1:3000/ws/chat"

    async with websockets.connect(uri) as websocket:
        # Send a render HTML command using correct envelope format
        test_html = "<html><body><h1>Test Render</h1><p>This is a test of HTML rendering.</p></body></html>"
        message = {
            "v": "1.0",
            "kind": "chat.request",
            "payload": {
                "text": f"render html {test_html}",
                "convoId": "test-convo"
            }
        }

        await websocket.send(json.dumps(message))
        print("Sent render command")

        # Wait for response
        response = await websocket.recv()
        print(f"Received: {response}")

        # Wait for more messages
        for i in range(5):
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                print(f"Received {i+1}: {response}")
            except asyncio.TimeoutError:
                print(f"No more messages after {i+1}")
                break

if __name__ == "__main__":
    asyncio.run(test_render())
