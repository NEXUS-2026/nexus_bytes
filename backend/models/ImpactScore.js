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
