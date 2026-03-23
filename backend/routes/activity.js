// routes/activity.js
const express  = require("express");
const multer   = require("multer");
const { body, validationResult } = require("express-validator");
const db       = require("../config/db");
const { authenticate, requireRole } = require("../middleware/auth");
const ipfsService = require("../services/ipfs");

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const ALLOWED_CATEGORIES = ["health", "education", "sustainability", "livelihood", "digital", "community"];

// ─── POST /activity — submit a new activity ──────────────────────────────────

router.post(
  "/",
  authenticate,
  requireRole("borrower"),
  upload.single("document"),
  [
    body("title").trim().notEmpty().withMessage("Title required"),
    body("category").isIn(ALLOWED_CATEGORIES),
    body("description").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, category, description } = req.body;
    let ipfs_hash = null;
    let data_hash = null;

    try {
      // Upload document to IPFS if provided
      if (req.file) {
        ipfs_hash = await ipfsService.uploadBuffer(req.file.buffer, req.file.originalname);
      }

      // Build deterministic data hash (used on-chain)
      const crypto = require("crypto");
      const payload = JSON.stringify({ userId: req.user.id, title, category, ipfs_hash, ts: Date.now() });
      data_hash = "0x" + crypto.createHash("sha256").update(payload).digest("hex");

      const { rows } = await db.query(
        `INSERT INTO activities (user_id, title, description, category, ipfs_hash, data_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.user.id, title, description || null, category, ipfs_hash, data_hash]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to submit activity" });
    }
  }
);

// ─── GET /activity — list activities ─────────────────────────────────────────

router.get("/", authenticate, async (req, res) => {
  const { status, category } = req.query;
  let whereClause = "";
  const params = [];

  // Borrowers see only their own; verifiers/admins see all
  if (req.user.role === "borrower") {
    params.push(req.user.id);
    whereClause = `WHERE a.user_id = $${params.length}`;
  }

  if (status) {
    params.push(status);
    whereClause += (whereClause ? " AND " : "WHERE ") + `a.status = $${params.length}`;
  }
  if (category) {
    params.push(category);
    whereClause += (whereClause ? " AND " : "WHERE ") + `a.category = $${params.length}`;
  }

  const { rows } = await db.query(
    `SELECT a.*, u.full_name AS user_name, u.email AS user_email
     FROM activities a
     JOIN users u ON u.id = a.user_id
     ${whereClause}
     ORDER BY a.created_at DESC`,
    params
  );
  res.json(rows);
});

// ─── GET /activity/:id ────────────────────────────────────────────────────────

router.get("/:id", authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.*, u.full_name AS user_name, u.email AS user_email
     FROM activities a JOIN users u ON u.id = a.user_id
     WHERE a.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });

  // Borrowers can only see their own
  if (req.user.role === "borrower" && rows[0].user_id !== req.user.id)
    return res.status(403).json({ error: "Forbidden" });

  res.json(rows[0]);
});

module.exports = router;
