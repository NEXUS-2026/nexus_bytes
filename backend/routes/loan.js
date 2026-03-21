// routes/loan.js
const express  = require("express");
const { body, validationResult } = require("express-validator");
const db       = require("../config/db");
const { authenticate, requireRole } = require("../middleware/auth");
const scoreEngine = require("../services/scoreEngine");

const router = express.Router();

// ─── POST /loan/apply ─────────────────────────────────────────────────────────

router.post(
  "/apply",
  authenticate,
  requireRole("borrower"),
  [
    body("amount").isFloat({ min: 1 }).withMessage("Amount must be positive"),
    body("duration_days").isInt({ min: 7, max: 365 }),
    body("purpose").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, duration_days, purpose } = req.body;

    try {
      const scoreData = await scoreEngine.getUserScore(req.user.id);
      const score     = scoreData.score;

      if (score < 20) {
        return res.status(400).json({
          error: "Your Impact Score is too low. Submit and verify more activities first.",
          score, minimumRequired: 20,
        });
      }

      // Block duplicate active loan
      const { rows: existing } = await db.query(
        `SELECT id FROM loans WHERE user_id = $1 AND status IN ('pending','approved','repayment_requested') LIMIT 1`,
        [req.user.id]
      );
      if (existing.length) {
        return res.status(400).json({
          error: "You already have an active or pending loan. Repay it before applying again.",
          existingLoanId: existing[0].id,
        });
      }

      const terms = calculateTerms(score);

      if (amount > terms.maxAmount) {
        return res.status(400).json({
          error: `Your score tier allows a maximum of $${terms.maxAmount}.`,
          maxAmount: terms.maxAmount, tier: terms.tier,
        });
      }

      const { rows } = await db.query(
        `INSERT INTO loans (user_id, amount, interest_rate, duration_days, status, tier, score_at_apply, purpose)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7) RETURNING *`,
        [req.user.id, amount, terms.interestRate, duration_days, terms.tier, score, purpose || null]
      );

      res.status(201).json({
        loan: rows[0], terms,
        message: "Application submitted. A lender will review it shortly.",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Loan application failed" });
    }
  }
);

// ─── GET /loan/pending — lender sees pending loans ────────────────────────────

router.get("/pending", authenticate, requireRole(["lender", "admin"]), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT l.*, u.full_name, u.email, u.wallet_address, u.phone,
              COALESCE(s.score, 0) AS current_score
       FROM loans l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN impact_scores s ON s.user_id = l.user_id
       WHERE l.status = 'pending'
       ORDER BY l.applied_at ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending loans" });
  }
});

// ─── GET /loan/status ─────────────────────────────────────────────────────────

