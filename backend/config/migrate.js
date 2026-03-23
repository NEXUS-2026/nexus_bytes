// config/migrate.js
// Runs all SQL migrations in this directory in lexical order.

require("dotenv").config({ path: "../backend/.env" });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const migrationsDir = __dirname;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    console.log("No SQL migrations found.");
    await pool.end();
    return;
  }

  console.log(`Running ${files.length} migration files...`);

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, "utf8");
    console.log(`Applying ${file}...`);
    await pool.query(sql);
  }

  console.log("Migrations completed successfully.");
  await pool.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
