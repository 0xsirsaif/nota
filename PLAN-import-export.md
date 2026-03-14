# Feature Plan: Import/Export & Backup System

## 1. Problem Statement & User Goals

**Primary Use Cases:**
- User wants to backup their study session data to cloud storage (Dropbox, Google Drive)
- User bought a new laptop and wants to migrate their Nota data
- User wants to share a specific project/session with a colleague
- User wants to archive old sessions to free up space but keep them accessible
- User wants to export notes as clean markdown for publishing/blogging

**Non-Goals (Out of Scope for V1):**
- Automatic cloud sync (this is manual import/export)
- Real-time collaboration
- Mobile app sync

## 2. Data Model & Scope

**What Gets Exported:**
```
Export Bundle (.nota or .zip)
├── manifest.json           # Version, timestamp, export type
├── database/
│   └── sessions.json       # SQLite sessions table as JSON
│   └── settings.json       # App settings
│   └── timer_state.json    # Current timer state
├── notes/                  # Markdown files
│   └── 2026/
│       └── 03/
│           └── 2026-03-13_143022_session-slug/
│               ├── notes.md
│               └── reflection.md
└── attachments/            # Referenced files (optional)
    └── files/
        └── ...
```

**Export Granularity Options:**
1. **Full Backup** - Everything (SQLite + all markdown + attachments)
2. **Sessions Only** - Just the SQLite data, no files
3. **Notes Only** - Just markdown files (for publishing)
4. **Selective** - Filter by date range, tags, status

## 3. UX Flow & UI Design

### 3.1 Entry Points
- **Settings Modal** → New "Data & Backup" section
- **Keyboard shortcut** (Ctrl/Cmd + Shift + E for export)
- **File menu** (if we add one later)

### 3.2 Export Flow

```
[Settings] → [Data & Backup]

┌─────────────────────────────────────┐
│ Data & Backup                       │
├─────────────────────────────────────┤
│                                     │
│ EXPORT                              │
│ ┌─────────────────────────────────┐ │
│ │ 📦 Full Backup (Recommended)    │ │
│ │    Includes sessions, notes,    │ │
│ │    attachments, and settings    │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 📝 Sessions Data Only           │ │
│ │    Just the database, no files  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 📄 Notes as Markdown            │ │
│ │    For publishing or sharing    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Advanced: Selective Export ▼]      │
│                                     │
│ IMPORT                              │
│ ┌─────────────────────────────────┐ │
│ │ 📥 Import from Backup           │ │
│ │    Restore from .nota file      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Danger Zone                         │
│ [Delete All Data]                   │
└─────────────────────────────────────┘
```

### 3.3 Export Dialog (Full Backup)

```
┌─────────────────────────────────────┐
│ Export Full Backup                  │
│ ─────────────────────────────────── │
│                                     │
│ Include:                            │
│ ☑ Sessions (47 sessions)            │
│ ☑ Notes & Reflections (94 files)    │
│ ☑ Attachments (12 files, 45 MB)     │
│ ☑ Settings & Preferences            │
│                                     │
│ File name:                          │
│ [nota-backup-2026-03-14.nota  ]     │
│                                     │
│ Format:                             │
│ (•) Single .nota file (compressed)  │
│ ( ) ZIP archive                     │
│ ( ) Uncompressed folder             │
│                                     │
│ Location:                           │
│ [/home/user/backups/            ]   │
│ [Choose...]                         │
│                                     │
│              [Cancel]  [Export ▶]   │
└─────────────────────────────────────┘
```

### 3.4 Import Flow with Conflict Resolution

```
┌─────────────────────────────────────┐
│ Import Backup                       │
│ ─────────────────────────────────── │
│                                     │
│ Selected: nota-backup-2026-03-14    │
│                                     │
│ Contents:                           │
│ • 47 sessions (12 active, 35 done)  │
│ • Created: 2026-03-14               │
│ • Nota version: 0.1.0               │
│                                     │
│ ⚠️  23 sessions already exist       │
│    (same IDs found in your data)    │
│                                     │
│ Conflict Resolution:                │
│ (•) Skip existing, import new only  │
│ ( ) Replace with backup versions    │
│ ( ) Keep both (rename duplicates)   │
│                                     │
│ [Cancel]           [Preview] [Import│
└─────────────────────────────────────┘
```

