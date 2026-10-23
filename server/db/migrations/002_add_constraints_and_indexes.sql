DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tasks_priority') THEN
        ALTER TABLE tasks ADD CONSTRAINT chk_tasks_priority CHECK (priority IN ('Low', 'Medium', 'High'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tasks_position') THEN
        ALTER TABLE tasks ADD CONSTRAINT chk_tasks_position CHECK (position >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_boards_position') THEN
        ALTER TABLE boards ADD CONSTRAINT chk_boards_position CHECK (position >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_boards_position ON boards(position ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_board_position ON tasks(board_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
