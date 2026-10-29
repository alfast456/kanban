-- Tambahkan updated_at pada tabel boards jika belum ada
ALTER TABLE boards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Fungsi trigger otomatis untuk memperbarui updated_at saat baris diubah
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pasang trigger updated_at pada tasks
DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at_column();

-- Pasang trigger updated_at pada boards
DROP TRIGGER IF EXISTS trigger_boards_updated_at ON boards;
CREATE TRIGGER trigger_boards_updated_at
    BEFORE UPDATE ON boards
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at_column();

-- Tambahkan indeks performa untuk foreign key dan pencarian case-insensitive
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_labels_label_id ON task_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task_id ON task_checklist_items(task_id);
CREATE INDEX IF NOT EXISTS idx_labels_board_id ON labels(board_id);
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email)) WHERE email IS NOT NULL;

-- Constraint validasi integritas data (tidak boleh hanya spasi kosong)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tasks_content_non_empty') THEN
        ALTER TABLE tasks ADD CONSTRAINT chk_tasks_content_non_empty CHECK (length(trim(content)) > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_boards_title_non_empty') THEN
        ALTER TABLE boards ADD CONSTRAINT chk_boards_title_non_empty CHECK (length(trim(title)) > 0);
    END IF;
END $$;

