const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    category: {
      type: String,
      enum: ["health", "education", "sustainability"],
      required: true,
    },
    ipfs_hash: { type: String, default: null },
    document_url: { type: String, default: null },
    data_hash: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verified_at: { type: Date, default: null },
    blockchain_tx: { type: String, default: null },
    on_chain_id: { type: Number, default: null },
    rejection_note: { type: String, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

activitySchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    if (ret.user_id) ret.user_id = ret.user_id.toString();
    if (ret.verified_by) ret.verified_by = ret.verified_by.toString();
    return ret;
  },
});

module.exports = mongoose.model("Activity", activitySchema);