router.get("/status", authenticate, async (req, res) => {
  try {
    let query, params;
    if (["admin", "lender"].includes(req.user.role)) {
      query  = `SELECT l.*, u.full_name, u.email, COALESCE(s.score,0) AS current_score
                FROM loans l JOIN users u ON u.id=l.user_id
                LEFT JOIN impact_scores s ON s.user_id=l.user_id
                ORDER BY l.applied_at DESC`;
      params = [];
    } else {
      query  = "SELECT * FROM loans WHERE user_id=$1 ORDER BY applied_at DESC";
      params = [req.user.id];
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch loans" });
  }
});

// ─── GET /loan/borrower/:userId — borrower profile for lender ────────────────

router.get("/borrower/:userId", authenticate, requireRole(["lender", "admin"]), async (req, res) => {
  try {
    const [userRes, scoreRes, activitiesRes, loansRes] = await Promise.all([
      db.query("SELECT id, full_name, email, phone, wallet_address, kyc_status, created_at FROM users WHERE id=$1", [req.params.userId]),
      db.query("SELECT score, last_synced_at FROM impact_scores WHERE user_id=$1", [req.params.userId]),
      db.query("SELECT category, status, title, created_at FROM activities WHERE user_id=$1 ORDER BY created_at DESC", [req.params.userId]),
      db.query("SELECT * FROM loans WHERE user_id=$1 ORDER BY applied_at DESC", [req.params.userId]),
    ]);
    if (!userRes.rows.length) return res.status(404).json({ error: "User not found" });
    const repaidLoans = loansRes.rows.filter(l => l.status === "repaid").length;
    res.json({
      user:          userRes.rows[0],
      score:         scoreRes.rows[0]?.score ?? 0,
      activities:    activitiesRes.rows,
      loans:         loansRes.rows,
      repaymentRate: loansRes.rows.length > 0 ? Math.round((repaidLoans / loansRes.rows.length) * 100) : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch borrower profile" });
  }
});

// ─── POST /loan/:id/decide — lender approves or rejects ──────────────────────

router.post(
  "/:id/decide",
  authenticate,
  requireRole(["lender", "admin"]),
  [
    body("action").isIn(["approve", "reject"]),
    body("approved_amount").optional().isFloat({ min: 1 }),
    body("interest_rate").optional().isFloat({ min: 0, max: 100 }),
    body("lender_note").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { action, approved_amount, interest_rate, lender_note } = req.body;

    try {
      const { rows } = await db.query("SELECT * FROM loans WHERE id = $1", [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: "Loan not found" });
      if (rows[0].status !== "pending") return res.status(400).json({ error: "Loan is not pending" });

      if (action === "reject") {
        if (!lender_note?.trim()) return res.status(400).json({ error: "Rejection reason is required" });
        const { rows: updated } = await db.query(
          `UPDATE loans SET status='rejected', rejection_reason=$1, lender_id=$2, decided_at=NOW(), updated_at=NOW()
           WHERE id=$3 RETURNING *`,
          [lender_note, req.user.id, req.params.id]
        );
        return res.json({ message: "Loan rejected", loan: updated[0] });
      }

      // Approve — lender can override amount and rate
      const finalAmount = approved_amount || rows[0].amount;
      const finalRate   = interest_rate   || rows[0].interest_rate;

      const { rows: updated } = await db.query(
        `UPDATE loans SET status='approved', approved_amount=$1, interest_rate=$2,
         lender_note=$3, lender_id=$4, decided_at=NOW(), updated_at=NOW()
         WHERE id=$5 RETURNING *`,
        [finalAmount, finalRate, lender_note || null, req.user.id, req.params.id]
      );
      res.json({ message: "Loan approved", loan: updated[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Decision failed" });
    }
  }
);


// ─── GET /loan/:id ────────────────────────────────────────────────────────────

router.get("/:id", authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT l.*, u.full_name, u.email FROM loans l JOIN users u ON u.id=l.user_id WHERE l.id=$1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Loan not found" });
  if (req.user.role === "borrower" && rows[0].user_id !== req.user.id)
    return res.status(403).json({ error: "Forbidden" });
  res.json(rows[0]);
});

// ─── POST /loan/:id/repay ─────────────────────────────────────────────────────

router.post("/:id/repay", authenticate, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM loans WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Loan not found" });
    const loan = rows[0];

    if (req.user.role === "borrower") {
      if (loan.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
      if (loan.status !== "approved") return res.status(400).json({ error: "Loan is not active" });
      const { rows: u } = await db.query(
        `UPDATE loans SET status='repayment_requested', updated_at=NOW() WHERE id=$1 RETURNING *`, [loan.id]
      );
      return res.json({ message: "Repayment requested. Awaiting lender confirmation.", loan: u[0] });
    }

    if (["lender", "admin"].includes(req.user.role)) {
      const { rows: u } = await db.query(
        `UPDATE loans SET status='repaid', repaid_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`, [loan.id]
      );
      return res.json({ message: "Repayment confirmed.", loan: u[0] });
    }

    return res.status(403).json({ error: "Forbidden" });
  } catch (err) {
    res.status(500).json({ error: "Repayment action failed" });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateTerms(score) {
  if (score < 20) return { tier: "none",   interestRate: 0,  maxAmount: 0 };
  if (score > 80) return { tier: "low",    interestRate: 5,  maxAmount: 5000 };
  if (score > 50) return { tier: "medium", interestRate: 12, maxAmount: 2000 };
  return           { tier: "high",   interestRate: 20, maxAmount: 500 };
}

module.exports = router;