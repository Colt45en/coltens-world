# Fusion Engine - C++ Python WorldEngine Build

A refactored recording system where AI tool calls are handled by a Python FastAPI server that invokes a C++ FFmpeg-based recorder, plus local HTML rendering without internet access.

## Architecture

- **UI**: React-based chat interface (WebSocket client)
- **Server**: Python FastAPI with WebSocket support + HTML rendering
- **Recorder**: C++ executable using FFmpeg for screen/audio capture
- **Renderer**: Headless Chromium for local HTML/CSS/JS rendering
- **Storage**: Local file system with HTTP serving

## Project Structure

```
fusion-engine/
├── ui/
│   └── index.html          # React chat interface
├── python/
│   ├── fusion_server.py   # FastAPI WebSocket server + rendering
│   ├── render_engine.py    # HTML rendering engine
│   ├── requirements.txt    # Python deps (includes playwright)
│   └── data/
│       ├── media/          # Recorded files storage
│       ├── renders/        # Rendered images/PDFs
│       └── test_template.html # Sample HTML for testing
├── cpp/
│   ├── CMakeLists.txt      # Build configuration
│   └── fusion_recorder.cpp # C++ FFmpeg wrapper
└── run_server.bat         # Windows batch script to start server
```

## Prerequisites

- **FFmpeg**: Installed via `winget install --id=Gyan.FFmpeg`
- **Python 3.8+**: With pip
- **CMake**: For building C++
- **Visual Studio**: With C++ build tools
- **Playwright**: For HTML rendering (installed via pip)

## Build Instructions

### 1. Build C++ Recorder

```bash
cd cpp
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

The executable will be at `cpp/build/Release/fusion_recorder.exe`

### 2. Install Python Dependencies

```bash
cd python
pip install -r requirements.txt
playwright install chromium
```

### 3. Run the Server

```bash
# From project root
./run_server.bat
# Or manually:
cd python
python -m uvicorn fusion_server:app --host 127.0.0.1 --port 3000
```

### 4. Open the UI

Open `ui/index.html` in a web browser. The interface will connect to `ws://127.0.0.1:3000/ws/chat`.

## Usage

### AI Tool Calls (via Python server)

Send messages like:
- "record screen 10" - Records screen for 10 seconds
- "record audio 5" - Records audio for 5 seconds
- "render html <html_content>" - Renders HTML string to PNG
- "render file <filename>" - Renders HTML file to PNG

The server will:
1. Parse the command
2. Run the C++ recorder or HTML renderer
3. Save file to `python/data/media/` or `python/data/renders/`
4. Return a download link via WebSocket

### Manual Recording (Browser-based)

Use the UI controls to record directly in the browser using MediaRecorder API.

## Device Configuration

### List Available Devices

```bash
cpp/build/Release/fusion_recorder.exe list-devices
```

### Configure Audio Devices

For system audio recording, you may need:
- **Stereo Mix** (enable in Windows Recording devices)
- Or **virtual-audio-capturer** for advanced setups

Update device names in `python/fusion_server.py` in the `detect_action()` function.

## API Endpoints

- `WS /ws/chat`: WebSocket for chat and tool execution
- `GET /media/<filename>`: Serve recorded files
- `GET /renders/<filename>`: Serve rendered images/PDFs

## Development

- C++ recorder outputs JSON to stdout for Python parsing
- WebSocket envelope version: "1.0"
- Recordings saved as MP4 (screen) or M4A (audio)
- HTML rendering uses headless Chromium for offline processing
- Renderer supports PNG output with configurable viewport

## Next Steps

- Add PDF output format for HTML rendering
- Implement rendering options (viewport size, quality settings)
- Extend renderer abstraction for other languages/frameworks
- Add caching for rendered content
