# Agent Tools in Chat

The World Engine chat now supports agent tools for desktop automation. You can call agent tools directly in chat conversations.

## Available Agent Tools

- `agent_launch` - Launch applications
- `agent_click` - Click on UI elements
- `agent_type` - Type text
- `agent_press` - Press keys
- `agent_focus` - Focus windows/applications

## How to Use

Simply mention the tool in your chat message. For example:

- "Launch Notepad"
- "Click on the save button"
- "Type 'Hello World' in the text field"
- "Press Enter"
- "Focus the browser window"

The AI will automatically detect when to call agent tools and execute them through the agent server.

## Technical Details

- Agent server runs on `http://127.0.0.1:3001`
- Tools are prefixed with `agent_` in the chat system
- Actions are converted to the agent's Action format
- Results are returned to the chat interface

## Status

✅ Agent server integrated with nucleus
✅ Chat interface supports agent tools
✅ HTTP communication established
✅ Tool execution working</content>
<parameter name="filePath">c:\Users\colte\colten projects\coltens world\AGENT_CHAT_INTEGRATION.md
