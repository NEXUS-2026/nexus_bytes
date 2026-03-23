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
            u.kyc_status, u.access_status, u.access_review_note, u.access_reviewed_at, u.created_at,
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

  if (Number(req.params.id) === Number(req.user.id) && role !== "admin") {
    return res.status(400).json({ error: "You cannot remove your own admin role" });
  }

  const accessStatus = ["verifier", "lender"].includes(role) ? "pending" : "approved";

  const { rows } = await db.query(
    `UPDATE users
     SET role = $1,
         access_status = $2,
         access_reviewed_by = $3,
         access_reviewed_at = NOW(),
         access_review_note = $4
     WHERE id = $5
     RETURNING id, email, role, access_status`,
    [role, accessStatus, req.user.id, `Role changed to ${role} by admin`, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "User not found" });
  res.json(rows[0]);
});

// ─── PATCH /admin/users/:id/access — approve/reject verifier/lender login ───

router.patch("/users/:id/access", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { status, review_note } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "status must be approved, rejected, or pending" });
    }

    const { rows: userRows } = await db.query("SELECT id, role FROM users WHERE id = $1", [req.params.id]);
    if (!userRows.length) return res.status(404).json({ error: "User not found" });
    const target = userRows[0];

    if (!["verifier", "lender"].includes(target.role)) {
      return res.status(400).json({ error: "Only verifier or lender access can be reviewed" });
    }

    const { rows } = await db.query(
      `UPDATE users
       SET access_status = $1,
           access_review_note = $2,
           access_reviewed_by = $3,
           access_reviewed_at = NOW()
       WHERE id = $4
       RETURNING id, email, role, access_status, access_review_note, access_reviewed_at`,
      [status, review_note || null, req.user.id, req.params.id]
    );

    res.json({ message: `Access ${status}`, user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update access status" });
  }
});

// ─── GET /admin/verifiers — verifier-specific analytics ─────────────────────

router.get("/verifiers", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.access_status,
         u.access_reviewed_at,
         COUNT(v.id)::int AS total_reviews,
         COUNT(v.id) FILTER (WHERE v.action = 'approve')::int AS approvals,
         COUNT(v.id) FILTER (WHERE v.action = 'reject')::int AS rejections,
         COUNT(v.id) FILTER (WHERE v.created_at >= NOW() - INTERVAL '24 hours')::int AS reviews_last_24h,
         ROUND(
           CASE WHEN COUNT(v.id) = 0 THEN 0
                ELSE (COUNT(v.id) FILTER (WHERE v.action = 'reject')::numeric / COUNT(v.id)::numeric) * 100
           END,
           1
         ) AS rejection_rate
       FROM users u
       LEFT JOIN verification_audit_logs v ON v.verifier_id = u.id
       WHERE u.role = 'verifier'
       GROUP BY u.id
       ORDER BY total_reviews DESC, u.created_at DESC`
    );

    const items = rows.map((r) => {
      const flags = [];
      if (Number(r.reviews_last_24h) >= 30) flags.push("high_velocity_reviews");
      if (Number(r.total_reviews) >= 10 && Number(r.rejection_rate) >= 85) flags.push("excessive_rejections");
      return {
        ...r,
        risk_level: flags.length >= 2 ? "high" : flags.length === 1 ? "medium" : "low",
        risk_flags: flags,
      };
    });

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch verifier analytics" });
  }
});

// ─── GET /admin/lenders — lender-specific analytics ─────────────────────────

router.get("/lenders", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.access_status,
         u.access_reviewed_at,
         COUNT(l.id)::int AS total_decisions,
         COUNT(l.id) FILTER (WHERE l.status = 'approved')::int AS approvals,
         COUNT(l.id) FILTER (WHERE l.status = 'rejected')::int AS rejections,
         COUNT(l.id) FILTER (WHERE l.status = 'repaid')::int AS repaid,
         ROUND(AVG(COALESCE(l.interest_rate, 0))::numeric, 2) AS avg_interest_rate,
         ROUND(
           CASE WHEN COUNT(l.id) = 0 THEN 0
                ELSE (COUNT(l.id) FILTER (WHERE l.status = 'rejected')::numeric / COUNT(l.id)::numeric) * 100
           END,
           1
         ) AS rejection_rate
       FROM users u
       LEFT JOIN loans l ON l.lender_id = u.id
       WHERE u.role = 'lender'
       GROUP BY u.id
       ORDER BY total_decisions DESC, u.created_at DESC`
    );

    const items = rows.map((r) => {
      const flags = [];
      if (Number(r.total_decisions) >= 8 && Number(r.rejection_rate) >= 80) flags.push("very_high_rejection_pattern");
      if (Number(r.avg_interest_rate || 0) > 24) flags.push("high_interest_pattern");
      return {
        ...r,
        risk_level: flags.length >= 2 ? "high" : flags.length === 1 ? "medium" : "low",
        risk_flags: flags,
      };
    });

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch lender analytics" });
  }
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

// ─── GET /admin/kyc/submissions — review queue ───────────────────────────────

router.get("/kyc/submissions", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = "";
    if (status && ["pending", "approved", "rejected"].includes(String(status).toLowerCase())) {
      params.push(String(status).toLowerCase());
      where = `WHERE k.status = $${params.length}`;
    }

    const { rows } = await db.query(
      `SELECT
         k.*, u.full_name, u.email, u.phone, u.wallet_address, u.kyc_status,
         r.full_name AS reviewed_by_name
       FROM borrower_kyc_submissions k
       JOIN users u ON u.id = k.user_id
       LEFT JOIN users r ON r.id = k.reviewed_by
       ${where}
       ORDER BY k.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch KYC submissions" });
  }
});

// ─── PATCH /admin/kyc/:id — approve/reject a submission ─────────────────────

router.patch("/kyc/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { status, review_note } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "status must be approved or rejected" });
    }

    const { rows: submissionRows } = await db.query(
      `SELECT * FROM borrower_kyc_submissions WHERE id = $1`,
      [req.params.id]
    );
    if (!submissionRows.length) return res.status(404).json({ error: "Submission not found" });

    const submission = submissionRows[0];
    const { rows: updatedRows } = await db.query(
      `UPDATE borrower_kyc_submissions
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_note = $3
       WHERE id = $4
       RETURNING *`,
      [status, req.user.id, review_note || null, req.params.id]
    );

    await db.query("UPDATE users SET kyc_status = $1 WHERE id = $2", [status, submission.user_id]);

    res.json({
      message: `KYC ${status}`,
      submission: updatedRows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update KYC submission" });
  }
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
