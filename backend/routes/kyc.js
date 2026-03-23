const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { authenticate, requireRole } = require("../middleware/auth");
const KYC = require("../models/KYC");
const User = require("../models/User");
const ipfsService = require("../services/ipfs");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /kyc/upload-document - Borrower uploads KYC document
router.post(
  "/upload-document",
  authenticate,
  requireRole("borrower"),
  upload.single("document"),
  async (req, res) => {
    try {
      const { document_type, reset_previous = false } = req.body;

      if (!document_type || !req.file) {
        return res
          .status(400)
          .json({ error: "document_type and document file required" });
      }

      if (!ipfsService.hasPinataCredentials()) {
        return res.status(500).json({
          error:
            "Pinata is not configured. Set PINATA_JWT or PINATA_API_KEY/PINATA_API_SECRET.",
        });
      }

      const ipfsHash = await ipfsService.uploadBuffer(
        req.file.buffer,
        req.file.originalname,
      );
      const file_url = ipfsService.gatewayUrl(ipfsHash);

      const userId = new mongoose.Types.ObjectId(req.user.id);
      let kyc = await KYC.findOne({ user_id: userId });

      if (!kyc) {
        kyc = new KYC({
          user_id: userId,
          kyc_status: "pending_review",
        });
      }

      // When borrower starts a fresh submission after reject/resubmission request,
      // discard old evidence so verifiers only see the new document set.
      const resetPrevious =
        String(reset_previous) === "true" || reset_previous === true;
      if (resetPrevious) {
        kyc.evidence = [];
      }

      // Add new evidence
      kyc.evidence.push({
        document_type,
        file_url,
        verification_status: "pending",
      });

      kyc.kyc_status = "pending_review";
      kyc.updated_at = new Date();

      await kyc.save();

      res.json({
        message: "Document uploaded successfully",
        kyc_status: kyc.kyc_status,
        documents_count: kyc.evidence.length,
      });
    } catch (err) {
      console.error("[KYC Upload] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /kyc/status - Get borrower's KYC status
router.get("/status", authenticate, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    let kyc = await KYC.findOne({ user_id: userId });

    if (!kyc) {
      kyc = new KYC({ user_id: userId });
      await kyc.save();
    }

    res.json({
      kyc_status: kyc.kyc_status,
      risk_score: kyc.risk_score,
      risk_factors: kyc.risk_factors,
      document_count: kyc.evidence.length,
      approved: kyc.kyc_status === "approved",
      max_loan_allowed: kyc.max_approved_loan_amount,
      last_updated: kyc.updated_at,
    });
  } catch (err) {
    console.error("[KYC Status] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /kyc/verify/:userId - Verifier approves/rejects KYC
router.post(
  "/verify/:userId",
  authenticate,
  requireRole("verifier"),
  async (req, res) => {
    try {
      const { action, notes, risk_factors, risk_score, max_loan_amount } =
        req.body;

      if (
        !["approved", "rejected", "resubmission_requested"].includes(action)
      ) {
        return res.status(400).json({ error: "Invalid action" });
      }

      const targetUserId = new mongoose.Types.ObjectId(req.params.userId);
      const verifierId = new mongoose.Types.ObjectId(req.user.id);

      let kyc = await KYC.findOne({ user_id: targetUserId });
      if (!kyc) {
        return res.status(404).json({ error: "KYC not found" });
      }

      // Add to verification history
      kyc.verification_history.push({
        action,
        verifier_id: verifierId,
        timestamp: new Date(),
        notes,
      });

      if (action === "approved") {
        kyc.kyc_status = "approved";
        kyc.overall_verified_by = verifierId;
        kyc.overall_verification_date = new Date();
        kyc.max_approved_loan_amount = max_loan_amount || 5000;
      } else if (action === "rejected") {
        kyc.kyc_status = "rejected";
        kyc.overall_verification_date = new Date();
      } else if (action === "resubmission_requested") {
        kyc.kyc_status = "resubmission_required";
      }

      if (risk_score !== undefined) {
        kyc.risk_score = risk_score;
      }

      if (risk_factors) {
        kyc.risk_factors = risk_factors;
      }

      kyc.overall_verification_notes = notes;
      kyc.updated_at = new Date();

      await kyc.save();

      res.json({
        message: `KYC ${action} successfully`,
        kyc_status: kyc.kyc_status,
        risk_score: kyc.risk_score,
      });
    } catch (err) {
      console.error("[KYC Verify] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /kyc/pending - Get pending KYC reviews for verifier
router.get(
  "/pending",
  authenticate,
  requireRole("verifier"),
  async (req, res) => {
    try {
      const pending = await KYC.find({
        kyc_status: "pending_review",
      })
        .select("user_id kyc_status evidence risk_score created_at")
        .populate("user_id", "full_name email")
        .sort({ updatedAt: 1 })
        .limit(50);

      res.json({
        pending_count: pending.length,
        pending_kyc_reviews: pending.map((k) => ({
          kyc_id: k._id.toString(),
          borrower: k.user_id,
          documents_submitted: k.evidence.length,
          evidence: k.evidence,
          risk_score: k.risk_score,
          status: k.kyc_status,
          submitted_at: k.created_at,
        })),
      });
    } catch (err) {
      console.error("[KYC Pending] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /kyc/document/:kycId/:documentId - Stream document for verifier/owner borrower
router.get("/document/:kycId/:documentId", authenticate, async (req, res) => {
  try {
    const { kycId, documentId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(kycId) ||
      !mongoose.Types.ObjectId.isValid(documentId)
    ) {
      return res.status(400).json({ error: "Invalid document reference" });
    }

    const kyc = await KYC.findById(kycId).select("user_id evidence").lean();
    if (!kyc) {
      return res.status(404).json({ error: "KYC record not found" });
    }

    const isVerifier = req.user.role === "verifier";
    const isOwnerBorrower =
      req.user.role === "borrower" && kyc.user_id?.toString() === req.user.id;

    if (!isVerifier && !isOwnerBorrower) {
      return res
        .status(403)
        .json({ error: "Not allowed to access this document" });
    }

    const doc = (kyc.evidence || []).find(
      (item) => item._id.toString() === documentId,
    );
    if (!doc || !doc.file_url) {
      return res.status(404).json({ error: "Document not found" });
    }

    // For Pinata/gateway URLs, proxy bytes via backend for consistent access.
    if (/^https?:\/\//i.test(doc.file_url)) {
      const remote = await fetch(doc.file_url);
      if (!remote.ok) {
        return res
          .status(502)
          .json({ error: "Failed to fetch remote document" });
      }

      const contentType =
        remote.headers.get("content-type") || "application/octet-stream";
      const remoteBuffer = Buffer.from(await remote.arrayBuffer());
      const extensionMap = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      const extension = extensionMap[contentType] || "bin";
      const fileName = `${doc.document_type}-${doc._id}.${extension}`;
      const disposition =
        req.query.download === "true" ? "attachment" : "inline";

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename=\"${fileName}\"`,
      );
      return res.send(remoteBuffer);
    }

    // Blob URLs are local to the uploader browser session and unusable elsewhere.
    if (/^blob:/i.test(doc.file_url)) {
      return res.status(410).json({
        error:
          "Legacy document URL is no longer accessible. Borrower must re-upload this document.",
      });
    }

    // New uploads are stored as data URLs.
    const match = doc.file_url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: "Unsupported document format" });
    }

    const mimeType = match[1] || "application/octet-stream";
    const base64Data = match[2];
    const binary = Buffer.from(base64Data, "base64");

    const extensionMap = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensionMap[mimeType] || "bin";
    const fileName = `${doc.document_type}-${doc._id}.${extension}`;
    const disposition = req.query.download === "true" ? "attachment" : "inline";

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename=\"${fileName}\"`,
    );
    return res.send(binary);
  } catch (err) {
    console.error("[KYC Document] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /kyc/:userId/details - Get full KYC details for review
router.get(
  "/:userId/details",
  authenticate,
  requireRole("verifier"),
  async (req, res) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.params.userId);
      const kyc = await KYC.findOne({ user_id: userId })
        .populate("user_id", "full_name email wallet_address")
        .populate("verification_history.verifier_id", "full_name")
        .lean();

      if (!kyc) {
        return res.status(404).json({ error: "KYC not found" });
      }

      res.json({
        kyc: kyc,
        borrower_profile: kyc.user_id,
        documents: kyc.evidence,
        verification_history: kyc.verification_history,
        risk_assessment: {
          risk_score: kyc.risk_score,
          risk_factors: kyc.risk_factors,
          pep_status: kyc.pep_check_status,
        },
      });
    } catch (err) {
      console.error("[KYC Details] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
