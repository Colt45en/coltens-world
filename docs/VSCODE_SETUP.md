# VS Code Setup & Configuration Guide

This document covers the complete VS Code gold-standard configuration for the World Engine IDE monorepo.

## ✅ What Was Installed

### VS Code Configuration Files

- **`.vscode/settings.json`** - Editor settings, ESLint, Prettier, TypeScript config
- **`.vscode/launch.json`** - Debug configurations for Nucleus (Node), IDE Web, and Preview Runtime
- **`.vscode/extensions.json`** - Recommended extensions (auto-install on workspace open)
- **`.vscode/tasks.json`** - Build tasks for Turbo

### Linting & Formatting

- **`eslint.config.mjs`** - Modern flat ESLint config with TypeScript support
- **`.eslintrc.json`** - Compatibility bridge (optional)
- **`.prettierrc.json`** - Prettier formatting rules
- **`.editorconfig`** - EditorConfig standard (cross-editor standards)

### Updated Files

- **`package.json`** - Added ESLint, Prettier, and all dev dependencies
- **`tsconfig.json`** - Fixed `lib` to include ES2020 (Map, Set, Promise, Array.from support)
- **Package tsconfigs** - Updated to extend root config with proper lib settings

---

## 🚀 Getting Started

### 1. Install Everything

**Windows (PowerShell):**

```powershell
cd "c:\Users\colte\colten projects\coltens world"
.\scripts\setup.bat
```

**macOS/Linux:**

```bash
cd ~/path/to/coltens\ world
./scripts/setup.sh
```

**Manual:**

```bash
pnpm install
pnpm run build
```

### 2. Open in VS Code

The workspace will automatically:

- Detect and recommend extensions (click "Install All" when prompted)
- Configure ESLint with flat config
- Enable Prettier with require config check
- Setup TypeScript project references

### 3. Verify Setup

Save any `.ts` file and watch:

- ✅ ESLint runs auto-fixes
- ✅ Prettier formats code
- ✅ Imports auto-organize
- ✅ Type errors appear in Problems panel

---

## 🛠️ Development Workflow

### Common Commands

```bash
# Start everything (IDE + Nucleus + Preview + Sidecar)
pnpm run dev

# Build all packages
pnpm run build

# Fix all ESLint issues automatically
pnpm run lint:fix

# Format all code with Prettier
pnpm run format

# Type check without emitting
pnpm run type-check

# Clean all build artifacts
pnpm run clean
```

### Editor Shortcuts (VS Code)

| Action            | Shortcut          |
| ----------------- | ----------------- |
| Format Document   | `Shift+Alt+F`     |
| Fix ESLint Issues | Automatic on save |
| Organize Imports  | Automatic on save |
| Quick Fix         | `Ctrl+.`          |
| Go to Definition  | `F12`             |
| Find References   | `Shift+Alt+F12`   |
| Rename Symbol     | `F2`              |

---

## 🐛 Debugging

### Debug Nucleus (Node.js Server)

1. Set breakpoint in `apps/nucleus/src/index.ts`
2. Run → **"Nucleus: Debug (ts-node/register)"** or **"Nucleus: Debug (compiled dist)"**
3. Chrome DevTools will open automatically

### Debug IDE Web (Browser)

1. Set breakpoint in `apps/ide-web/src/main.ts`
2. Run → **"IDE Web: Debug (Chrome)"**
3. Browser opens with DevTools

### Debug Preview Runtime (Browser)

1. Set breakpoint in `apps/preview-runtime/src/main.ts`
2. Run → **"Preview Runtime: Debug (Chrome)"**
3. Browser opens with DevTools

### Debug All Together

1. Run → **"World Engine: Debug All"** (compound configuration)
2. Both Node debugger (Nucleus) and Chrome debuggers (IDE + Preview) attach

---

## 🎨 ESLint & Prettier Rules

### ESLint (Flat Config)

- **Strict TypeScript**: `no-explicit-any`, `consistent-type-imports`
- **Import Organization**: Groups by builtin → external → internal → sibling
- **No Circular Dependencies**: Warns on circular imports
- **React Hooks**: Enforces rules of hooks, validates deps arrays
- **Unicorn**: Modern Node.js patterns, no array forEach, prefer node: protocol

