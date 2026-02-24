# IDE Remote Execution - Quick Integration Guide

## For Brain/Chat System

The brain can now request environment information and take development actions through the IDE.

### Available Operations

#### 1. Execute Shell Commands

**When to use:**

- Check build status
- Run type checker
- Install dependencies
- Execute tests
- Query source control
- Run custom scripts

**Brain → Chat Handler → Nucleus → IDE:**

```
Brain: "Check if the project builds"
  ↓
Chat Handler intercepts and routes to:
  client.send("ide.cli.run.request", {
    command: "pnpm run type-check",
    cwd: workspace,
    timeoutMs: 30000
  })
  ↓
Nucleus handler executes via Node.js child_process
  ↓
Response: { ok: true, exitCode: 0, stdout: "...", stderr: "" }
  ↓
Chat Handler parses and reports to Brain
```

#### 2. Read Files

**When to use:**

- Understand architecture (docs/ARCHITECTURE.md)
- Read build guides (docs/BUILD_GUIDE.md)
- Understand integration specs
- Review existing brain artifacts
- Understand project structure

**Brain → Chat Handler → Nucleus → IDE:**

```
Brain: "What's the current system architecture?"
  ↓
Chat Handler routes to:
  client.send("ide.fs.read.request", {
    path: "docs/ARCHITECTURE.md",
    encoding: "utf8",
    maxBytes: 1_000_000
  })
  ↓
Nucleus handler reads file from disk
  ↓
Response: { ok: true, path: "...", content: "..." }
  ↓
Chat Handler returns content to Brain
```

---

## Implementation Pattern for Chat Handlers

### Add to Chat Request Handler

```typescript
// In apps/nucleus/src/chat-handler.ts (or similar)

async function handleToolCall(brain: any, toolCall: any) {
  const tool = toolCall.name;

  if (tool === "execute_command") {
    // Execute shell command via IDE
    const { command, cwd, timeoutMs } = toolCall.input;

    return new Promise((resolve) => {
      // Send request via bus
      client.send("ide.cli.run.request", {
        command,
        cwd,
        timeoutMs: timeoutMs || 30000,
      });

      // Register response handler
      const handler = (env) => {
        resolve({
          ok: env.payload.ok,
          exitCode: env.payload.exitCode,
          stdout: env.payload.stdout,
          stderr: env.payload.stderr,
        });
        // Clean up handler
        delete client.handlers.onIdeCliRunResponse;
      };

      client.handlers.onIdeCliRunResponse = handler;
    });
  }

  if (tool === "read_file") {
    // Read file via IDE
    const { path, maxBytes } = toolCall.input;

    return new Promise((resolve) => {
      client.send("ide.fs.read.request", {
        path,
        encoding: "utf8",
        maxBytes: maxBytes || 1_000_000,
      });

      const handler = (env) => {
        if (env.payload.ok) {
          resolve({ ok: true, content: env.payload.content });
        } else {
          resolve({ ok: false, error: env.payload.error });
        }
        delete client.handlers.onIdeFsReadResponse;
      };

      client.handlers.onIdeFsReadResponse = handler;
    });
  }
}
```

