// routes/verification.js
const express = require("express");
const db      = require("../config/db");
const { authenticate, requireRole } = require("../middleware/auth");
const blockchainService = require("../services/blockchain");
const scoreEngine       = require("../services/scoreEngine");

const router = express.Router();
const VERIFICATION_CATEGORIES = ["health", "education", "sustainability", "livelihood", "digital", "community"];

async function createVerificationAuditLog({
  activityId,
  verifierId,
  action,
  oldStatus,
  newStatus,
  rejectionNote = null,
  decisionNote = null,
}) {
  try {
    await db.query(
      `INSERT INTO verification_audit_logs (
        activity_id, verifier_id, action, old_status, new_status, rejection_note, decision_note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [activityId, verifierId, action, oldStatus, newStatus, rejectionNote, decisionNote]
    );
  } catch (err) {
    // Keep core verification path resilient even if audit insert fails.
    console.error("Failed to write verification audit log:", err.message);
  }
}

// ─── POST /verify — verifier approves or rejects an activity ─────────────────

router.post("/", authenticate, requireRole(["verifier", "admin"]), async (req, res) => {
  const { activity_id, action, rejection_note, decision_note } = req.body;

  if (!activity_id || !["approve", "reject"].includes(action))
    return res.status(400).json({ error: "activity_id and action (approve|reject) required" });

  try {
    // Fetch activity
    const { rows: actRows } = await db.query(
      "SELECT * FROM activities WHERE id = $1",
      [activity_id]
    );
    if (!actRows.length) return res.status(404).json({ error: "Activity not found" });
    const activity = actRows[0];

    if (activity.status !== "pending")
      return res.status(400).json({ error: "Activity already processed" });

    if (action === "reject") {
      await db.query(
        `UPDATE activities
         SET status = 'rejected', verified_by = $1, verified_at = NOW(), rejection_note = $2
         WHERE id = $3`,
        [req.user.id, rejection_note || "Not approved", activity_id]
      );

      await createVerificationAuditLog({
        activityId: activity_id,
        verifierId: req.user.id,
        action: "reject",
        oldStatus: activity.status,
        newStatus: "rejected",
        rejectionNote: rejection_note || "Not approved",
        decisionNote: decision_note || null,
      });

      // Re-sync score so rejected activities immediately reduce borrower score.
      const updated = await scoreEngine.syncUserScore(activity.user_id);

      return res.json({ message: "Activity rejected", activity_id, updatedScore: updated.score });
    }

    // ── APPROVE ──────────────────────────────────────────────────────────────

    // 1. Get borrower wallet
    const { rows: userRows } = await db.query(
      "SELECT wallet_address FROM users WHERE id = $1",
      [activity.user_id]
    );
    const borrowerWallet = userRows[0]?.wallet_address;

    // 2. Store on blockchain (only if borrower has wallet connected)
let txHash = null;
let onChainId = null;
if (borrowerWallet) {
  try {
    const result = await blockchainService.storeActivityOnChain(
      borrowerWallet,
      activity.data_hash,
      activity.category
    );
    txHash    = result.txHash;
    onChainId = result.activityId;
  } catch (bcErr) {
    console.error("Blockchain write failed:", bcErr.message);
  }
}

    // 3. Update DB
    await db.query(
      `UPDATE activities
       SET status = 'verified', verified_by = $1, verified_at = NOW(),
           blockchain_tx = $2, on_chain_id = $3
       WHERE id = $4`,
      [req.user.id, txHash, onChainId, activity_id]
    );

    await createVerificationAuditLog({
      activityId: activity_id,
      verifierId: req.user.id,
      action: "approve",
      oldStatus: activity.status,
      newStatus: "verified",
      decisionNote: decision_note || null,
    });

    // 4. Recalculate & sync impact score
    await scoreEngine.syncUserScore(activity.user_id);

    res.json({ message: "Activity approved & stored on chain", txHash, onChainId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// ─── GET /verify/pending — list pending activities for verifier ───────────────

router.get("/pending", authenticate, requireRole(["verifier", "admin"]), async (req, res) => {
  try {
    const {
      q,
      category,
      sortBy = "created_at",
      sortOrder = "asc",
      limit = 20,
      offset = 0,
    } = req.query;

    const params = [];
    const where = ["a.status = 'pending'"];

    if (q) {
      params.push(`%${String(q).trim()}%`);
      where.push(`(a.title ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (category && VERIFICATION_CATEGORIES.includes(String(category).toLowerCase())) {
      params.push(String(category).toLowerCase());
      where.push(`a.category = $${params.length}`);
    }

    const sortable = {
      created_at: "a.created_at",
      title: "a.title",
      category: "a.category",
    };
    const sortField = sortable[String(sortBy).toLowerCase()] || sortable.created_at;
    const sortDirection = String(sortOrder).toLowerCase() === "desc" ? "DESC" : "ASC";

    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const parsedOffset = Math.max(Number(offset) || 0, 0);

    params.push(parsedLimit);
    const limitIndex = params.length;
    params.push(parsedOffset);
    const offsetIndex = params.length;

    const whereClause = where.join(" AND ");

    const pendingQuery = `
      SELECT a.*, u.full_name, u.email, u.wallet_address
      FROM activities a
      JOIN users u ON u.id = a.user_id
      WHERE ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM activities a
      JOIN users u ON u.id = a.user_id
      WHERE ${whereClause}
    `;

    const [pendingResult, totalResult, userVelocityResult, duplicateHashResult, userCategoryProfileResult, userRejectProfileResult] = await Promise.all([
      db.query(pendingQuery, params),
      db.query(countQuery, params.slice(0, params.length - 2)),
      db.query(
        `SELECT user_id, COUNT(*)::int AS count_24h
         FROM activities
         WHERE created_at >= NOW() - INTERVAL '24 hours'
         GROUP BY user_id`
      ),
      db.query(
        `SELECT data_hash, COUNT(*)::int AS hash_count
         FROM activities
         WHERE data_hash IS NOT NULL
         GROUP BY data_hash
         HAVING COUNT(*) > 1`
      ),
      db.query(
        `SELECT user_id, category, COUNT(*)::int AS category_count
         FROM activities
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY user_id, category`
      ),
      db.query(
        `SELECT
           user_id,
           COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_count,
           COUNT(*)::int AS total_count
         FROM activities
         GROUP BY user_id`
      ),
    ]);

    const velocityMap = new Map(userVelocityResult.rows.map((r) => [Number(r.user_id), Number(r.count_24h)]));
    const duplicateHashSet = new Set(duplicateHashResult.rows.map((r) => r.data_hash));
    const categoryMap = new Map();
    userCategoryProfileResult.rows.forEach((r) => {
      const userId = Number(r.user_id);
      const count = Number(r.category_count);
      const prev = categoryMap.get(userId) || { total: 0, max: 0 };
      const next = {
        total: prev.total + count,
        max: Math.max(prev.max, count),
      };
      categoryMap.set(userId, next);
    });
    const rejectRateMap = new Map(
      userRejectProfileResult.rows.map((r) => {
        const totalCount = Number(r.total_count || 0);
        const rejected = Number(r.rejected_count || 0);
        const rejectRate = totalCount > 0 ? rejected / totalCount : 0;
        return [Number(r.user_id), { rejectRate, totalCount }];
      })
    );

    const items = pendingResult.rows.map((row) => {
      const flags = [];
      const reasons = [];
      let riskScore = 0;

      const recent = velocityMap.get(Number(row.user_id)) || 0;
      if (recent >= 5) {
        flags.push("high_submission_velocity");
        reasons.push({ key: "high_submission_velocity", weight: 45 });
        riskScore += 45;
      } else if (recent >= 3) {
        flags.push("moderate_submission_velocity");
        reasons.push({ key: "moderate_submission_velocity", weight: 25 });
        riskScore += 25;
      }

      if (row.data_hash && duplicateHashSet.has(row.data_hash)) {
        flags.push("duplicate_hash_seen");
        reasons.push({ key: "duplicate_hash_seen", weight: 40 });
        riskScore += 40;
      }

      if (!row.wallet_address) {
        flags.push("borrower_wallet_missing");
        reasons.push({ key: "borrower_wallet_missing", weight: 10 });
        riskScore += 10;
      }

      const categoryProfile = categoryMap.get(Number(row.user_id));
      if (categoryProfile && categoryProfile.total >= 5) {
        const concentration = categoryProfile.max / categoryProfile.total;
        if (concentration >= 0.85) {
          flags.push("single_category_spike");
          reasons.push({ key: "single_category_spike", weight: 20 });
          riskScore += 20;
        }
      }

      const rejectProfile = rejectRateMap.get(Number(row.user_id));
      if (rejectProfile && rejectProfile.totalCount >= 4) {
        if (rejectProfile.rejectRate >= 0.5) {
          flags.push("historically_high_rejection_rate");
          reasons.push({ key: "historically_high_rejection_rate", weight: 25 });
          riskScore += 25;
        } else if (rejectProfile.rejectRate >= 0.3) {
          flags.push("moderate_rejection_rate");
          reasons.push({ key: "moderate_rejection_rate", weight: 12 });
          riskScore += 12;
        }
      }

      return {
        ...row,
        fraud: {
          riskScore: Math.min(riskScore, 100),
          riskLevel: riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low",
          flags,
          reasons,
          recentSubmissions24h: recent,
        },
      };
    });

    res.json({
      items,
      total: totalResult.rows[0]?.total || 0,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pending activities" });
  }
});

// ─── GET /verify/audit — recent verification decisions ───────────────────────

router.get("/audit", authenticate, requireRole(["verifier", "admin"]), async (req, res) => {
  try {
    const { activityId, verifierId, limit = 25, offset = 0 } = req.query;
    const params = [];
    const where = [];

    if (activityId !== undefined) {
      const parsed = Number(activityId);
      if (!Number.isNaN(parsed)) {
        params.push(parsed);
        where.push(`v.activity_id = $${params.length}`);
      }
    }
    if (verifierId !== undefined) {
      const parsed = Number(verifierId);
      if (!Number.isNaN(parsed)) {
        params.push(parsed);
        where.push(`v.verifier_id = $${params.length}`);
      }
    }
    if (req.user.role === "verifier") {
      params.push(req.user.id);
      where.push(`v.verifier_id = $${params.length}`);
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const parsedOffset = Math.max(Number(offset) || 0, 0);
    params.push(parsedLimit);
    const limitIndex = params.length;
    params.push(parsedOffset);
    const offsetIndex = params.length;

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await db.query(
      `SELECT v.*, a.title AS activity_title, u.full_name AS verifier_name
       FROM verification_audit_logs v
       JOIN activities a ON a.id = v.activity_id
       JOIN users u ON u.id = v.verifier_id
       ${whereClause}
       ORDER BY v.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch verification audit history" });
  }
});

// ─── GET /verify/context/:activityId — review context for verifier ───────────

router.get("/context/:activityId", authenticate, requireRole(["verifier", "admin"]), async (req, res) => {
  try {
    const { rows: activityRows } = await db.query(
      `SELECT a.*, u.full_name, u.email, u.wallet_address, u.kyc_status
       FROM activities a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = $1`,
      [req.params.activityId]
    );
    if (!activityRows.length) return res.status(404).json({ error: "Activity not found" });

    const activity = activityRows[0];

    const [scoreRes, recentActivitiesRes, loanSummaryRes] = await Promise.all([
      db.query("SELECT score, last_synced_at FROM impact_scores WHERE user_id = $1", [activity.user_id]),
      db.query(
        `SELECT id, title, category, status, created_at
         FROM activities
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 6`,
        [activity.user_id]
      ),
      db.query(
        `SELECT
           COUNT(*)::int AS total_loans,
           COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_loans,
           COUNT(*) FILTER (WHERE status = 'repaid')::int AS repaid_loans,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_loans
         FROM loans
         WHERE user_id = $1`,
        [activity.user_id]
      ),
    ]);

    const loanSummary = loanSummaryRes.rows[0] || {
      total_loans: 0,
      approved_loans: 0,
      repaid_loans: 0,
      pending_loans: 0,
    };
    const totalLoans = Number(loanSummary.total_loans || 0);
    const repaidLoans = Number(loanSummary.repaid_loans || 0);
    const repaymentRate = totalLoans > 0 ? Math.round((repaidLoans / totalLoans) * 100) : null;

    res.json({
      borrower: {
        id: activity.user_id,
        full_name: activity.full_name,
        email: activity.email,
        wallet_address: activity.wallet_address,
        kyc_status: activity.kyc_status,
      },
      score: scoreRes.rows[0]?.score ?? 0,
      score_last_synced_at: scoreRes.rows[0]?.last_synced_at || null,
      recent_activities: recentActivitiesRes.rows,
      loan_summary: {
        total: totalLoans,
        approved: Number(loanSummary.approved_loans || 0),
        repaid: repaidLoans,
        pending: Number(loanSummary.pending_loans || 0),
        repayment_rate: repaymentRate,
      },
      activity: {
        id: activity.id,
        title: activity.title,
        category: activity.category,
        status: activity.status,
        description: activity.description,
        ipfs_hash: activity.ipfs_hash,
        data_hash: activity.data_hash,
        created_at: activity.created_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch verification context" });
  }
});

module.exports = router;
