// routes/loan.js
const express  = require("express");
const { body, validationResult } = require("express-validator");
const db       = require("../config/db");
const { authenticate, requireRole } = require("../middleware/auth");
const scoreEngine = require("../services/scoreEngine");
const geminiService = require("../services/gemini");

const router = express.Router();

function computeBorrowerRisk({
  currentScore,
  repaymentRate,
  loanCount,
  pendingLoans,
  rejectedActivities,
  totalActivities,
  kycStatus,
}) {
  let score = 0;
  const factors = [];

  if (repaymentRate === null) {
    score += 20;
    factors.push("limited_repayment_history");
  } else {
    const repaymentPenalty = Math.round((100 - repaymentRate) * 0.45);
    score += repaymentPenalty;
    if (repaymentPenalty >= 20) factors.push("low_repayment_rate");
  }

  if (loanCount > 0) {
    const pendingRatio = pendingLoans / loanCount;
    const pendingPenalty = Math.round(pendingRatio * 20);
    score += pendingPenalty;
    if (pendingPenalty >= 10) factors.push("high_pending_loan_ratio");
  }

  if (totalActivities > 0) {
    const rejectedRatio = rejectedActivities / totalActivities;
    const activityPenalty = Math.round(rejectedRatio * 20);
    score += activityPenalty;
    if (activityPenalty >= 10) factors.push("high_activity_rejection_ratio");
  }

  if (currentScore < 20) {
    score += 20;
    factors.push("very_low_impact_score");
  } else if (currentScore < 50) {
    score += 10;
    factors.push("low_impact_score");
  }

  if (kycStatus === "pending") {
    score += 10;
    factors.push("kyc_pending");
  } else if (kycStatus === "rejected") {
    score += 25;
    factors.push("kyc_rejected");
  }

  const clamped = Math.max(0, Math.min(100, score));
  const level = clamped >= 70 ? "high" : clamped >= 40 ? "medium" : "low";

  return { score: clamped, level, factors };
}

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

      if (score < scoreEngine.SCORE_FLOOR_FOR_LOAN) {
        return res.status(400).json({
          error: "Your Impact Score is too low. Submit and verify more activities first.",
          score, minimumRequired: scoreEngine.SCORE_FLOOR_FOR_LOAN,
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

      const [{ rows: userRows }, { rows: repaymentRows }] = await Promise.all([
        db.query("SELECT kyc_status FROM users WHERE id = $1", [req.user.id]),
        db.query(
          `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'repaid')::int AS repaid
           FROM loans
           WHERE user_id = $1`,
          [req.user.id]
        ),
      ]);

      const total = Number(repaymentRows[0]?.total || 0);
      const repaid = Number(repaymentRows[0]?.repaid || 0);
      const repaymentRate = total > 0 ? Math.round((repaid / total) * 100) : null;

      const terms = scoreEngine.suggestLoanTerms({
        score,
        kycStatus: userRows[0]?.kyc_status || "pending",
        repaymentRate,
        durationDays: Number(duration_days),
      });

      if (amount > terms.maxAmount) {
        return res.status(400).json({
          error: `Your profile currently allows a maximum of INR ${terms.maxAmount}.`,
          maxAmount: terms.maxAmount, tier: terms.tier,
        });
      }

      const { rows } = await db.query(
        `INSERT INTO loans (user_id, amount, interest_rate, duration_days, status, tier, score_at_apply, purpose, due_date)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, NOW() + (($4)::int * INTERVAL '1 day')) RETURNING *`,
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
    const { q, tier, minScore, maxScore, minAmount, maxAmount, sortBy = "applied_at", sortOrder = "asc" } = req.query;
    const where = ["l.status = 'pending'"];
    const params = [];

    if (q) {
      params.push(`%${String(q).trim()}%`);
      where.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (tier && ["low", "medium", "high"].includes(String(tier).toLowerCase())) {
      params.push(String(tier).toLowerCase());
      where.push(`l.tier = $${params.length}`);
    }
    if (minScore !== undefined) {
      const parsed = Number(minScore);
      if (!Number.isNaN(parsed)) {
        params.push(parsed);
        where.push(`COALESCE(s.score, 0) >= $${params.length}`);
      }
    }
    if (maxScore !== undefined) {
      const parsed = Number(maxScore);
      if (!Number.isNaN(parsed)) {
        params.push(parsed);
        where.push(`COALESCE(s.score, 0) <= $${params.length}`);
      }
    }
    if (minAmount !== undefined) {
      const parsed = Number(minAmount);
      if (!Number.isNaN(parsed)) {
        params.push(parsed);
        where.push(`l.amount >= $${params.length}`);
      }
    }
    if (maxAmount !== undefined) {
      const parsed = Number(maxAmount);
      if (!Number.isNaN(parsed)) {
        params.push(parsed);
        where.push(`l.amount <= $${params.length}`);
      }
    }

    const sortable = {
      applied_at: "l.applied_at",
      amount: "l.amount",
      score: "COALESCE(s.score, 0)",
      duration: "l.duration_days",
    };
    const sortField = sortable[String(sortBy).toLowerCase()] || sortable.applied_at;
    const sortDirection = String(sortOrder).toLowerCase() === "desc" ? "DESC" : "ASC";

    const { rows } = await db.query(
      `SELECT l.*, u.full_name, u.email, u.wallet_address, u.phone,
              COALESCE(s.score, 0) AS current_score
       FROM loans l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN impact_scores s ON s.user_id = l.user_id
       WHERE ${where.join(" AND ")}
       ORDER BY ${sortField} ${sortDirection}`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending loans" });
  }
});

// ─── GET /loan/borrowers — lender borrower directory (borrowers with loans) ─

router.get("/borrowers", authenticate, requireRole(["lender", "admin"]), async (req, res) => {
  try {
    const {
      q,
      kyc,
      minScore,
      maxScore,
      sortBy = "last_applied_at",
      sortOrder = "desc",
      limit = 30,
      offset = 0,
    } = req.query;

    const params = [];
    const where = [];

    if (q) {
      params.push(`%${String(q).trim()}%`);
      where.push(`(b.full_name ILIKE $${params.length} OR b.email ILIKE $${params.length})`);
    }
    if (kyc && ["pending", "approved", "rejected"].includes(String(kyc).toLowerCase())) {
      params.push(String(kyc).toLowerCase());
      where.push(`b.kyc_status = $${params.length}`);
    }
    if (minScore !== undefined) {
      const parsed = Number(minScore);
      if (!Number.isNaN(parsed)) {
        params.push(parsed);
        where.push(`COALESCE(s.score, 0) >= $${params.length}`);
      }
    }
    if (maxScore !== undefined) {
      const parsed = Number(maxScore);
      if (!Number.isNaN(parsed)) {
        params.push(parsed);
        where.push(`COALESCE(s.score, 0) <= $${params.length}`);
      }
    }

    const sortable = {
      score: "COALESCE(s.score, 0)",
      loans: "COALESCE(la.loan_count, 0)",
      repaid: "COALESCE(la.repaid_loans, 0)",
      pending: "COALESCE(la.pending_loans, 0)",
      last_applied_at: "la.last_applied_at",
      name: "b.full_name",
    };
    const sortField = sortable[String(sortBy).toLowerCase()] || sortable.last_applied_at;
    const sortDirection = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";

    const parsedLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const parsedOffset = Math.max(Number(offset) || 0, 0);

    params.push(parsedLimit);
    const limitIndex = params.length;
    params.push(parsedOffset);
    const offsetIndex = params.length;

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      WITH borrower_base AS (
        SELECT id, full_name, email, phone, wallet_address, kyc_status, created_at
        FROM users
        WHERE role = 'borrower'
      ),
      loan_agg AS (
        SELECT
          l.user_id,
          COUNT(*) AS loan_count,
          COUNT(*) FILTER (WHERE l.status = 'pending') AS pending_loans,
          COUNT(*) FILTER (WHERE l.status = 'approved') AS approved_loans,
          COUNT(*) FILTER (WHERE l.status = 'repaid') AS repaid_loans,
          MAX(l.applied_at) AS last_applied_at
        FROM loans l
        GROUP BY l.user_id
      ), activity_agg AS (
        SELECT
          a.user_id,
          COUNT(*) FILTER (WHERE a.status = 'verified') AS verified_activities,
          COUNT(*) FILTER (WHERE a.status = 'pending') AS pending_activities,
          COUNT(*) FILTER (WHERE a.status = 'rejected') AS rejected_activities,
          COUNT(*) AS total_activities
        FROM activities a
        GROUP BY a.user_id
      )
      SELECT
        b.id,
        b.full_name,
        b.email,
        b.phone,
        b.wallet_address,
        b.kyc_status,
        b.created_at,
        COALESCE(s.score, 0) AS current_score,
        COALESCE(la.loan_count, 0) AS loan_count,
        COALESCE(la.pending_loans, 0) AS pending_loans,
        COALESCE(la.approved_loans, 0) AS approved_loans,
        COALESCE(la.repaid_loans, 0) AS repaid_loans,
        la.last_applied_at,
        COALESCE(aa.verified_activities, 0) AS verified_activities,
        COALESCE(aa.pending_activities, 0) AS pending_activities,
        COALESCE(aa.rejected_activities, 0) AS rejected_activities,
        COALESCE(aa.total_activities, 0) AS total_activities,
        CASE
          WHEN COALESCE(la.loan_count, 0) = 0 THEN NULL
          ELSE ROUND((COALESCE(la.repaid_loans, 0)::numeric / la.loan_count::numeric) * 100, 0)
        END AS repayment_rate
      FROM borrower_base b
      LEFT JOIN loan_agg la ON b.id = la.user_id
      LEFT JOIN impact_scores s ON s.user_id = b.id
      LEFT JOIN activity_agg aa ON aa.user_id = b.id
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection} NULLS LAST
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    const countQuery = `
      WITH borrower_base AS (
        SELECT id, full_name, email, kyc_status
        FROM users
        WHERE role = 'borrower'
      )
      SELECT COUNT(*)::int AS total
      FROM borrower_base b
      LEFT JOIN impact_scores s ON s.user_id = b.id
      ${whereClause}
    `;

    const [{ rows }, { rows: totalRows }] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, params.length - 2)),
    ]);

    res.json({
      items: rows.map((row) => {
        const repaymentRate = row.repayment_rate !== null ? Number(row.repayment_rate) : null;
        const risk = computeBorrowerRisk({
          currentScore: Number(row.current_score || 0),
          repaymentRate,
          loanCount: Number(row.loan_count || 0),
          pendingLoans: Number(row.pending_loans || 0),
          rejectedActivities: Number(row.rejected_activities || 0),
          totalActivities: Number(row.total_activities || 0),
          kycStatus: row.kyc_status,
        });
        return {
          ...row,
          repayment_rate: repaymentRate,
          risk_level: risk.level,
          risk_score: risk.score,
          risk_factors: risk.factors,
        };
      }),
      total: totalRows[0]?.total || 0,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch borrower directory" });
  }
});

