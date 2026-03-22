const mongoose = require("mongoose");

const impactScoreSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    score: { type: Number, default: 0 },
    last_synced_at: { type: Date, default: Date.now },
    score_model_version: { type: String, default: "v1_basic" },
    components: {
      base_points: { type: Number, default: 0 },
      recency_points: { type: Number, default: 0 },
      consistency_bonus: { type: Number, default: 0 },
      recent_verified_count: { type: Number, default: 0 },
      total_before_cap: { type: Number, default: 0 },
      capped_score: { type: Number, default: 0 },
    },
    sync_status: {
      type: String,
      enum: ["ok", "pending_retry", "skipped_no_wallet"],
      default: "ok",
    },
    last_sync_error: { type: String, default: null },
  },
  { timestamps: false },
);

impactScoreSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    ret.user_id = ret.user_id.toString();
    return ret;
  },
});

module.exports = mongoose.model("ImpactScore", impactScoreSchema);