### Tool Definitions for Brain

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "execute_command",
        "description": "Execute a shell command in the workspace",
        "parameters": {
          "type": "object",
          "properties": {
            "command": {
              "type": "string",
              "description": "Shell command to execute"
            },
            "cwd": {
              "type": "string",
              "description": "Working directory (optional)"
            },
            "timeoutMs": {
              "type": "integer",
              "description": "Timeout in milliseconds (1000-120000)"
            }
          },
          "required": ["command"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "read_file",
        "description": "Read file contents from the workspace",
        "parameters": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "description": "File path to read"
            },
            "maxBytes": {
              "type": "integer",
              "description": "Maximum bytes to read (optional, default 1MB)"
            }
          },
          "required": ["path"]
        }
      }
    }
  ]
}
```

---

## Safe Commands to Expose to Agent

### ✅ Safe Commands

```bash
pnpm run type-check      # Check types
pnpm run build          # Build project
pnpm run test           # Run tests
pnpm run lint           # Lint code
pnpm audit              # Check imports
git status              # Check repo status
git log --oneline -n 10 # View recent commits
find . -name "*.md"     # Find markdown files
```

### ⚠️ Risky Commands (Restrict if needed)

```bash
rm -rf                  # Delete files
git push                # Push changes
npm publish             # Publish packages
npm run install:global  # Install globally
```

### ❌ Forbidden Commands

```bash
curl https://...        # Network requests (security)
python malicious.py     # Arbitrary code
sudo ...                # Privilege escalation
```

---

## Safe Files to Expose

### ✅ Safe to Read

- `docs/**` - Documentation
- `*.md` - Markdown files
- `.brain/**` - Brain artifacts
- `package.json` - Dependencies
- `CHANGELOG.md` - Change log
- `ARCHITECTURE.md` - Architecture docs
- `tsconfig.json` - TS configuration
- `.env.example` - Example config (NOT .env)

### ⚠️ Careful with

- `src/**/*.ts` - Source code (large files)
- `.git/**` - Git metadata (large files)
- `node_modules/**` - Dependencies (HUGE)
- `.env` - Secrets (DO NOT READ)

### ❌ Forbidden to Read

- `.env` - Contains secrets
- `.secrets/**` - Secret keys
- Private configuration files
- System configuration files
- Database credentials

---

## Error Handling

### Command Execution Errors

```typescript
if (!response.ok) {
  // Command failed
  if (response.stderr) {
    console.log(`Command failed: ${response.stderr}`);
  }
  if (response.exitCode !== 0) {
    console.log(`Exit code: ${response.exitCode}`);
  }
}
```

### File Reading Errors

```typescript
if (!response.ok) {
  // File reading failed
  switch (response.error) {
    case "ENOENT":
      console.log("File not found");
      break;
    case "EACCES":
      console.log("Permission denied");
      break;
    case "File size exceeds limit":
      console.log("File too large");
      break;
    default:
      console.log(`Error: ${response.error}`);
  }
}
```

---

## Performance Considerations

### Command Execution

- Timeout: 30 seconds recommended for most commands
- Shorter (5-10s) for quick checks like `pnpm run type-check`
- Longer (60s+) only for heavy operations like `pnpm install`

### File Reading

- Default 1MB limit is good for most docs
- Increase to 5MB for large source analysis
- For very large files, read in chunks

### Caching

- Cache frequently-read files (docs, architecture)
- Cache command results temporarily (e.g., git status)
- Invalidate cache on file changes

---

## Testing Locally

### Start nucleus with websocket:

```bash
pnpm -w -F nucleus run dev
```

### Send test messages via IDE web client:

```typescript
// Execute a test
client.send("ide.cli.run.request", {
  command: "echo 'Hello from brain'",
  timeoutMs: 5000,
});

// Read README
client.send("ide.fs.read.request", {
  path: "README.md",
  encoding: "utf8",
  maxBytes: 1_000_000,
});
```

### Verify responses in browser console:

```
Check Network tab → WS → Messages
Should see:
  ← ide.cli.run.response
  ← ide.fs.read.response
```

---

## Example: Full Brain Initialization Loop

```typescript
async function initializeBrainWithContext() {
  // 1. Read architecture documentation
  const archDoc = await readFile("docs/ARCHITECTURE.md");

  // 2. Read build guide
  const buildGuide = await readFile("docs/BUILD_GUIDE.md");

  // 3. Check if build is passing
  const buildCheck = await executeCommand("pnpm run type-check", 30000);

  // 4. Get recent git history
  const gitLog = await executeCommand("git log --oneline -n 5");

  // 5. Initialize brain with full context
  const context = {
    architecture: archDoc.content,
    buildGuide: buildGuide.content,
    buildStatus: buildCheck.ok,
    recentChanges: gitLog.stdout,
    workspace: process.cwd(),
  };

  return brain.initialize(context);
}
```

---

## Further Reading

- See `IDE_REMOTE_EXECUTION_IMPLEMENTATION.md` for technical details
- See `packages/protocol/src/ide.ts` for message schemas
- See `apps/nucleus/src/wsHub.ts` for handler implementation
- See `apps/ide-web/src/bus/wsClient.ts` for client integration
