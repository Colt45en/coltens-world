## 🎯 VS Code + ESLint + Prettier Setup Complete

Everything is configured! Here's what was created:

### ✅ Created Files

**VS Code Configuration** (`.vscode/`)

- `settings.json` - Editor config (Prettier, ESLint, TypeScript, file handling)
- `launch.json` - Debug configs (Nucleus Node, IDE Web, Preview Runtime, compound)
- `extensions.json` - Auto-install 16 recommended extensions
- `tasks.json` - Turbo build tasks

**Linting & Formatting**

- `eslint.config.mjs` - Modern ESLint flat config (8 plugin rules, TypeScript strict)
- `.eslintrc.json` - Optional legacy bridge
- `.prettierrc.json` - Prettier config (100 char width, trailing commas, etc.)
- `.editorconfig` - Cross-editor standards (LF, UTF-8, 2-space indent)

**Setup Scripts**

- `scripts/setup.sh` - macOS/Linux setup
- `scripts/setup.bat` - Windows setup
- `docs/VSCODE_SETUP.md` - Complete guide

**Fixed Issues**

- TypeScript `lib` settings (ES2020 for Map/Set/Promise support)
- Code quality (readonly fields, removed unnecessary assertions, type aliases)
- Package dependencies (added eslint, prettier, typescript-eslint stack)

---

## 🚀 Quick Start (Choose Your Platform)

### Option A: Windows (PowerShell)

```powershell
cd "c:\Users\colte\colten projects\coltens world"
.\scripts\setup.bat
```

### Option B: macOS/Linux (Bash)

```bash
cd ~/path/to/coltens\ world
chmod +x ./scripts/setup.sh
./scripts/setup.sh
```

### Option C: Manual

```bash
cd "c:\Users\colte\colten projects\coltens world"
pnpm install
pnpm run build
pnpm run type-check
```

---

## 🎨 What Happens Next

Once setup completes:

1. **VS Code Restarts** (or you reload it)
2. **Extensions Auto-Install**:
   - ESLint, Prettier, SonarLint
   - TypeScript Next, Pylance (Python)
   - GitLens, Error Lens, Path Intellisense
   - EditorConfig, Conventional Commits

3. **Save Any File** → Automatic:
   - ESLint fixes applied
   - Prettier formatting
   - Imports reorganized
   - Type errors highlighted

---

## 🔗 Access Points (when `pnpm run dev` is running)

| Service     | URL                   | Purpose                  |
| ----------- | --------------------- | ------------------------ |
| **IDE Web** | http://localhost:5173 | Editor + panels          |
| **Nucleus** | ws://localhost:3001   | Orchestrator (WebSocket) |
| **Preview** | http://localhost:5174 | Game runtime iframe      |
| **Sidecar** | http://localhost:8000 | Math/lexicon FastAPI     |

---

## 🎮 Start Development

```bash
# All services (IDE, Nucleus, Preview, Sidecar)
pnpm run dev

# In separate terminal: Watch and lint
pnpm run lint:fix

# Or: Format entire codebase
pnpm run format

# Or: Type check all packages
pnpm run type-check
```

---

## 🐛 Debug Everything

Press `F5` or **Run → Start Debugging** and pick:

- **"Nucleus: Debug (ts-node/register)"** - Debug Node server directly (hot reload)
- **"Nucleus: Debug (compiled dist)"** - Debug compiled version
- **"IDE Web: Debug (Chrome)"** - Debug editor UI in Chrome
- **"Preview Runtime: Debug (Chrome)"** - Debug game engine in Chrome
- **"World Engine: Debug All"** - Attach to all three simultaneously

---

## 🛠️ Common Workflows

### Fix All ESLint Issues

```bash
pnpm run lint:fix
```

### Format Everything

```bash
pnpm run format
```

### Add a New Package

```bash
cd packages/my-new-package
npm init -y
# Edit package.json, add typescript build scripts
# Add to root tsconfig.json paths
```

### Add a New App

```bash
cd apps/my-new-app
npm init -y
# Same as package, but can use Vite/Next/etc.
```

### Check for Issues Before Commit

```bash
pnpm run type-check
pnpm run lint
pnpm run build
```

---

## 📋 File Organization Reference

```
.vscode/               → VS Code workspace config
  settings.json       → Editor settings (format on save, ESLint, etc.)
  launch.json         → Debug configurations
  extensions.json     → Recommended extensions
  tasks.json          → Build tasks

eslint.config.mjs     → Modern ESLint flat config (main)
.eslintrc.json        → Compatibility bridge (optional)
.prettierrc.json      → Prettier formatting rules
.editorconfig         → Cross-editor standards

package.json          → Root workspace + scripts
tsconfig.json         → Root TypeScript config

scripts/
  setup.sh            → macOS/Linux setup
  setup.bat           → Windows setup

docs/
  VSCODE_SETUP.md     → Full configuration guide
  spec/ARCHITECTURE.md → System design
  ...
```

---

## ✨ Key Features Enabled

✅ **Format on Save** - Prettier applies automatically
✅ **ESLint Auto-Fix on Save** - Import organization, unused removal, etc.
✅ **Type Checking** - Strict TypeScript with project references
✅ **No Semicolon Fights** - ESLint + Prettier perfectly integrated
✅ **Monorepo Support** - Turbo, workspace paths, turbo.json
✅ **Debug Any App** - Node, Vite, Chrome DevTools
✅ **WSL-Friendly** - Terminal profile configured

---

## 🎓 Next Steps

1. **Install**: Run `pnpm install`
2. **Build**: Run `pnpm run build` (verifies setup)
3. **Code**: Open in VS Code, accept extension recommendations
4. **Develop**: `pnpm run dev` to start all services
5. **Debug**: Press `F5` to attach debugger

---

**Status**: ✅ All configuration complete and ready!

For full details, see **[docs/VSCODE_SETUP.md](docs/VSCODE_SETUP.md)**
