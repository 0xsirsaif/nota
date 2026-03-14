-- Sessions table (core entity)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    scheduled_for TEXT,
    started_at TEXT,
    paused_at TEXT,
    ended_at TEXT,

    total_elapsed_seconds INTEGER DEFAULT 0,
    active_elapsed_seconds INTEGER DEFAULT 0,
    break_elapsed_seconds INTEGER DEFAULT 0,

    goal_summary TEXT,
    goal_specific TEXT,
    goal_measurable TEXT,
    goal_achievable TEXT,
    goal_relevant TEXT,
    goal_time_bound TEXT,

    expected_output TEXT,
    outcome_summary TEXT,
    reflection_summary TEXT,
    success_criteria_met INTEGER,

    notes_markdown_path TEXT NOT NULL,
    reflection_markdown_path TEXT,

    toggl_workspace_id TEXT,
    toggl_project_id TEXT,
    toggl_time_entry_id TEXT,
    last_toggl_sync_at TEXT,
    toggl_sync_status TEXT CHECK (toggl_sync_status IN ('pending', 'synced', 'failed')),

    tags TEXT
);

-- Attachments (files and links)
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('file', 'link')),
    label TEXT,
    file_path TEXT,
    url TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Timer state (for crash recovery)
CREATE TABLE IF NOT EXISTS timer_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active_session_id TEXT,
    state TEXT CHECK (state IN ('idle', 'running', 'paused')),
    last_tick_at TEXT,
    accumulated_seconds INTEGER DEFAULT 0,
    started_at TEXT,
    paused_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (active_session_id) REFERENCES sessions(id)
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT
);

-- Insert default timer state
INSERT OR IGNORE INTO timer_state (id, state, accumulated_seconds) VALUES (1, 'idle', 0);
