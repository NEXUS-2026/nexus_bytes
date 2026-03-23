require("dotenv").config();
const { Pool } = require("pg");

async function clearData() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in environment");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows } = await pool.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename`
    );

    const tableNames = rows
      .map((r) => r.tablename)
      .filter((name) => name !== "spatial_ref_sys");

    if (!tableNames.length) {
      console.log("No tables found in public schema.");
      return;
    }

    const truncateList = tableNames.map((name) => `"public"."${name}"`).join(", ");

    await pool.query(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE`);

    console.log("Data cleared successfully.");
    console.log(`Tables truncated: ${tableNames.join(", ")}`);
  } finally {
    await pool.end();
  }
}

clearData().catch((err) => {
  console.error("Failed to clear data:", err.message);
  process.exit(1);
});
