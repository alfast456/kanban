CREATE TABLE IF NOT EXISTS board_members (
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('viewer', 'editor')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (board_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_board_members_user_id ON board_members(user_id);

CREATE TABLE IF NOT EXISTS task_checklist_items (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task_position ON task_checklist_items(task_id, position);

CREATE TABLE IF NOT EXISTS labels (
    id SERIAL PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name VARCHAR(40) NOT NULL CHECK (length(trim(name)) > 0),
    color CHAR(7) NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (board_id, name)
);

CREATE TABLE IF NOT EXISTS task_labels (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS task_attachments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL CHECK (length(trim(name)) > 0),
    url TEXT NOT NULL CHECK (url ~ '^https?://'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_activity (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task_created_at ON task_activity(task_id, created_at DESC);
