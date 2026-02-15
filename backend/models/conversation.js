import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    type: {
      type: String,
      enum: ["private", "group"],
      default: "private",
    },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    encrypted: { type: Boolean, default: false },
    isMessageRequest: { type: Boolean, default: false },
    requestStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: "" },
    avatar: { type: String, default: "" },
  },
  { timestamps: true },
);

ConversationSchema.index({ participants: 1, lastMessageAt: -1 });
ConversationSchema.index({ createdBy: 1, createdAt: -1 });
ConversationSchema.index({ isMessageRequest: 1, requestStatus: 1 });

export default mongoose.model("Conversation", ConversationSchema);
