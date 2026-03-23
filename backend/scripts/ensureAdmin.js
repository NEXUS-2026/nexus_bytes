// scripts/ensureAdmin.js
// Usage: node scripts/ensureAdmin.js

require("dotenv").config({ path: "../backend/.env" });
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureAdmin() {
  const email = process.env.DEFAULT_ADMIN_EMAIL || "admin@demo.com";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "password123";
  const fullName = process.env.DEFAULT_ADMIN_NAME || "Platform Admin";
  const phone = process.env.DEFAULT_ADMIN_PHONE || "+91-9000000003";

  const passwordHash = await bcrypt.hash(password, 12);

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, phone, role, kyc_status, access_status, access_reviewed_at)
     VALUES ($1, $2, $3, $4, 'admin', 'approved', 'approved', NOW())
     ON CONFLICT (email)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       phone = EXCLUDED.phone,
       role = 'admin',
       kyc_status = 'approved',
       access_status = 'approved',
       access_reviewed_at = NOW(),
       access_review_note = 'System ensured admin access'
     RETURNING id, email, role`,
    [email, passwordHash, fullName, phone]
  );

  console.log("Admin account ready:");
  console.log(`  email: ${rows[0].email}`);
  console.log(`  password: ${password}`);
  console.log(`  role: ${rows[0].role}`);

  await pool.end();
}

ensureAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
