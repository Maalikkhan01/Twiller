import mongoose from "mongoose";

const SpaceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    scheduledTime: { type: Date, default: null },
    recordingEnabled: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["scheduled", "live", "ended"],
      default: "scheduled",
    },
  },
  { timestamps: true },
);

SpaceSchema.index({ host: 1, createdAt: -1 });
SpaceSchema.index({ status: 1, scheduledTime: 1 });
SpaceSchema.index({ participants: 1, status: 1 });

export default mongoose.model("Space", SpaceSchema);
