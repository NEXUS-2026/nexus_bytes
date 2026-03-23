const mongoose = require("mongoose");

// KYC evidence: individual documents (ID, address, employment, etc.)
const kycEvidenceSchema = new mongoose.Schema(
  {
    document_type: {
      type: String,
      enum: [
        "govt_id",
        "address_proof",
        "employment_proof",
        "bank_statement",
        "other",
      ],
      required: true,
    },
    file_url: { type: String, required: true }, // S3/IPFS URL
    uploaded_at: { type: Date, default: Date.now },
    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verification_status: {
      type: String,
      enum: ["pending", "approved", "rejected", "requires_resubmission"],
      default: "pending",
    },
    verification_notes: { type: String, default: null },
    verified_at: { type: Date, default: null },
  },
  { _id: true },
);

// KYC verification record
const kycSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    kyc_status: {
      type: String,
      enum: [
        "not_started",
        "pending_review",
        "approved",
        "rejected",
        "resubmission_required",
      ],
      default: "not_started",
    },
    overall_verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    overall_verification_date: { type: Date, default: null },
    overall_verification_notes: { type: String, default: null },

    // Risk score based on KYC data (0-100, higher = riskier)
    risk_score: { type: Number, default: 0, min: 0, max: 100 },
    risk_factors: {
      type: [String], // e.g., ["document_mismatch", "pep_flagged", "suspicious_patterns"]
      default: [],
    },

    // Evidence documents
    evidence: [kycEvidenceSchema],

    // Audit trail
    verification_history: [
      {
        action: String, // "approved" | "rejected" | "resubmission_requested"
        verifier_id: mongoose.Schema.Types.ObjectId,
        timestamp: Date,
        notes: String,
      },
    ],

    // PEP/Sanctions check
    pep_check_status: {
      type: String,
      enum: ["not_checked", "clear", "flagged"],
      default: "not_checked",
    },
    pep_check_date: Date,

    max_approved_loan_amount: { type: Number, default: 0 }, // Lender sets borrow limit based on KYC
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

kycSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    ret.user_id = ret.user_id.toString();
    if (ret.overall_verified_by)
      ret.overall_verified_by = ret.overall_verified_by.toString();
    return ret;
  },
});

module.exports = mongoose.model("KYC", kycSchema);
