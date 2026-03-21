// server.js — Express entry point
const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const morgan       = require("morgan");
const rateLimit    = require("express-rate-limit");
require("dotenv").config();

const authRoutes         = require("./routes/auth");
const activityRoutes     = require("./routes/activity");
const verificationRoutes = require("./routes/verification");
const scoreRoutes        = require("./routes/score");
const loanRoutes         = require("./routes/loan");
const adminRoutes        = require("./routes/admin");

const app  = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;

// ─── Security middleware ──────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

// Global rate limit: 100 req / 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { error: "Too many requests, please try again later" },
}));

// Stricter rate limit on auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// ─── General middleware ───────────────────────────────────────────────────────

app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/health", (_, res) => res.json({ status: "ok", timestamp: new Date() }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/auth",     authLimiter, authRoutes);
app.use("/activity", activityRoutes);
app.use("/verify",   verificationRoutes);
app.use("/score",    scoreRoutes);
app.use("/loan",     loanRoutes);
app.use("/admin",    adminRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 ImpactScore API running on port ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`   DB:  ${process.env.DATABASE_URL ? "connected" : "⚠ DATABASE_URL not set"}`);
});

module.exports = app;
