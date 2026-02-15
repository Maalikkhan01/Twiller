import mongoose from "mongoose";

const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const MODEL_NAME = "PasswordResetToken";
export default mongoose.models[MODEL_NAME] ||
  mongoose.model(MODEL_NAME, passwordResetTokenSchema);
