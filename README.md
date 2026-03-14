# Nota

A Linux-first desktop study session app for intentional learning.

> *"Nota" — from Latin, meaning a note, mark, annotation, or recorded thought.*

## Overview

Nota helps you define intentional study sessions, capture notes during focused work, measure time, and reflect after completion. It preserves a meaningful record of your learning journey as markdown artifacts.

## Features

### Core Functionality
- **SMART Goals**: Define Specific, Measurable, Achievable, Relevant, Time-bound objectives for every session
- **Time Tracking**: Start/pause/resume/stop timer with crash recovery
- **Rich Notes**: Notion-like editor that persists as clean markdown files
- **Session Reflection**: Post-session wrap-up with success rating and learnings
- **File Attachments**: Link local files and URLs to sessions

### Toggl Integration
- Connect to Toggl Track for time entry sync
- Automatic workspace/project selection
- Offline sync queue for resilience
- Local time remains source of truth

### Design
- **3-Region Workspace**: Left sidebar (session list), Center workspace (active session), Right inspector (metadata & attachments)
- **Focus Mode**: Distraction-free timer overlay for deep work
- **Dark-first UI**: Calm, minimal, Linux-desktop-friendly aesthetic

## Technical Stack

| Layer | Technology |
|-------|------------|
| Framework | Tauri 2 (Rust backend) |
| Frontend | React 19 + TypeScript 5 |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Editor | Tiptap 2 (ProseMirror) |
| Database | SQLite (tauri-plugin-sql) |
| Icons | Lucide React |

## Development

### Prerequisites
- Node.js 18+
- Rust toolchain
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri:dev

# Build for production
pnpm tauri:build
```

## Architecture

### Data Storage

**SQLite** (`~/.local/share/com.nota.app/app.db`):
- Sessions, SMART goal fields
- Timer state metadata
- Attachment metadata
- Toggl integration state
- App settings

**Markdown Files** (`~/.local/share/com.nota.app/sessions/`):
```
sessions/
├── 2026/
│   ├── 03/
│   │   ├── 2026-03-13_143022_session-slug/
│   │   │   ├── notes.md
│   │   │   └── reflection.md
```

## UI Design Philosophy

This app follows the **tauri-ui** design patterns:
- shadcn/ui-based component structure
- Tailwind CSS styling conventions
- Desktop-grade titlebar/window treatment
- Calm surfaces, subtle separators, compact radius
- Strong spacing discipline

## Timer Engine

The timer is designed for reliability:
1. **State transitions are persisted immediately** to SQLite
2. **Elapsed time is calculated from timestamps**, not stored "current time"
3. **Crash recovery** recalculates from persisted state on startup
4. **Single active session** enforced at app level

```
State Machine:
  PLANNED → ACTIVE (start) → PAUSED (pause) → ACTIVE (resume) → COMPLETED (stop)
```

## License

MIT
