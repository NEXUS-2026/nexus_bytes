// scripts/seed.js — Inserts sample data for development and testing
// Usage: node scripts/seed.js

require("dotenv").config({ path: "../backend/.env" });
const { Pool } = require("pg");
const bcrypt   = require("bcryptjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  console.log("🌱 Seeding database…");

  const hash = await bcrypt.hash("password123", 12);

  // ── Users ──────────────────────────────────────────────────────────────────
  const users = await pool.query(`
    INSERT INTO users (email, password_hash, full_name, phone, role, wallet_address, kyc_status)
    VALUES
      ('borrower@demo.com',  $1, 'Ravi Kumar',      '+91-9876543210', 'borrower',  '0xBorrower0000000000000000000000000000000001', 'approved'),
      ('borrower2@demo.com', $1, 'Meena Patel',     '+91-9123456789', 'borrower',  '0xBorrower0000000000000000000000000000000002', 'approved'),
      ('verifier@demo.com',  $1, 'NGO Verifier',    '+91-9000000001', 'verifier',  '0xVerifier000000000000000000000000000000001', 'approved'),
      ('lender@demo.com',    $1, 'Bank Lender',     '+91-9000000002', 'lender',    '0xLender00000000000000000000000000000000001', 'approved'),
      ('admin@demo.com',     $1, 'Platform Admin',  '+91-9000000003', 'admin',     '0xAdmin000000000000000000000000000000000001', 'approved')
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, role
  `, [hash]);

  console.log("✅ Users created:", users.rows.map(u => u.email).join(", "));

  // Get borrower IDs
  const { rows: borrowers } = await pool.query(
    "SELECT id FROM users WHERE role = 'borrower' ORDER BY id LIMIT 2"
  );
  if (!borrowers.length) { console.log("No borrowers found"); return; }

  const b1 = borrowers[0].id;
  const b2 = borrowers[1]?.id;

  // ── Impact score rows ──────────────────────────────────────────────────────
  for (const uid of [b1, b2].filter(Boolean)) {
    await pool.query(`
      INSERT INTO impact_scores (user_id, score) VALUES ($1, 0)
      ON CONFLICT DO NOTHING
    `, [uid]);
  }

  // ── Activities (Borrower 1 — well-scored) ─────────────────────────────────
  const activities1 = [
    { title: "COVID-19 Vaccination",           category: "health",         description: "Received both doses at Primary Health Centre", status: "verified" },
    { title: "Annual Health Checkup 2024",     category: "health",         description: "Complete blood work and physical examination",  status: "verified" },
    { title: "Digital Literacy Certificate",   category: "education",      description: "Completed 40-hour online course via NASSCOM",    status: "verified" },
    { title: "Financial Management Course",    category: "education",      description: "Certificate from NITI Aayog partner institute",  status: "verified" },
    { title: "Tree Plantation Drive",          category: "sustainability", description: "Planted 50 trees with local NGO Jan Van",        status: "verified" },
    { title: "Solar Cookstove Adoption",       category: "sustainability", description: "Switched to solar-powered cookstove for shop",   status: "verified" },
    { title: "Pending Health Activity",        category: "health",         description: "Eye test certificate — awaiting review",         status: "pending" },
  ];

  for (const a of activities1) {
    const crypto = require("crypto");
    const dataHash = "0x" + crypto.createHash("sha256").update(JSON.stringify({ uid: b1, ...a })).digest("hex");
    await pool.query(`
      INSERT INTO activities (user_id, title, description, category, data_hash, status, verified_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [b1, a.title, a.description, a.category, dataHash, a.status, a.status === "verified" ? new Date() : null]);
  }

  // ── Activities (Borrower 2 — low score) ───────────────────────────────────
  if (b2) {
    await pool.query(`
      INSERT INTO activities (user_id, title, description, category, status)
      VALUES ($1, 'First Aid Training', 'Basic first aid with Red Cross', 'health', 'verified')
    `, [b2]);
  }

  // ── Recalculate scores ────────────────────────────────────────────────────
  // b1: 2×health(+10) + 2×education(+20) + 2×sustainability(+15) = 90
  await pool.query("UPDATE impact_scores SET score = 90, last_synced_at = NOW() WHERE user_id = $1", [b1]);
  if (b2) await pool.query("UPDATE impact_scores SET score = 10, last_synced_at = NOW() WHERE user_id = $1", [b2]);

  // ── Sample loan for borrower 1 ─────────────────────────────────────────────
  await pool.query(`
    INSERT INTO loans (user_id, amount, approved_amount, interest_rate, duration_days, status, tier, score_at_apply, decided_at)
    VALUES ($1, 3000.00, 3000.00, 5.00, 90, 'approved', 'low', 90, NOW())
  `, [b1]);

  console.log("\n✅ Seed complete!\n");
  console.log("Demo accounts:");
  console.log("  borrower@demo.com  / password123  (score: 90, low-tier eligible)");
  console.log("  borrower2@demo.com / password123  (score: 10, not eligible)");
  console.log("  verifier@demo.com  / password123");
  console.log("  lender@demo.com    / password123");
  console.log("  admin@demo.com     / password123");

  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