### 3.5 Progress & Status

Export/Import can take time for large datasets. Need:
- Progress modal with % and file count
- Cancel button
- Error state with "View details"
- Success toast with "Open folder" action

```
┌─────────────────────────────────────┐
│ Exporting...                        │
│ ████████████████░░░░  78%           │
│                                     │
│ Processing: attachments/large.pdf   │
│                                     │
│ Sessions: 47/47 ✓                   │
│ Notes: 94/94 ✓                      │
│ Attachments: 9/12...                │
│                                     │
│                 [Cancel]            │
└─────────────────────────────────────┘
```

## 4. Backend Architecture (Rust)

### 4.1 Command Surface

```rust
// Export commands
#[tauri::command]
async fn export_full_backup(
    app: AppHandle,
    path: String,
    options: ExportOptions,
) -> Result<ExportResult>;

#[tauri::command]
async fn export_sessions_json(
    app: AppHandle,
    path: String,
    filter: Option<SessionFilter>,
) -> Result<ExportResult>;

#[tauri::command]
async fn export_markdown_bundle(
    app: AppHandle,
    path: String,
    filter: Option<SessionFilter>,
) -> Result<ExportResult>;

// Import commands
#[tauri::command]
async fn validate_import_file(
    path: String,
) -> Result<ImportValidation>;

#[tauri::command]
async fn import_backup(
    app: AppHandle,
    path: String,
    conflict_strategy: ConflictStrategy,
) -> Result<ImportResult>;

// Progress tracking (for long operations)
#[tauri::command]
async fn get_export_progress(
    operation_id: String,
) -> Option<ProgressInfo>;
```

### 4.2 Data Structures

```rust
// manifest.json schema
#[derive(Serialize, Deserialize)]
struct ExportManifest {
    version: String,           // "1.0.0"
    nota_version: String,      // app version that created it
    exported_at: DateTime<Utc>,
    export_type: ExportType,   // Full, SessionsOnly, NotesOnly
    stats: ExportStats,
}

#[derive(Serialize, Deserialize)]
struct ExportStats {
    session_count: usize,
    note_file_count: usize,
    attachment_count: usize,
    total_size_bytes: u64,
}

#[derive(Serialize, Deserialize)]
struct ImportValidation {
    valid: bool,
    manifest: Option<ExportManifest>,
    errors: Vec<String>,
    conflicts: Vec<SessionConflict>,
}

#[derive(Serialize, Deserialize)]
struct SessionConflict {
    session_id: String,
    title: String,
    local_modified: DateTime<Utc>,
    backup_modified: DateTime<Utc>,
}
```

### 4.3 File Organization

```rust
// Export pipeline
pub async fn export_full(
    app: &AppHandle,
    destination: &Path,
    options: &ExportOptions,
) -> Result<ExportResult> {
    // 1. Create temp directory
    // 2. Export SQLite tables to JSON
    // 3. Copy markdown files preserving structure
    // 4. Copy attachments (if included)
    // 5. Write manifest.json
    // 6. Compress to .nota (ZIP with custom extension)
    // 7. Move to destination
    // 8. Clean up temp
}

// Import pipeline
pub async fn import_backup(
    app: &AppHandle,
    source: &Path,
    strategy: ConflictStrategy,
) -> Result<ImportResult> {
    // 1. Validate manifest
    // 2. Check version compatibility
    // 3. Scan for conflicts
    // 4. If conflicts and strategy not set, return conflict list
    // 5. Extract to temp
    // 6. Begin transaction
    // 7. Import sessions (handle conflicts per strategy)
    // 8. Copy markdown files
    // 9. Copy attachments
    // 10. Import settings (optional?)
    // 11. Commit transaction
    // 12. Clean up
}
```

### 4.4 Error Handling & Safety

