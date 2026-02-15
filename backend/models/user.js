import mongoose from "mongoose";
const UserSchema = mongoose.Schema({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  profilePicture: { type: String, default: "" },
  coverPhoto: { type: String, default: "" },
  email: { type: String, required: true },
  bio: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  birthday: { type: Date, default: null },
  verified: { type: Boolean, default: false },
  professionalAccount: { type: Boolean, default: false },
  privateAccount: { type: Boolean, default: false },
  pinnedTweetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tweet",
    default: null,
  },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  contentModerationFlag: { type: Boolean, default: false },
  preferredLanguage: { type: String, default: "English" },
  joinedDate: { type: Date, default: Date.now },
  notificationPreferences: {
    keywordNotifications: { type: Boolean, default: false },
  },
  subscriptionPlan: { type: String, default: "FREE" },
  subscriptionStatus: { type: String, default: "active" },
  subscriptionExpiry: { type: Date, default: null },
  tweetCount: { type: Number, default: 0 },
});

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ displayName: "text", username: "text", bio: "text" });
UserSchema.index({ followersCount: -1 });
UserSchema.index({ followingCount: -1 });

export default mongoose.model("User", UserSchema);
