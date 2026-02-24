# Command Center Reference Guide

**Unified command reference for World Engine IDE, Brain, and System operations.**

This guide consolidates:

- **Brain Development Commands** (lexicon, memory, autonomy)
- **Project Build & Development** (dev, build, typecheck)
- **System & Shell Commands** (Windows, terminal, disk, network)
- **Advanced Operations** (contracts, codegen, audits)

---

## 🧠 Brain Development Commands

### Lexicon Operations

| Command                     | Purpose                         | Example                     |
| --------------------------- | ------------------------------- | --------------------------- |
| `pnpm lexicon:index`        | Index lexicon entries from docs | `pnpm lexicon:index`        |
| `pnpm lexicon:validate-all` | Validate all lexicon entries    | `pnpm lexicon:validate-all` |
| `pnpm prompts:validate`     | Validate prompt tags in lexicon | `pnpm prompts:validate`     |
| `pnpm prompts:tags`         | List all available prompt tags  | `pnpm prompts:tags`         |

### Memory Operations

| Command               | Purpose                       | Example               |
| --------------------- | ----------------------------- | --------------------- |
| `pnpm memory:query`   | Query brain memory database   | `pnpm memory:query`   |
| `pnpm memory:stats`   | Display memory statistics     | `pnpm memory:stats`   |
| `pnpm memory:chain`   | Trace memory chain operations | `pnpm memory:chain`   |
| `pnpm review:promote` | Promote reviewed entries      | `pnpm review:promote` |

### Autonomy & Learning

| Command                  | Purpose                        | Example                              |
| ------------------------ | ------------------------------ | ------------------------------------ |
| `pnpm seed:world-engine` | Seed world with initial data   | `pnpm seed:world-engine --seed 1337` |
| `npm run dev:py`         | Start Python sidecar (FastAPI) | `npm run dev:py` (port 8001)         |

---

## 🏗️ Project Build & Development Commands

### Development

| Command                   | Purpose                                   | Terminal Notes         |
| ------------------------- | ----------------------------------------- | ---------------------- |
| `pnpm run dev`            | Start Nucleus orchestrator                | Single app dev         |
| `pnpm run dev:all`        | Start all (Nucleus, IDE, Preview, Python) | Full stack, concurrent |
| `pnpm run build:web:dev`  | Run IDE & Preview in dev mode             | Web UI only            |
| `pnpm run dev:compiler-a` | Start Compiler-A dev mode                 | TypeScript compiler    |
| `pnpm run dev:compiler-b` | Start Compiler-B (htmlts) watch           | HTML/templating        |

### Building

| Command                    | Purpose                             | Output               |
| -------------------------- | ----------------------------------- | -------------------- |
| `pnpm run build`           | Build all packages                  | Root: all workspaces |
| `pnpm run build:web`       | Build IDE + Preview only            | Optimized bundles    |
| `pnpm run build:cpp`       | Build C++ native bindings           | Compiled .node files |
| `pnpm run build:compilers` | Build both compilers                | Compiler-A & B       |
| `pnpm run build:all`       | Lint + typecheck + build everything | Full CI pipeline     |

### Type Checking & Linting

| Command               | Purpose                            | Scope        |
| --------------------- | ---------------------------------- | ------------ |
| `pnpm run typecheck`  | TypeScript checking all workspaces | All packages |
| `pnpm run type-check` | Alias for typecheck                | All packages |
| `pnpm run lint`       | Run ESLint on codebase             | Find issues  |
| `pnpm run lint:fix`   | Auto-fix linting issues            | Apply fixes  |

### Testing

| Command                    | Purpose                       | Focus               |
| -------------------------- | ----------------------------- | ------------------- |
| `pnpm run test:compiler-a` | Test Compiler-A functionality | TypeScript output   |
| `pnpm run test:compiler-b` | Test Compiler-B functionality | HTML templates      |
| `pnpm run test:compilers`  | Test both compilers           | Full compiler suite |

---

## 📜 Contract & Code Generation

| Command                     | Purpose                                | Order                        |
| --------------------------- | -------------------------------------- | ---------------------------- |
| `pnpm run contracts:check`  | Validate contract schemas              | Run first                    |
| `pnpm run contracts:export` | Export OpenAPI from Python             | Run second (requires Python) |
| `pnpm run contracts:ts`     | Generate TypeScript types from OpenAPI | Run third                    |
| `pnpm run contracts:gen`    | All contract steps (export + ts gen)   | Complete pipeline            |
| `pnpm run codegen`          | Contracts + compilers (full codegen)   | Extended pipeline            |

