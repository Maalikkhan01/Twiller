import mongoose from "mongoose";

const LinkPreviewSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    siteName: { type: String, default: "" },
  },
  { _id: false },
);

const PollOptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    voteCount: { type: Number, default: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: true },
);

const PollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    options: { type: [PollOptionSchema], default: [] },
    totalVotes: { type: Number, default: 0 },
    allowMultiple: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
  },
  { _id: false },
);

const TweetSchema = mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, default: "" },
  likes: { type: Number, default: 0 },
  retweets: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  retweetedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  image: { type: String, default: null },
  gifUrl: { type: String, default: null },
  audioUrl: { type: String, default: null },
  audioDuration: { type: Number, default: null },
  hashtags: { type: [String], default: [] },
  mentions: { type: [String], default: [] },
  linkPreviews: { type: [LinkPreviewSchema], default: [] },
  poll: { type: PollSchema, default: null },
  parentTweetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tweet",
    default: null,
  },
  rootTweetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tweet",
    default: null,
  },
  quoteTweetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tweet",
    default: null,
  },
  retweetOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tweet",
    default: null,
  },
  isRetweet: { type: Boolean, default: false },
  depth: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  replyRestriction: {
    type: String,
    enum: ["everyone", "followers", "mentioned"],
    default: "everyone",
  },
  moderationFlag: { type: Boolean, default: false },
  moderationReason: { type: String, default: "" },
  tweetType: {
    type: String,
    enum: ["text", "image", "audio", "gif", "poll", "retweet", "quote", "reply"],
    default: function defaultTweetType() {
      if (this.audioUrl) return "audio";
      if (this.gifUrl) return "gif";
      if (this.poll) return "poll";
      if (this.isRetweet) return "retweet";
      if (this.quoteTweetId) return "quote";
      if (this.parentTweetId) return "reply";
      if (this.image) return "image";
      return "text";
    },
  },
  createdAt: { type: Date, default: Date.now },
  timestamp: { type: Date, default: Date.now },
});

TweetSchema.index({ timestamp: -1 });
TweetSchema.index({ author: 1, timestamp: -1 });
TweetSchema.index({ author: 1, createdAt: -1 });
TweetSchema.index({ content: "text" });
TweetSchema.index({ likes: -1, retweets: -1, timestamp: -1 });
TweetSchema.index({ hashtags: 1, timestamp: -1 });
TweetSchema.index({ mentions: 1, timestamp: -1 });
TweetSchema.index({ parentTweetId: 1, timestamp: 1 });
TweetSchema.index({ rootTweetId: 1, timestamp: 1 });
TweetSchema.index({ retweetOf: 1, timestamp: -1 });
TweetSchema.index({ quoteTweetId: 1, timestamp: -1 });
TweetSchema.index({ "poll.expiresAt": 1 });
TweetSchema.index({ viewCount: -1, timestamp: -1 });
TweetSchema.index(
  { author: 1, retweetOf: 1, isRetweet: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isRetweet: true,
      retweetOf: { $exists: true, $ne: null },
    },
  },
);

export default mongoose.model("Tweet", TweetSchema);
