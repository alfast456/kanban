-- Jalankan sebagai admin database.
-- Ganti kanban_db dengan role aplikasi sesuai deployment.
-- Aplikasi tidak mendapat hak CREATE/ALTER/DROP.

GRANT CONNECT ON DATABASE kanban_db TO kanban_db;
GRANT USAGE ON SCHEMA public TO kanban_db;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE boards, tasks, users, board_members, task_checklist_items, labels, task_labels, task_attachments, task_activity TO kanban_db;
GRANT USAGE, SELECT ON SEQUENCE boards_id_seq, tasks_id_seq, users_id_seq, task_checklist_items_id_seq, labels_id_seq, task_attachments_id_seq, task_activity_id_seq TO kanban_db;

-- Untuk deployment baru, migration dijalankan oleh role terpisah.
-- REVOKE CREATE ON SCHEMA public FROM kanban_db;
