// server.js — Express entry point
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const activityRoutes = require("./routes/activity");
const verificationRoutes = require("./routes/verification");
const scoreRoutes = require("./routes/score");
const scoreExplainRoutes = require("./routes/scoreExplain");
const loanRoutes = require("./routes/loan");
const verifierAnalyticsRoutes = require("./routes/verifierAnalytics");
const lenderAnalyticsRoutes = require("./routes/lenderAnalytics");
const kycRoutes = require("./routes/kyc");
const fraudRoutes = require("./routes/fraud");
const defaultRoutes = require("./routes/default");
const { connectDB } = require("./config/db");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";
const enableRateLimitInDev =
  String(process.env.ENABLE_RATE_LIMIT_IN_DEV || "false").toLowerCase() ===
  "true";
const shouldApplyRateLimit = isProduction || enableRateLimitInDev;

// ─── Security middleware ──────────────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Global + auth rate limits are enabled in production.
// In development they are off by default to avoid local lockouts.
if (shouldApplyRateLimit) {
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: Number(process.env.RATE_LIMIT_MAX || 100),
      message: { error: "Too many requests, please try again later" },
    }),
  );
}

const authLimiter = shouldApplyRateLimit
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
      message: {
        error:
          "Too many login attempts. Please wait a few minutes and try again.",
      },
    })
  : (req, res, next) => next();

// ─── General middleware ───────────────────────────────────────────────────────

app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/health", (_, res) =>
  res.json({ status: "ok", timestamp: new Date() }),
);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/auth", authLimiter, authRoutes);
app.use("/activity", activityRoutes);
app.use("/verify", verificationRoutes);
app.use("/verifier", verifierAnalyticsRoutes);
app.use("/score", scoreRoutes);
app.use("/score", scoreExplainRoutes);
app.use("/loan", loanRoutes);
app.use("/lender", lenderAnalyticsRoutes);
app.use("/kyc", kycRoutes);
app.use("/fraud", fraudRoutes);
app.use("/default", defaultRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\n🚀 ImpactScore API running on port ${PORT}`);
      console.log(`   ENV: ${process.env.NODE_ENV || "development"}`);
      console.log(
        `   DB:  ${process.env.MONGODB_URI ? "connected" : "⚠ MONGODB_URI not set"}`,
      );
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