### Prettier

- Print width: 100 characters
- Trailing commas: all
- Single quote: false (use double quotes)
- Arrow parens: always
- Semicolons: true

### EditorConfig

- EOL: LF (Unix-style)
- Charset: UTF-8
- Insert final newline: true
- Trim trailing whitespace: true
- Indent: 2 spaces

---

## 📦 Dependency Management

### Root devDependencies

All tooling is installed at repo root:

```json
{
  "eslint": "^8.55.0",
  "@eslint/js": "^8.55.0",
  "typescript-eslint": "^6.15.0",
  "eslint-plugin-import": "^2.29.0",
  "eslint-plugin-react": "^7.33.2",
  "eslint-plugin-react-hooks": "^4.6.0",
  "eslint-plugin-unicorn": "^50.1.0",
  "eslint-plugin-promise": "^6.1.1",
  "eslint-config-prettier": "^9.1.0",
  "prettier": "^3.1.1",
  "ts-node": "^10.9.2",
  "typescript": "^5.3.3"
}
```

### App-specific Dependencies

- **`apps/ide-web`**: vite, monaco-editor
- **`apps/nucleus`**: ws, axios
- **`apps/preview-runtime`**: vite, three.js
- **`apps/py-sidecar`**: fastapi, uvicorn, pydantic, numpy, sympy

---

## 🔍 Common Issues & Solutions

### Issue: "Cannot find module 'zod'"

**Fix**: Run `pnpm install` at repo root.

### Issue: ESLint not running on save

**Check**:

1. File is `.ts` or `.tsx`
2. `eslint.enable: true` in settings.json
3. `eslint.useFlatConfig: true` is set
4. Restart VS Code (`Cmd+Shift+P` → "Reload Window")

### Issue: Prettier doesn't format

**Check**:

1. `.prettierrc.json` exists
2. `prettier.requireConfig: true` in settings.json
3. File extension is supported (`.ts`, `.tsx`, `.js`, `.json`, etc.)
4. No conflicting default formatter

### Issue: TypeScript errors with Map/Set

**Fix**: Ensure `tsconfig.json` has `"lib": ["ES2020", "DOM", "DOM.Iterable"]`

### Issue: Debugger won't attach

**Fix**:

1. Stop any existing dev server (`pnpm run clean`)
2. Close all debug sessions
3. Run debug config again
4. Check port conflicts (3000, 3001, 5173, 5174, 8000)

---

## 🎯 Editor Quick Reference

### VS Code Extensions (Auto-Installed)

| Extension            | Purpose                       |
| -------------------- | ----------------------------- |
| ESLint               | JavaScript/TypeScript linting |
| Prettier             | Code formatting               |
| SonarLint            | Code quality & security       |
| GitLens              | Git history, blame, diffs     |
| Error Lens           | Inline error messages         |
| TypeScript Next      | Latest TS features            |
| Pylance              | Python type checking          |
| EditorConfig         | Cross-editor standards        |
| Conventional Commits | Git commit helper             |
| Path Intellisense    | Autocomplete paths            |

### Useful VS Code Commands

```
Cmd+Shift+P (or Ctrl+Shift+P on Windows):

  Format Document       - Prettier format
  Fix All Auto-Fix      - ESLint fixes
  Organize Imports      - Sort imports
  Restart TS Server     - Reload TypeScript
  Reload Window         - Restart VS Code
  Debug: Start          - Launch debugger
  Tasks: Run Task       - Run a build task
```

---

## 🚢 Production Build

```bash
# Build all packages (optimized)
pnpm run build

# Type check before commit
pnpm run type-check

# Lint everything
pnpm run lint

# (Optional) Format entire codebase
pnpm run format
```

---

## 📚 Further Reading

- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [Prettier Docs](https://prettier.io/docs/en/index.html)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Turbo Monorepo](https://turbo.build/repo/docs)

---

**Status**: ✅ Ready for development

**Last Updated**: 2026-02-10
