# IDE Remote Execution Implementation

## Overview

Added support for remote command execution and file reading from the IDE through Nucleus, enabling the AI agent to safely execute shell commands and read files on the development machine.

## Features Implemented

### 1. **ide.cli.run.request / ide.cli.run.response**

Execute shell commands from the IDE with output capture.

**Message Structure:**

```typescript
// Request
{
  type: "ide.cli.run.request",
  sessionId: string,
  payload: {
    cwd?: string,              // Working directory (optional)
    command: string,           // Shell command to execute
    timeoutMs: number          // Timeout in milliseconds (1s - 2min)
  }
}

// Response
{
  type: "ide.cli.run.response",
  sessionId: string,
  payload: {
    ok: boolean,               // Success indicator
    exitCode: number,          // Process exit code
    stdout: string,            // Standard output
    stderr: string             // Standard error
  }
}
```

**Use Cases:**

- Install dependencies via `pnpm install`
- Run build scripts
- Execute tests
- Run linter/type-checker
- Query git status/logs

### 2. **ide.fs.read.request / ide.fs.read.response**

Read file contents safely from the IDE.

**Message Structure:**

```typescript
// Request
{
  type: "ide.fs.read.request",
  sessionId: string,
  payload: {
    path: string,              // File path (absolute or relative)
    encoding: "utf8",          // Character encoding
    maxBytes: number           // Size limit (default 1MB, max 5MB)
  }
}

// Response
{
  type: "ide.fs.read.response",
  sessionId: string,
  payload: {
    ok: boolean,               // Success indicator
    path: string,              // Original path
    content?: string,          // File contents (if ok=true)
    error?: string             // Error message (if ok=false)
  }
}
```

**Use Cases:**

- Read documentation (docs/\*)
- Read brain artifacts (.brain/\*)
- Read source files for analysis
- Read configuration files
- Read logs

---

## Implementation Details

### Files Modified

#### 1. **packages/protocol/src/ide.ts**

- Added `IdeCliRunRequestSchema` and `IdeCliRunResponseSchema`
- Added `IdeFsReadRequestSchema` and `IdeFsReadResponseSchema`
- All schemas include strict validation and size limits

#### 2. **packages/protocol/src/types.ts**

- Added message type definitions to `MessageMap`:
  - `"ide.cli.run.request"` → `IdeCliRunRequest`
  - `"ide.cli.run.response"` → `IdeCliRunResponse`
  - `"ide.fs.read.request"` → `IdeFsReadRequest`
  - `"ide.fs.read.response"` → `IdeFsReadResponse`

#### 3. **apps/nucleus/src/wsHub.ts**

- Added imports: `execSync` from `node:child_process`, `readFileSync` from `node:fs`
- Added handler for `ide.cli.run.request`:
  - Executes commands synchronously with timeout
  - Captures stdout/stderr
  - Handles errors gracefully
  - Returns typed response
- Added handler for `ide.fs.read.request`:
  - Reads files with size limit checking
  - Validates file exists and is readable
  - Returns file content or error message
  - Prevents reading beyond maxBytes limit

#### 4. **apps/ide-web/src/bus/wsClient.ts**

- Updated `Handlers` type to include optional handlers:
  - `onIdeCliRunResponse?`: Response handler for command execution
  - `onIdeFsReadResponse?`: Response handler for file reading
- Added message handlers in `onmessage` callback
- The generic `send<T extends keyof MessageMap>()` method now supports:
  - Sending `ide.cli.run.request` with full type safety
  - Sending `ide.fs.read.request` with full type safety

---

## Usage Examples

### From IDE Web Client

```typescript
// Execute a command
client.send("ide.cli.run.request", {
  cwd: "/path/to/workspace",
  command: "pnpm run build",
  timeoutMs: 30000,
});

// Read a file
client.send("ide.fs.read.request", {
  path: "docs/README.md",
  encoding: "utf8",
  maxBytes: 1_000_000,
});
```

### From AI Agent (via Brain/Chat)

The agent can request:

```python
# Pseudo-code in Brain
execute_command("pnpm type-check", timeout=30000)
read_file("docs/ARCHITECTURE.md")
```

Which translates to corresponding IDE protocol messages.

---

## Security Considerations

### Command Execution Limits

- **Timeout**: 1s - 120s (prevents hanging processes)
- **Working Directory**: Path sanitized with `path.resolve()`
- **Execution**: Synchronous with stdio capture
- **Error Handling**: Exit codes and stderr captured and reported

### File Reading Limits

- **Max Size**: Default 1MB, maximum 5MB (prevents reading huge files)
- **Path Safety**: Resolved to absolute path (prevents directory traversal)
- **Encoding**: Fixed to UTF-8 for consistency
- **Error Handling**: File not found, permission denied handled gracefully

### Session & Auth

- Both message types use existing session/auth infrastructure
- Require valid WebSocket session established via `system.hello` handshake
- Token provided in response envelope's `auth` field

---

## Type Safety

**Full Type Safety Across Boundaries:**

```typescript
// IDE Client - fully typed send
client.send("ide.cli.run.request", {
  command: "pnpm run build",
  timeoutMs: 30000,
}); // ✅ TypeScript validates payload matches schema

// Nucleus Handler - receives typed payload
const p = env.payload as MessageMap["ide.cli.run.request"];
// p.command and p.timeoutMs are guaranteed to exist and be correct type

// Response Handler - fully typed onMessage
client.handlers.onIdeCliRunResponse = (env) => {
  // env.payload.ok, .exitCode, .stdout, .stderr all properly typed
  console.log(`Exit code: ${env.payload.exitCode}`);
};
```

---

## Compilation Status

✅ **nucleus** - Compiles without errors
✅ **ide-web** - Compiles without errors (includes new handlers)
✅ **protocol** - Compiles without errors (includes new types)

Pre-existing errors in codex and env-sandbox are unrelated to these changes.

---

## Next Steps (Future Enhancements)

1. **Request/Response Correlation**: Add tracing/request IDs to match responses to requests
2. **Streaming Output**: For long-running commands, stream output progressively instead of buffering
3. **Progress Updates**: Send progress indicators for long operations
4. **File System Safe Mode**: Add whitelist/blacklist for allowed paths
5. **Command Safe Mode**: Add whitelist for allowed commands
6. **Resource Limits**: Add CPU/memory limits via system tools
7. **Permissions Model**: Fine-grained control over what the agent can execute/read

---

## Testing the Implementation

### Quick Manual Test

1. Connect IDE client to Nucleus
2. Send a test command:

   ``` typescript
   client.send("ide.cli.run.request", {
     command: "echo test",
     timeoutMs: 5000,
   });
   ```

3. Expect response with `ok: true`, `stdout: "test\n"`, `exitCode: 0`

4. Send a test file read:

   ```typescript
   client.send("ide.fs.read.request", {
     path: "README.md",
     encoding: "utf8",
     maxBytes: 1_000_000,
   });
   ```

5. Expect response with `ok: true`, `content: "..."` containing file contents

### For AI Agent Testing

The agent can now directly request:

- "Check if the build passes" → `pnpm run type-check`
- "What's in the ARCHITECTURE doc?" → Read docs/ARCHITECTURE.md
- "Install my dependencies" → `pnpm install`
- "Run the tests" → `pnpm run test`

---

## Backward Compatibility

✅ All existing IDE protocol messages remain unchanged
✅ New message types are additive (don't break existing code)
✅ Optional handlers in wsClient (IDE doesn't need to handle if not using features)
✅ No breaking changes to MessageMap or BusEnvelope structure
