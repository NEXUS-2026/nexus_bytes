// routes/activity.js
const express = require("express");
const multer = require("multer");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Activity = require("../models/Activity");
const User = require("../models/User");
const { authenticate, requireRole } = require("../middleware/auth");
const ipfsService = require("../services/ipfs");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── POST /activity — submit a new activity ──────────────────────────────────

router.post(
  "/",
  authenticate,
  requireRole("borrower"),
  upload.single("document"),
  [
    body("title").trim().notEmpty().withMessage("Title required"),
    body("category").isIn(["health", "education", "sustainability"]),
    body("description").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { title, category, description } = req.body;
    let ipfs_hash = null;
    let document_url = null;
    let data_hash = null;

    try {
      // Upload document to Pinata IPFS if configured; otherwise keep a local file URL.
      if (req.file) {
        if (
          process.env.PINATA_JWT ||
          (process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET)
        ) {
          ipfs_hash = await ipfsService.uploadBuffer(
            req.file.buffer,
            req.file.originalname,
          );
          document_url = ipfsService.gatewayUrl(ipfs_hash);
        } else {
          const uploadsDir = path.join(__dirname, "..", "uploads");
          fs.mkdirSync(uploadsDir, { recursive: true });

          const safeName = req.file.originalname.replace(
            /[^a-zA-Z0-9_.-]/g,
            "_",
          );
          const storedName = `${Date.now()}-${safeName}`;
          const fullPath = path.join(uploadsDir, storedName);

          fs.writeFileSync(fullPath, req.file.buffer);
          document_url = `/uploads/${storedName}`;
        }
      }

      // Build deterministic data hash (used on-chain)
      const crypto = require("crypto");
      const payload = JSON.stringify({
        userId: req.user.id,
        title,
        category,
        ipfs_hash,
        document_url,
        ts: Date.now(),
      });
      data_hash =
        "0x" + crypto.createHash("sha256").update(payload).digest("hex");

      const activity = await Activity.create({
        user_id: req.user.id,
        title,
        description: description || null,
        category,
        ipfs_hash,
        document_url,
        data_hash,
      });

      res.status(201).json(activity.toJSON());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to submit activity" });
    }
  },
);

// ─── GET /activity — list activities ─────────────────────────────────────────

router.get("/", authenticate, async (req, res) => {
  const { status, category } = req.query;
  const query = {};

  // Borrowers see only their own; verifiers/admins see all
  if (req.user.role === "borrower") {
    query.user_id = req.user.id;
  }

  if (status) query.status = status;
  if (category) query.category = category;

  const rows = await Activity.find(query)
    .populate("user_id", "full_name email")
    .sort({ created_at: -1 })
    .lean();

  res.json(
    rows.map((row) => {
      const { _id, __v, ...rest } = row;
      return {
        ...rest,
        id: _id.toString(),
        user_id: row.user_id?._id
          ? row.user_id._id.toString()
          : row.user_id?.toString(),
        user_name: row.user_id?.full_name || null,
        user_email: row.user_id?.email || null,
      };
    }),
  );
});

// ─── GET /activity/:id ────────────────────────────────────────────────────────

router.get("/:id", authenticate, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }

  const row = await Activity.findById(req.params.id)
    .populate("user_id", "full_name email")
    .lean();

  if (!row) return res.status(404).json({ error: "Not found" });

  // Borrowers can only see their own
  const ownerId = row.user_id?._id
    ? row.user_id._id.toString()
    : row.user_id.toString();
  if (req.user.role === "borrower" && ownerId !== req.user.id)
    return res.status(403).json({ error: "Forbidden" });

  const user = await User.findById(ownerId).select("full_name email").lean();
  const { _id, __v, ...rest } = row;

  res.json({
    ...rest,
    id: _id.toString(),
    user_id: ownerId,
    user_name: user?.full_name || null,
    user_email: user?.email || null,
  });
});

module.exports = router;
