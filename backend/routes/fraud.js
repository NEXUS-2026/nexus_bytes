const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const FraudDetectionEngine = require("../services/fraudDetection");

const router = express.Router();

// GET /fraud/check/:userId - Check fraud risk for borrower
router.get("/check/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allowverifiers/lenders/system to check
    if (req.user.role === "borrower" && req.user.id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const riskAnalysis = await FraudDetectionEngine.analyzeUserRisk(userId);

    res.json(riskAnalysis);
  } catch (err) {
    console.error("[Fraud Check] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /fraud/alerts - Get list of high-risk borrowers
router.get(
  "/alerts",
  authenticate,
  requireRole("verifier", "lender"),
  async (req, res) => {
    try {
      const alerts = await FraudDetectionEngine.getFraudAlerts(30);

      res.json({
        fraud_alert_count: alerts.length,
        high_risk_borrowers: alerts.slice(0, 20),
        alerts_generated_at: new Date(),
      });
    } catch (err) {
      console.error("[Fraud Alerts] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
