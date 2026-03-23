const mongoose = require("mongoose");

// Default/delinquency tracking for loans
const defaultSchema = new mongoose.Schema(
  {
    loan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
      index: true,
    },
    borrower_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Default tracking
    status: {
      type: String,
      enum: ["active", "cured", "written_off"],
      default: "active",
    },
    default_start_date: { type: Date, required: true }, // When first payment missed
    days_overdue: { type: Number, default: 0 }, // Calculated, refreshed daily

    // Delinquency stages
    delinquency_stage: {
      type: String,
      enum: ["0-30", "30-60", "60-90", "90+"],
      default: "0-30",
    },

    // Payment history
    payments_missed: { type: Number, default: 0 }, // Total missed installments
    amount_outstanding: { type: Number, required: true }, // Amount still owed
    last_payment_date: { type: Date, default: null },
    next_due_date: { type: Date, required: true },

    // Penalty accrual
    penalty_amount: { type: Number, default: 0 },
    penalty_rate_percent: { type: Number, default: 5 }, // 5% per month typically
    calculated_at: { type: Date, default: Date.now },

    // Recovery attempts
    recovery_actions: [
      {
        action_type: {
          type: String,
          enum: [
            "notification_sent",
            "reminder_call",
            "legal_notice",
            "collection_agency_assigned",
          ],
        },
        action_date: Date,
        action_by: mongoose.Schema.Types.ObjectId, // User who performed action
        notes: String,
        response: String, // Borrower's response if any
      },
    ],

    // Special circumstances
    forbearance_granted: { type: Boolean, default: false },
    forbearance_end_date: { type: Date, default: null },
    forbearance_reason: String,

    // Settlement/write-off
    settled_date: { type: Date, default: null },
    settled_amount: { type: Number, default: null },
    written_off_date: { type: Date, default: null },
    written_off_reason: String,

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

defaultSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    ret.loan_id = ret.loan_id?.toString();
    ret.borrower_id = ret.borrower_id?.toString();
    ret.lender_id = ret.lender_id?.toString();
    return ret;
  },
});

module.exports = mongoose.model("Default", defaultSchema);
