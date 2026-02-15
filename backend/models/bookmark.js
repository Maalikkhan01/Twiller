import mongoose from "mongoose";

const BookmarkSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tweet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tweet",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

BookmarkSchema.index({ user: 1, tweet: 1 }, { unique: true });
BookmarkSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Bookmark", BookmarkSchema);