---

## 🔍 Audit & Import/Export Tracking

| Command                        | Purpose                          | Output              |
| ------------------------------ | -------------------------------- | ------------------- |
| `pnpm run audit:imports`       | Check imports/exports once       | Report in terminal  |
| `pnpm run audit:imports:watch` | Watch mode for import violations | Continuous feedback |

**Why run audits?**

- Detect circular dependencies
- Validate package boundaries (protocol → engine → apps)
- Ensure one-way dependency direction
- Flag invalid deep imports

---

## 💻 System & Shell Commands

### Navigation & File Management

| Command                       | Description               | Usage                      |
| ----------------------------- | ------------------------- | -------------------------- |
| `cd <path>`                   | Change directory          | `cd apps/nucleus`          |
| `ls` (or `dir` on Windows)    | List directory contents   | `ls -la` for details       |
| `pwd`                         | Print working directory   | Show current path          |
| `mkdir <name>`                | Create new directory      | `mkdir new-folder`         |
| `cp <source> <dest>`          | Copy file/directory       | `cp -r folder newlocation` |
| `mv <old> <new>`              | Move/rename files         | `mv oldname newname`       |
| `rm <file>`                   | Delete file (⚠️ careful!) | `rm filename`              |
| `rmdir <dir>`                 | Remove empty directory    | `rmdir empty-folder`       |
| `find <path> -name <pattern>` | Search for files/folders  | `find . -name "*.ts"`      |
| `grep <pattern> <file>`       | Search file content       | `grep "error" log.txt`     |
| `cat <file>`                  | Display file contents     | `cat README.md`            |
| `echo <text>`                 | Print text to terminal    | `echo "Hello"`             |
| `touch <file>`                | Create empty file         | `touch newfile.txt`        |
| `tree <path>`                 | Show directory tree       | `tree -L 2` (depth 2)      |
| `which <command>`             | Find command location     | `which node`               |
| `alias <name>=<cmd>`          | Create command shortcut   | `alias ll='ls -la'`        |
| `clear`                       | Clear terminal screen     | Refresh view               |
| `history`                     | Show command history      | List recent commands       |

### System Operations

| Command                 | Description                    | Example                            |
| ----------------------- | ------------------------------ | ---------------------------------- |
| `node <file.js>`        | Run JavaScript file            | `node tooling/speech/rewriter.mjs` |
| `npm <command>`         | Node package manager           | `npm install package-name`         |
| `pnpm <command>`        | Fast package manager           | `pnpm install`                     |
| `python <file.py>`      | Run Python script              | `python app.py`                    |
| `python -m <module>`    | Run Python module              | `python -m uvicorn app.main:app`   |
| `pip install <package>` | Install Python package         | `pip install fastapi`              |
| `python -c <code>`      | Execute Python inline          | `python -c "print('hello')"`       |
| `exit` or `quit()`      | Exit terminal/Python           | Close shell                        |
| `Ctrl+C`                | Interrupt running process      | Stop execution                     |
| `Ctrl+Z`                | Suspend process (background)   | Pause temporarily                  |
| `bg`                    | Resume process in background   | Continue running                   |
| `fg`                    | Bring background to foreground | Restore to terminal                |

### Network Commands

| Command                     | Description                          | Usage                           |
| --------------------------- | ------------------------------------ | ------------------------------- |
| `ping <host>`               | Test host reachability               | `ping google.com`               |
| `ipconfig` (Windows)        | Display IP configuration             | Show network details            |
| `ifconfig` (Linux/Mac)      | Display network interfaces           | Show IP addresses               |
| `netstat`                   | Show network statistics              | Port/connection info            |
| `netstat -ano`              | Show processes using ports (Windows) | Find port conflicts             |
| `netstat -tulpn` (Linux)    | Open listening ports                 | Check active services           |
| `curl <url>`                | Fetch URL content                    | `curl http://localhost:8001`    |
| `wget <url>`                | Download file                        | `wget https://example.com/file` |
| `nslookup <domain>`         | DNS lookup                           | `nslookup google.com`           |
| `tracert <host>` (Windows)  | Trace route to host                  | Show network path               |
| `traceroute <host>` (Linux) | Trace route to host                  | Show network path               |
| `telnet <host> <port>`      | Test port connection                 | `telnet localhost 8001`         |
| `lsof -i :8001` (Linux/Mac) | List processes on port               | Check port usage                |
| `ss -tulpn` (Linux)         | Socket statistics                    | Show listening ports            |

