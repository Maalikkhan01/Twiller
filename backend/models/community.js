import mongoose from "mongoose";

const CommunitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    hashtags: [{ type: String }],
    isPrivate: { type: Boolean, default: false },
  },
  { timestamps: true },
);

CommunitySchema.index({ owner: 1, createdAt: -1 });
CommunitySchema.index({ members: 1, createdAt: -1 });
CommunitySchema.index({ name: "text", description: "text", hashtags: "text" });

export default mongoose.model("Community", CommunitySchema);
