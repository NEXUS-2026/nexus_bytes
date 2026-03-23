const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    amount: { type: Number, required: true },
    approved_amount: { type: Number, default: null },
    interest_rate: { type: Number, default: null },
    duration_days: { type: Number, default: null },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "repayment_requested",
        "repaid",
      ],
      default: "pending",
      index: true,
    },
    tier: {
      type: String,
      enum: ["none", "low", "medium", "high"],
      default: null,
    },
    policy_version: { type: String, default: null },
    score_at_apply: { type: Number, default: null },
    effective_max_amount: { type: Number, default: null },
    effective_interest_rate: { type: Number, default: null },
    repayment_rate_at_apply: { type: Number, default: null },
    kyc_status_at_apply: { type: String, default: null },
    recent_activity_at_apply: { type: Date, default: null },
    factor_adjustments: { type: [String], default: [] },
    eligibility_reason: { type: String, default: null },
    blockchain_loan_id: { type: Number, default: null },
    blockchain_tx: { type: String, default: null },
    purpose: { type: String, default: null },
    lender_note: { type: String, default: null },
    rejection_reason: { type: String, default: null },
    decision_history: [
      {
        action: {
          type: String,
          enum: ["approve", "reject", "repay_confirm"],
          required: true,
        },
        decided_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        decided_at: { type: Date, default: Date.now },
        baseline_amount: { type: Number, default: null },
        baseline_rate: { type: Number, default: null },
        approved_amount: { type: Number, default: null },
        approved_rate: { type: Number, default: null },
        reason: { type: String, default: null },
      },
    ],
    applied_at: { type: Date, default: Date.now },
    decided_at: { type: Date, default: null },
    repaid_at: { type: Date, default: null },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

loanSchema.pre("save", function save(next) {
  this.updated_at = new Date();
  next();
});

loanSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  function update(next) {
    this.set({ updated_at: new Date() });
    next();
  },
);

loanSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    ret.user_id = ret.user_id.toString();
    if (ret.lender_id) ret.lender_id = ret.lender_id.toString();
    return ret;
  },
});

module.exports = mongoose.model("Loan", loanSchema);
