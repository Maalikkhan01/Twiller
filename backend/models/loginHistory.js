import mongoose from "mongoose";

const LoginHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  browserType: { type: String, required: true },
  operatingSystem: { type: String, required: true },
  deviceCategory: {
    type: String,
    required: true,
    enum: ["desktop", "laptop", "mobile"],
  },
  ipAddress: { type: String, required: true },
  loginTimestamp: { type: Date, required: true, default: Date.now },
});

LoginHistorySchema.index({ userId: 1, loginTimestamp: -1 });

export default mongoose.model("LoginHistory", LoginHistorySchema);