// ─── GET /loan/:id/insight — AI recommendation for lender decision ─────────

router.get("/:id/insight", authenticate, requireRole(["lender", "admin"]), async (req, res) => {
  try {
    const { rows: loanRows } = await db.query(
      `SELECT l.*, u.full_name, u.email, u.kyc_status, u.wallet_address, COALESCE(s.score, 0) AS current_score
       FROM loans l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN impact_scores s ON s.user_id = l.user_id
       WHERE l.id = $1`,
      [req.params.id]
    );

    if (!loanRows.length) return res.status(404).json({ error: "Loan not found" });
    const loan = loanRows[0];

    const [activitiesRes, loansRes] = await Promise.all([
      db.query(
        `SELECT status, category, created_at
         FROM activities
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [loan.user_id]
      ),
      db.query(
        `SELECT amount, approved_amount, status, duration_days, applied_at, decided_at, repaid_at
         FROM loans
         WHERE user_id = $1
         ORDER BY applied_at DESC`,
        [loan.user_id]
      ),
    ]);

    const activities = activitiesRes.rows;
    const borrowerLoans = loansRes.rows;
    const repaidLoans = borrowerLoans.filter((l) => l.status === "repaid").length;
    const pendingLoans = borrowerLoans.filter((l) => l.status === "pending").length;
    const repaymentRate = borrowerLoans.length > 0
      ? Math.round((repaidLoans / borrowerLoans.length) * 100)
      : null;

    const rejectedActivities = activities.filter((a) => a.status === "rejected").length;
    const risk = computeBorrowerRisk({
      currentScore: Number(loan.current_score || 0),
      repaymentRate,
      loanCount: borrowerLoans.length,
      pendingLoans,
      rejectedActivities,
      totalActivities: activities.length,
      kycStatus: loan.kyc_status,
    });

    const verifiedActivities = activities.filter((a) => a.status === "verified").length;
    const rejectedLoans = borrowerLoans.filter((l) => l.status === "rejected").length;

    const insight = await geminiService.generateLoanDecisionInsight({
      loan: {
        id: loan.id,
        amount: Number(loan.amount || 0),
        duration_days: Number(loan.duration_days || 0),
        requested_interest_rate: Number(loan.interest_rate || 0),
        tier: loan.tier,
        applied_at: loan.applied_at,
        purpose: loan.purpose || "",
      },
      borrower: {
        id: loan.user_id,
        full_name: loan.full_name,
        email: loan.email,
        kyc_status: loan.kyc_status,
        current_score: Number(loan.current_score || 0),
        repayment_rate: repaymentRate,
        total_loans: borrowerLoans.length,
        repaid_loans: repaidLoans,
        pending_loans: pendingLoans,
        rejected_loans: rejectedLoans,
        total_activities: activities.length,
        verified_activities: verifiedActivities,
        rejected_activities: rejectedActivities,
      },
      risk: {
        risk_score: risk.score,
        risk_level: risk.level,
        risk_factors: risk.factors,
      },
    });

    res.json({
      loanId: loan.id,
      borrowerId: loan.user_id,
      insight,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate AI insight" });
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

// ─── GET /loan/export — lender CSV export ───────────────────────────────────

router.get("/export", authenticate, requireRole(["lender", "admin"]), async (req, res) => {
  try {
    const { status, fallbackToAll = "true" } = req.query;
    const params = [];
    let where = "";

    if (status && ["pending", "approved", "rejected", "repaid", "repayment_requested"].includes(String(status).toLowerCase())) {
      params.push(String(status).toLowerCase());
      where = `WHERE l.status = $${params.length}`;
    }

    const baseQuery =
      `SELECT
         l.id,
         l.status,
         l.tier,
         l.amount,
         l.approved_amount,
         l.interest_rate,
         l.duration_days,
         l.applied_at,
         l.decided_at,
         l.due_date,
         l.repaid_at,
         l.lender_note,
         u.full_name,
         u.email,
         u.kyc_status,
         COALESCE(s.score, 0) AS current_score
       FROM loans l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN impact_scores s ON s.user_id = l.user_id`;

    let { rows } = await db.query(`${baseQuery} ${where} ORDER BY l.applied_at DESC`, params);

    if (
      rows.length === 0 &&
      status &&
      String(fallbackToAll).toLowerCase() !== "false"
    ) {
      const full = await db.query(`${baseQuery} ORDER BY l.applied_at DESC`);
      rows = full.rows;
      res.setHeader("X-Export-Fallback", "all");
    }

    const headers = [
      "loan_id",
      "borrower_name",
      "borrower_email",
      "kyc_status",
      "status",
      "tier",
      "requested_amount",
      "approved_amount",
      "interest_rate",
      "duration_days",
      "current_score",
      "applied_at",
      "decided_at",
      "due_date",
      "repaid_at",
      "lender_note",
    ];

    const lines = [headers.join(",")];
    rows.forEach((r) => {
      const values = [
        r.id,
        r.full_name,
        r.email,
        r.kyc_status,
        r.status,
        r.tier,
        r.amount,
        r.approved_amount,
        r.interest_rate,
        r.duration_days,
        r.current_score,
        r.applied_at,
        r.decided_at,
        r.due_date,
        r.repaid_at,
        r.lender_note,
      ].map(toCsvCell);
      lines.push(values.join(","));
    });

    const csv = lines.join("\n");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=loan-export-${stamp}.csv`);
    res.status(200).send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export loans" });
  }
});

// ─── GET /loan/borrower/:userId — borrower profile for lender ────────────────

router.get("/borrower/:userId", authenticate, requireRole(["lender", "admin"]), async (req, res) => {
  try {
    const [userRes, scoreRes, activitiesRes, loansRes] = await Promise.all([
      db.query("SELECT id, full_name, email, phone, wallet_address, kyc_status, created_at FROM users WHERE id=$1", [req.params.userId]),
      db.query("SELECT score, last_synced_at FROM impact_scores WHERE user_id=$1", [req.params.userId]),
      db.query(
        `SELECT a.id, a.category, a.status, a.title, a.description, a.ipfs_hash, a.data_hash, a.created_at, a.verified_at,
                v.full_name AS verified_by_name
         FROM activities a
         LEFT JOIN users v ON v.id = a.verified_by
         WHERE a.user_id=$1
         ORDER BY a.created_at DESC`,
        [req.params.userId]
      ),
      db.query("SELECT * FROM loans WHERE user_id=$1 ORDER BY applied_at DESC", [req.params.userId]),
    ]);
    if (!userRes.rows.length) return res.status(404).json({ error: "User not found" });
    const repaidLoans = loansRes.rows.filter(l => l.status === "repaid").length;
    const pendingLoans = loansRes.rows.filter(l => l.status === "pending").length;
    const repaymentRate = loansRes.rows.length > 0 ? Math.round((repaidLoans / loansRes.rows.length) * 100) : null;
    const rejectedActivities = activitiesRes.rows.filter(a => a.status === "rejected").length;
    const risk = computeBorrowerRisk({
      currentScore: Number(scoreRes.rows[0]?.score ?? 0),
      repaymentRate,
      loanCount: loansRes.rows.length,
      pendingLoans,
      rejectedActivities,
      totalActivities: activitiesRes.rows.length,
      kycStatus: userRes.rows[0].kyc_status,
    });
    res.json({
      user:          userRes.rows[0],
      score:         scoreRes.rows[0]?.score ?? 0,
      activities:    activitiesRes.rows,
      loans:         loansRes.rows,
      repaymentRate,
      riskScore: risk.score,
      riskLevel: risk.level,
      riskFactors: risk.factors,
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

function toCsvCell(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

module.exports = router;