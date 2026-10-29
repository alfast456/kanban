const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const migrationsDir = path.join(__dirname, 'server', 'db', 'migrations');
const pool = new Pool({
    user: process.env.DB_MIGRATION_USER || process.env.DB_USER,
    password: process.env.DB_MIGRATION_PASSWORD || process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    connectionTimeoutMillis: 5000,
});

function migrations() {
    return fs.readdirSync(migrationsDir)
        .filter(file => /^\d+_.+\.sql$/.test(file))
        .sort()
        .map(file => ({
            name: file,
            sql: fs.readFileSync(path.join(migrationsDir, file), 'utf8'),
        }));
}

function checksum(sql) {
    return crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

async function runMigration() {
    console.log('Menjalankan migrasi database...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY,
                checksum TEXT NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const applied = await client.query('SELECT name, checksum FROM schema_migrations');
        const appliedByName = new Map(applied.rows.map(row => [row.name, row.checksum]));
        const migrationFiles = migrations();

        if (!appliedByName.size) {
            const legacySchema = path.join(__dirname, 'server', 'db', 'schema.sql');
            const legacySql = fs.readFileSync(legacySchema, 'utf8').trim();
            if (legacySql && !legacySql.startsWith('-- Schema changes are managed')) {
                await client.query(legacySql);
                for (const migration of migrationFiles) {
                    await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [migration.name, checksum(migration.sql)]);
                }
                await client.query('COMMIT');
                console.log('Legacy schema terdeteksi; migration history diinisialisasi.');
                return;
            }
        }

        for (const migration of migrationFiles) {
            const hash = checksum(migration.sql);
            const existingHash = appliedByName.get(migration.name);
            if (existingHash && existingHash !== hash) {
                throw new Error(`Migrasi ${migration.name} sudah berubah setelah diterapkan`);
            }
            if (existingHash) continue;

            await client.query(migration.sql);
            await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [migration.name, hash]);
            console.log(`Diterapkan: ${migration.name}`);
        }

        await client.query('COMMIT');
        console.log('Migrasi database selesai.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migrasi gagal:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
