import mongoose from "mongoose";

const KeywordNotificationSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tweet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tweet",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

KeywordNotificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model(
  "KeywordNotification",
  KeywordNotificationSchema,
);