### Disk Management

| Command                 | Description                   | Usage                      |
| ----------------------- | ----------------------------- | -------------------------- |
| `diskpart`              | Disk partition utility        | Windows advanced disk ops  |
| `list disk`             | Show all disks                | Inside diskpart            |
| `select disk <#>`       | Choose disk to modify         | Inside diskpart            |
| `list partition`        | Show partitions               | Inside diskpart            |
| `list volume`           | Display volumes               | Inside diskpart            |
| `format <drive>:`       | Format drive (⚠️ destructive) | Windows: `format D:`       |
| `chkdsk`                | Check disk health             | `chkdsk /F` (needs reboot) |
| `df -h`                 | Disk space usage              | Linux/Mac: human-readable  |
| `du -sh <path>`         | Directory size                | Show folder size           |
| `mount <device> <path>` | Mount filesystem              | Linux: mount USB/drives    |
| `umount <path>`         | Unmount filesystem            | Linux: safely eject        |

### Advanced Commands

| Command                         | Description               | Use Case                      |
| ------------------------------- | ------------------------- | ----------------------------- |
| `git status`                    | Show Git status           | Check uncommitted changes     |
| `git log`                       | View commit history       | See past commits              |
| `git diff`                      | Show file differences     | Compare versions              |
| `docker ps`                     | List running containers   | Container management          |
| `chmod +x <file>`               | Make file executable      | Linux: add execute permission |
| `sudo <command>`                | Run as admin (Linux/Mac)  | Elevated privileges           |
| `ssh <user>@<host>`             | Secure shell              | Remote server access          |
| `scp <file> <host>:`            | Secure copy to remote     | Transfer files                |
| `tar -czf <file.tar.gz> <path>` | Compress archive          | Create zipfile                |
| `unzip <file.zip>`              | Extract ZIP archive       | Unpack files                  |
| `source ~/.bashrc`              | Reload shell config       | Apply changes                 |
| `export VAR=value`              | Set environment variable  | Temporary setting             |
| `env`                           | Show all environment vars | Display all settings          |

### Batch File Commands (Windows)

| Command               | Description               | Example                         |
| --------------------- | ------------------------- | ------------------------------- |
| `@echo off`           | Hide commands from output | Place at top of .bat            |
| `echo <text>`         | Print text to console     | `echo Starting build...`        |
| `pause`               | Pause until keypress      | `pause`                         |
| `cd <path>`           | Change directory          | `cd apps\nucleus`               |
| `set VAR=value`       | Set environment variable  | `set PYTHON_PATH=C:\Python`     |
| `if <condition>`      | Conditional statement     | `if errorlevel 1 echo Error`    |
| `for %%i in (<list>)` | Loop over items           | `for %%i in (*.ts) do echo %%i` |
| `call <script>`       | Run another batch script  | `call setup.bat`                |

### User & Permission Management

| Command                      | Description              | Example                     |
| ---------------------------- | ------------------------ | --------------------------- |
| `whoami`                     | Show current user        | Show logged-in user         |
| `id <user>`                  | Show user ID (Linux)     | `id ubuntu`                 |
| `useradd <user>`             | Create new user (Linux)  | `useradd newuser`           |
| `userdel <user>`             | Delete user account      | `userdel olduser`           |
| `passwd`                     | Change password          | Interactive password change |
| `sudo passwd <user>`         | Change user password     | Admin privilege             |
| `groups <user>`              | Show user groups (Linux) | List memberships            |
| `usermod -aG <group> <user>` | Add user to group        | Grant permissions           |

---

## 🎯 Tips for Effective Command Use

| Tip                             | Details                                           | Example                                |
| ------------------------------- | ------------------------------------------------- | -------------------------------------- |
| **Combine commands with pipes** | Use `\|` to chain outputs                         | `docker ps \| grep nucleus`            |
| **Redirect output**             | Use `>` to save to file                           | `npm run build > output.log 2>&1`      |
| **Run commands in background**  | Add `&` at end (Windows) or `&` (Unix)            | `pnpm run dev:all &`                   |
| **Use wildcards**               | `*` matches anything, `?` matches single char     | `rm *.log` (delete all logs)           |
| **Tab completion**              | Press Tab to auto-complete                        | Start typing path, press Tab           |
| **Command history**             | Press ↑ to repeat; Ctrl+R to search               | Quick rerun of last commands           |
| **Check exit codes**            | `echo $?` (Unix) or `echo %ERRORLEVEL%` (Windows) | `0` = success, non-zero = error        |
| **Use aliases**                 | Create shortcuts for long commands                | `alias build-all='pnpm run build:all'` |
| **Always test destructive ops** | Run with `-v` (verbose) or `--dry-run`            | Verify before deleting                 |
| **Read command help**           | Add `--help` or `-h` flag                         | `pnpm --help`                          |

