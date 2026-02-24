# Windows Setup Issue: WSL Configuration

## Problem

Your Windows system is configured to route `node` and `npm` commands to WSL (Windows Subsystem for Linux), but WSL is not installed. This causes the error:

``` This application requires the Windows Subsystem for Linux Optional Component.
Install it by running: wsl.exe --install --no-distribution
```

## Solutions

### Option 1: Install WSL (Recommended for Full Compatibility)

WSL2 provides the best experience for Node.js development on Windows:

```powershell
# Run in PowerShell as Administrator
wsl.exe --install

# This will install:
# - Windows Subsystem for Linux
# - Ubuntu Linux distribution by default
# - You'll need to restart your computer afterward
```

After restart, you can use the batch script normally:

```bash
.\start-dev.bat
```

**Pros**: Native Linux kernel, best performance, Docker support
**Cons**: Requires one-time setup and restart

---

### Option 2: Remove WSL App Execution Aliases (Quick Fix)

If you want to keep native Windows Node/npm, remove the WSL aliases:

1. **Open Settings** → Search for "Manage app execution aliases"
2. **Find these entries and toggle them OFF**:
   - `node.exe` (if present)
   - `npm.exe` (if present)
   - `python.exe` (if present)

3. **Then restart your terminal** and run:

```bash
.\start-dev.bat
```

**Pros**: Quick, no restart needed
**Cons**: Requires manual settings change

---

### Option 3: Uninstall Node and Reinstall Native

If Option 2 doesn't work, fully remove and reinstall Node from nodejs.org:

```powershell
# Uninstall Node.js
# Go to: Settings → Apps → Apps & features
# Find "Node.js" and uninstall completely

# Download installer from: https://nodejs.org (LTS version)
# Run installer and **do NOT install with WSL**
# Ensure "Add to PATH" is checked during installation

# Verify installation
node --version
npm --version

# Then run
.\start-dev.bat
```

**Pros**: Clean install, guaranteed to work
**Cons**: Requires uninstall/reinstall

---

## Manual Setup (Skip NPM Issues)

If the batch script still fails, use these **4 separate terminals**:

### Terminal 1: Nucleus Backend

```bash
cd c:\Users\colte\colten projects\coltens world\apps\nucleus
npm install
npm run dev
# Should show: [nucleus] listening http/ws on :3000
```

### Terminal 2: IDE Web Editor

```bash
cd c:\Users\colte\colten projects\coltens world\apps\ide-web
npm install
npm run dev
# Should show: VITE v5.x.x ready in X ms
# → Local: http://localhost:5173
```

### Terminal 3: Preview Runtime

```bash
cd c:\Users\colte\colten projects\coltens world\apps\preview-runtime
npm install
npm run dev
# Should show: VITE v5.x.x ready in X ms
# → Local: http://localhost:5174
```

### Terminal 4: Python Sidecar

```bash
cd c:\Users\colte\colten projects\coltens world\apps\py-sidecar
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
# Should show: Uvicorn running on http://127.0.0.1:8001
```

Then open browser to: **<http://localhost:5173>**

---

## Verify Installation

Once you've fixed the WSL issue, verify everything works:

```bash
# Check Node/npm
node --version        # Should be v18+ or v20+
npm --version         # Should be 9+

# Check Python
python --version      # Should be 3.10+

# Install dependencies
npm install

# Type check
npm run typecheck

# Build
npm run build

# Run development
.\start-dev.bat
```

---

## If You're Still Stuck

1. **Check what npm is being used**:

   ```bash
   where npm
   ```

2. **Check for WSL aliases**:

   ```bash
   Get-Alias node 2>$null | ForEach-Object {$_.Definition}
   ```

3. **Disable WSL app aliases** through Settings

4. **Reset your PATH** by reinstalling Node from nodejs.org

---

## Long-term Solution

If you're doing heavy Node.js development on Windows, **install WSL2** once. It provides:

- ✅ Better performance than native Windows npm
- ✅ Docker support without Docker Desktop overhead
- ✅ POSIX-compliant tools
- ✅ Great terminal experience with Windows Terminal

Instructions: [WSL Installation Guide](https://learn.microsoft.com/en-us/windows/wsl/install)
