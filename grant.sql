-- Berikan izin ke tabel dan sequence-nya agar bisa nambah/edit/hapus data dengan bebas
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kanban_db;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kanban_db;
