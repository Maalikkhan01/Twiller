import mongoose from "mongoose";

const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;
const RESET_WINDOW_SECONDS = Math.floor(RESET_WINDOW_MS / 1000);

const rateLimitSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, unique: true, index: true },
    lastRequestedAt: { type: Date, required: true, expires: RESET_WINDOW_SECONDS },
  },
  { timestamps: false },
);

const MODEL_NAME = "ForgotPasswordRateLimit";
const RateLimit =
  mongoose.models[MODEL_NAME] ||
  mongoose.model(MODEL_NAME, rateLimitSchema);

const createRateLimitError = () => {
  const error = new Error("You can use this option only one time per day.");
  error.statusCode = 429;
  return error;
};

export const assertWithinLimit = async (identifier) => {
  const record = await RateLimit.findOne({ identifier })
    .select("lastRequestedAt")
    .lean();

  if (!record?.lastRequestedAt) return;

  const lastRequested = new Date(record.lastRequestedAt).getTime();
  if (Date.now() - lastRequested < RESET_WINDOW_MS) {
    throw createRateLimitError();
  }
};

export const markRequested = async (identifier) => {
  const now = new Date();
  await RateLimit.findOneAndUpdate(
    { identifier },
    { $set: { lastRequestedAt: now } },
    { upsert: true, new: true },
  );
};