**Must Handle:**
- Disk full during export
- Corrupted/invalid import file
- Version mismatch (backup from future version)
- Missing attachment files (referenced in DB but not in backup)
- Permission errors (read-only destination)
- Concurrent operations (prevent export during import)

**Transaction Safety:**
- Import should be atomic - rollback on failure
- Create backup of current DB before import (auto-backup)
- Don't delete or overwrite until validation passes

## 5. Frontend State Management

### 5.1 New Store: `backupStore.ts`

```typescript
interface BackupState {
  // Export state
  exportInProgress: boolean;
  exportProgress: ExportProgress | null;

  // Import state
  importInProgress: boolean;
  importValidation: ImportValidation | null;
  importPreview: ImportPreview | null;

  // Actions
  exportFull: (path: string, options: ExportOptions) => Promise<void>;
  exportSessions: (path: string, filter?: SessionFilter) => Promise<void>;
  validateImport: (path: string) => Promise<ImportValidation>;
  importBackup: (path: string, strategy: ConflictStrategy) => Promise<void>;
  cancelOperation: () => void;
}
```

### 5.2 Progress Streaming

For large operations, use Tauri events:
```rust
// Emit progress events from Rust
app.emit("export-progress", ProgressEvent {
    operation_id: "...",
    percent: 78,
    current_file: "attachments/large.pdf",
    processed: 150,
    total: 194,
});
```

```typescript
// Listen in frontend
listen('export-progress', (event) => {
  backupStore.setProgress(event.payload);
});
```

## 6. UI Components Needed

1. **`ExportDialog`** - Main export configuration
2. **`ImportDialog`** - File selection and conflict resolution
3. **`ProgressModal`** - Operation progress with cancel
4. **`ConflictResolver`** - Table showing conflicts with options
5. **`BackupSettings`** - New section in Settings modal
6. **`SuccessToast`** - With "Open folder" action
7. **`ErrorToast`** - With "View details" expandable

## 7. File Format Specifications

### 7.1 .nota File Format

Actually a ZIP file with custom extension:

```
magic bytes: PK (standard ZIP)
file extension: .nota
mime-type: application/vnd.nota.backup

internal structure:
  manifest.json        - at root
  database/            - JSON exports
  notes/               - markdown tree
  attachments/         - binary files
```

### 7.2 Version Compatibility

```rust
// Manifest version compatibility check
fn is_compatible(manifest_version: &str) -> bool {
    // Current manifest format is "1.0.0"
    // We support reading 1.x.x
    // We write 1.0.0
    manifest_version.starts_with("1.")
}
```

## 8. Security Considerations

1. **Path Traversal** - Ensure extracted files don't escape target directory
2. **File Size Limits** - Prevent OOM from malicious backup claiming huge size
3. **Validation** - Verify JSON schema before importing to DB
4. **Temp Directory** - Use secure temp, clean up on panic/crash

## 9. Testing Strategy

**Unit Tests (Rust):**
- Export manifest generation
- Import validation (valid/invalid files)
- Conflict detection logic
- Version compatibility checks

**Integration Tests:**
- Full export → import roundtrip
- Import with each conflict strategy
- Progress event emission
- Cancel operation mid-flight

**Manual Tests:**
- Large dataset (1000+ sessions)
- Missing attachment files
- Corrupted ZIP
- Cross-platform paths (Windows/Linux)

## 10. Open Questions

1. **Auto-backup?** Should we offer scheduled automatic backups?
2. **Compression level?** Trade-off between speed and size
3. **Encryption?** Password-protect sensitive study data?
4. **Cloud integrations?** Direct export to Dropbox/Drive APIs?
5. **Partial restore?** Can user restore just one session from backup?

## 11. Implementation Phases

### Phase 1: Core Export (MVP)
- Full backup to .nota file
- Progress indication
- Settings UI

### Phase 2: Import & Conflicts
- Import validation
- Conflict resolution UI
- Safety checks

### Phase 3: Selective & Polish
- Selective export (date filters)
- Markdown-only export
- Import preview
- Auto-backup option

---

**Estimated Effort:** 2-3 days for Phase 1, 2 days for Phase 2, 2 days for Phase 3
