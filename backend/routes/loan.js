// routes/loan.js
const express  = require("express");
const { body, validationResult } = require("express-validator");
const db       = require("../config/db");
const { authenticate, requireRole } = require("../middleware/auth");
const blockchainService = require("../services/blockchain");
const scoreEngine       = require("../services/scoreEngine");

const router = express.Router();

// ─── POST /loan/apply ─────────────────────────────────────────────────────────

router.post(
  "/apply",
  authenticate,
  requireRole("borrower"),
  [
    body("amount").isFloat({ min: 1 }).withMessage("Amount must be positive"),
    body("duration_days").isInt({ min: 7, max: 365 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, duration_days } = req.body;

    try {
      // 1. Fetch current score
      const scoreData = await scoreEngine.getUserScore(req.user.id);
      const score     = scoreData.score;

      // 2. Calculate terms off-chain (mirror contract logic)
      const terms = calculateTerms(score);

      // 3. Persist loan in DB
      const { rows } = await db.query(
        `INSERT INTO loans
           (user_id, amount, interest_rate, duration_days, status, tier, score_at_apply)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          req.user.id, amount, terms.interestRate,
          duration_days, terms.status, terms.tier, score,
        ]
      );
      const loan = rows[0];

      // 4. If borrower has a wallet, submit on-chain
      const { rows: userRows } = await db.query(
        "SELECT wallet_address FROM users WHERE id = $1",
        [req.user.id]
      );
      const wallet = userRows[0]?.wallet_address;

      if (wallet && terms.status !== "rejected") {
        try {
          const amountCents = Math.round(amount * 100);
          const result = await blockchainService.applyLoanOnChain(
            req.user.id, amountCents, duration_days
          );
          await db.query(
            `UPDATE loans
             SET blockchain_loan_id = $1, blockchain_tx = $2, approved_amount = $3,
                 status = $4, decided_at = NOW()
             WHERE id = $5`,
            [result.loanId, result.txHash, terms.approvedAmount, result.status, loan.id]
          );
          loan.blockchain_loan_id = result.loanId;
          loan.blockchain_tx      = result.txHash;
          loan.approved_amount    = terms.approvedAmount;
          loan.status             = result.status;
        } catch (bcErr) {
          console.error("Blockchain loan apply failed:", bcErr.message);
        }
      } else {
        // Off-chain only decision
        await db.query(
          `UPDATE loans
           SET approved_amount = $1, status = $2, decided_at = NOW()
           WHERE id = $3`,
          [terms.approvedAmount, terms.status, loan.id]
        );
        loan.approved_amount = terms.approvedAmount;
        loan.status          = terms.status;
      }

      res.status(201).json({ loan, terms });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Loan application failed" });
    }
  }
);

// ─── GET /loan/status — list user's loans ────────────────────────────────────

router.get("/status", authenticate, async (req, res) => {
  try {
    let query, params;
    if (["admin", "lender"].includes(req.user.role)) {
      query  = "SELECT l.*, u.full_name, u.email FROM loans l JOIN users u ON u.id = l.user_id ORDER BY l.applied_at DESC";
      params = [];
    } else {
      query  = "SELECT * FROM loans WHERE user_id = $1 ORDER BY applied_at DESC";
      params = [req.user.id];
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch loans" });
  }
});

// ─── GET /loan/:id ────────────────────────────────────────────────────────────

router.get("/:id", authenticate, async (req, res) => {
  const { rows } = await db.query("SELECT * FROM loans WHERE id = $1", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Loan not found" });
  if (req.user.role === "borrower" && rows[0].user_id !== req.user.id)
    return res.status(403).json({ error: "Forbidden" });
  res.json(rows[0]);
});

// ─── POST /loan/:id/repay — mark a loan repaid (lender action) ───────────────

router.post("/:id/repay", authenticate, requireRole(["lender", "admin"]), async (req, res) => {
  const { rows } = await db.query(
    "UPDATE loans SET status = 'repaid', updated_at = NOW() WHERE id = $1 RETURNING *",
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Loan not found" });
  res.json(rows[0]);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateTerms(score) {
  if (score < 20) {
    return { status: "rejected", tier: "none", interestRate: 0, approvedAmount: 0 };
  } else if (score > 80) {
    return { status: "approved", tier: "low",    interestRate: 5,  approvedAmount: 5000 };
  } else if (score > 50) {
    return { status: "approved", tier: "medium", interestRate: 12, approvedAmount: 2000 };
  } else {
    return { status: "approved", tier: "high",   interestRate: 20, approvedAmount: 500 };
  }
}

module.exports = router;
