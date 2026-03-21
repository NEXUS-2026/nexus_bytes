// routes/admin.js
const express  = require("express");
const db       = require("../config/db");
const { authenticate, requireRole } = require("../middleware/auth");
const scoreEngine = require("../services/scoreEngine");

const router = express.Router();

// ─── GET /admin/users — list all users ───────────────────────────────────────

router.get("/users", authenticate, requireRole("admin"), async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.wallet_address,
            u.kyc_status, u.created_at,
            COALESCE(s.score, 0) AS score
     FROM users u
     LEFT JOIN impact_scores s ON s.user_id = u.id
     ORDER BY u.created_at DESC`
  );
  res.json(rows);
});

// ─── PATCH /admin/users/:id/role — change a user's role ──────────────────────

router.patch("/users/:id/role", authenticate, requireRole("admin"), async (req, res) => {
  const { role } = req.body;
  const allowed  = ["borrower", "verifier", "lender", "admin"];
  if (!allowed.includes(role))
    return res.status(400).json({ error: "Invalid role" });

  const { rows } = await db.query(
    "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role",
    [role, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "User not found" });
  res.json(rows[0]);
});

// ─── PATCH /admin/users/:id/kyc — approve or reject KYC ─────────────────────

router.patch("/users/:id/kyc", authenticate, requireRole("admin"), async (req, res) => {
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status))
    return res.status(400).json({ error: "status must be approved or rejected" });

  const { rows } = await db.query(
    "UPDATE users SET kyc_status = $1 WHERE id = $2 RETURNING id, email, kyc_status",
    [status, req.params.id]
  );
  res.json(rows[0]);
});

// ─── POST /admin/score/recalculate-all — recalculate all scores ──────────────

router.post("/score/recalculate-all", authenticate, requireRole("admin"), async (req, res) => {
  const { rows: users } = await db.query("SELECT id FROM users WHERE role = 'borrower'");
  const results = [];
  for (const u of users) {
    const r = await scoreEngine.syncUserScore(u.id);
    results.push({ userId: u.id, score: r.score });
  }
  res.json({ recalculated: results.length, results });
});

// ─── GET /admin/stats — platform overview ────────────────────────────────────

router.get("/stats", authenticate, requireRole("admin"), async (req, res) => {
  const [users, activities, loans, scores] = await Promise.all([
    db.query("SELECT COUNT(*) FROM users"),
    db.query("SELECT status, COUNT(*) FROM activities GROUP BY status"),
    db.query("SELECT status, COUNT(*), SUM(amount) FROM loans GROUP BY status"),
    db.query("SELECT AVG(score) AS avg_score, MAX(score) AS max_score FROM impact_scores"),
  ]);

  res.json({
    totalUsers:  Number(users.rows[0].count),
    activities:  Object.fromEntries(activities.rows.map((r) => [r.status, Number(r.count)])),
    loans:       loans.rows.map((r) => ({ status: r.status, count: Number(r.count), total: Number(r.sum || 0) })),
    avgScore:    Number(scores.rows[0].avg_score || 0).toFixed(1),
    maxScore:    Number(scores.rows[0].max_score || 0),
  });
});

module.exports = router;