---

## 🔗 Cross-Reference: Brain Commands Integration

### Running the Full Stack

```bash
# Terminal 1: Start entire development environment
pnpm run dev:all

# Terminal 2: Monitor imports/exports in watch mode
pnpm run audit:imports:watch

# Terminal 3: Index lexicon and validate
pnpm lexicon:index
pnpm lexicon:validate-all

# Terminal 4: Query brain memory
pnpm memory:query
pnpm memory:stats
```

### Building for Production

```bash
# Full pipeline: lint → typecheck → build
pnpm run build:all

# Or step by step:
pnpm run lint:fix          # Auto-fix lint issues
pnpm run type-check        # Validate types
pnpm run contracts:gen     # Update contracts
pnpm run build             # Build all packages
```

### Python Sidecar Setup

```bash
# Terminal with Python environment
cd apps/py-sidecar
python -m venv .venv

# Activate venv
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

### Contract Consistency

```bash
# Always run after schema changes:
pnpm run contracts:check   # Validate structure
pnpm run contracts:gen     # Regenerate types
pnpm run audit:imports     # Check dependencies
```

---

## 📚 Quick Reference by Use Case

### I want to...

| Goal                     | Commands                                                                      | Time   |
| ------------------------ | ----------------------------------------------------------------------------- | ------ |
| **Start developing**     | `pnpm run dev:all`                                                            | 30s    |
| **Build everything**     | `pnpm run build:all`                                                          | 2–5m   |
| **Check brain memory**   | `pnpm memory:query && pnpm memory:stats`                                      | <1s    |
| **Update lexicon**       | `pnpm lexicon:index && pnpm lexicon:validate-all`                             | 2–10s  |
| **Find a file**          | `find . -name "*.ts" -type f`                                                 | 1s     |
| **Search code**          | `grep -r "searchTerm" --include="*.ts"`                                       | 1–5s   |
| **Clean & rebuild**      | `pnpm run clean && pnpm run build`                                            | 2–10m  |
| **Fix formatting**       | `pnpm run lint:fix`                                                           | 10–30s |
| **Validate contracts**   | `pnpm run contracts:check && pnpm run contracts:gen`                          | 5–15s  |
| **Check port usage**     | `netstat -ano \| findstr :8001` (Windows)                                     | <1s    |
| **Activate Python venv** | `source .venv/bin/activate` (Linux/Mac) or `.venv\Scripts\activate` (Windows) | <1s    |
| **Run Python sidecar**   | `python -m uvicorn app.main:app --reload`                                     | 5s     |

---

## 🆘 Troubleshooting Commands

| Issue                   | Command                                                      | Why                       |
| ----------------------- | ------------------------------------------------------------ | ------------------------- |
| Port already in use     | `netstat -ano \| findstr :PORT`                              | Find process holding port |
| Clear npm cache         | `npm cache clean --force`                                    | Resolve install issues    |
| Clear pnpm store        | `pnpm store prune`                                           | Free disk space           |
| Rebuild all deps        | `pnpm install && pnpm run build`                             | Fix corrupted installs    |
| Kill background process | `kill -9 <PID>` (Unix) or `taskkill /PID <PID> /F` (Windows) | Force stop                |
| Check path              | `echo $PATH` (Unix) or `echo %PATH%` (Windows)               | Verify environment        |
| Verify Node version     | `node --version`                                             | Check compatibility       |
| Verify pnpm version     | `pnpm --version`                                             | Check package manager     |

---

## 📖 Next Steps

- **Brain operations?** → See **Brain Development Commands** section
- **Setting up dev environment?** → See **Development** subsection
- **Stuck on a shell command?** → Run `<command> --help` for built-in docs
- **Need to validate contracts?** → Follow **Contract Consistency** checklist
- **Python sidecar issues?** → Check **Python Sidecar Setup** section

---

**Last Updated:** Session 4 (Speech Normalization Engine) + Command Center Integration
**Maintained By:** Copilot Brain Development Team
