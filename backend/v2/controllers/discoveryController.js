import mongoose from "mongoose";
import User from "../../models/user.js";
import Tweet from "../../models/tweet.js";
import { buildVisibilityContext } from "../services/securityService.js";

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const parseLimit = (value, fallback = 20) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 50);
};

const mapAggregationPost = (item) => ({
  ...item,
  author: item.authorInfo
    ? {
        _id: item.authorInfo._id,
        username: item.authorInfo.username,
        displayName: item.authorInfo.displayName,
        avatar: item.authorInfo.avatar,
        verified: item.authorInfo.verified,
        privateAccount: item.authorInfo.privateAccount,
      }
    : null,
  authorInfo: undefined,
});

export const algorithmTimeline = async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 30);
    const context = await buildVisibilityContext(req.currentUser);
    const viewerId = toObjectId(req.currentUser._id);
    const excludedAuthors = [
      ...(context.blockedUserIds || []),
      ...(context.mutedUserIds || []),
      ...(context.blockedByUserIds || []),
    ].map(toObjectId);

    const match = {
      moderationFlag: { $ne: true },
    };
    if (excludedAuthors.length) {
      match.author = { $nin: excludedAuthors };
    }

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $multiply: ["$likes", 3] },
              { $multiply: ["$retweets", 4] },
              { $multiply: ["$comments", 2] },
              { $multiply: ["$viewCount", 0.2] },
            ],
          },
        },
      },
      { $sort: { engagementScore: -1, timestamp: -1 } },
      { $limit: limit * 3 },
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "authorInfo",
        },
      },
      { $unwind: "$authorInfo" },
      {
        $match: {
          $expr: {
            $or: [
              { $ne: ["$authorInfo.privateAccount", true] },
              { $eq: ["$authorInfo._id", viewerId] },
              { $in: [viewerId, "$authorInfo.followers"] },
            ],
          },
        },
      },
      { $limit: limit },
      {
        $project: {
          content: 1,
          image: 1,
          gifUrl: 1,
          poll: 1,
          hashtags: 1,
          mentions: 1,
          linkPreviews: 1,
          likes: 1,
          retweets: 1,
          comments: 1,
          likedBy: 1,
          retweetedBy: 1,
          parentTweetId: 1,
          rootTweetId: 1,
          quoteTweetId: 1,
          retweetOf: 1,
          isRetweet: 1,
          timestamp: 1,
          viewCount: 1,
          shareCount: 1,
          authorInfo: {
            _id: 1,
            username: 1,
            displayName: 1,
            avatar: 1,
            verified: 1,
            privateAccount: 1,
          },
        },
      },
    ];

    const timeline = await Tweet.aggregate(pipeline);
    return res.status(200).json(timeline.map(mapAggregationPost));
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

export const followingTimeline = async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 30);
    const followingIds = (req.currentUser.following || []).map((id) =>
      toObjectId(id),
    );

    if (!followingIds.length) {
      return res.status(200).json([]);
    }

    const pipeline = [
      {
        $match: {
          author: { $in: followingIds },
          moderationFlag: { $ne: true },
        },
      },
      { $sort: { timestamp: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "authorInfo",
        },
      },
      { $unwind: "$authorInfo" },
      {
        $project: {
          content: 1,
          image: 1,
          gifUrl: 1,
          poll: 1,
          hashtags: 1,
          mentions: 1,
          linkPreviews: 1,
          likes: 1,
          retweets: 1,
          comments: 1,
          likedBy: 1,
          retweetedBy: 1,
          parentTweetId: 1,
          rootTweetId: 1,
          quoteTweetId: 1,
          retweetOf: 1,
          isRetweet: 1,
          timestamp: 1,
          viewCount: 1,
          shareCount: 1,
          authorInfo: {
            _id: 1,
            username: 1,
            displayName: 1,
            avatar: 1,
            verified: 1,
            privateAccount: 1,
          },
        },
      },
    ];

    const timeline = await Tweet.aggregate(pipeline);
    return res.status(200).json(timeline.map(mapAggregationPost));
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

export const trendingHashtags = async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 10);
    const windowHours = Math.min(Math.max(Number(req.query.windowHours) || 48, 1), 168);
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const results = await Tweet.aggregate([
      {
        $match: {
          moderationFlag: { $ne: true },
          hashtags: { $exists: true, $ne: [] },
          timestamp: { $gte: cutoff },
        },
      },
      { $unwind: "$hashtags" },
      {
        $group: {
          _id: "$hashtags",
          count: { $sum: 1 },
          latest: { $max: "$timestamp" },
        },
      },
      { $sort: { count: -1, latest: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          hashtag: "$_id",
          count: 1,
          latest: 1,
        },
      },
    ]);

    return res.status(200).json(results);
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

export const searchAll = async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.status(200).json({ users: [], posts: [] });
    }

    const safePattern = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safePattern, "i");
    const limit = parseLimit(req.query.limit, 20);

    const usersPromise = User.aggregate([
      {
        $match: {
          $or: [{ username: regex }, { displayName: regex }, { bio: regex }],
        },
      },
      { $sort: { followersCount: -1, joinedDate: -1 } },
      { $limit: Math.min(limit, 20) },
      {
        $project: {
          username: 1,
          displayName: 1,
          avatar: 1,
          verified: 1,
          bio: 1,
          followersCount: 1,
          followingCount: 1,
          privateAccount: 1,
        },
      },
    ]);

    const postsPromise = Tweet.aggregate([
      {
        $match: {
          moderationFlag: { $ne: true },
          $or: [
            { content: regex },
            { hashtags: regex },
            { mentions: regex },
          ],
        },
      },
      { $sort: { timestamp: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "authorInfo",
        },
      },
      { $unwind: "$authorInfo" },
      {
        $project: {
          content: 1,
          image: 1,
          gifUrl: 1,
          poll: 1,
          hashtags: 1,
          mentions: 1,
          linkPreviews: 1,
          likes: 1,
          retweets: 1,
          comments: 1,
          likedBy: 1,
          retweetedBy: 1,
          parentTweetId: 1,
          rootTweetId: 1,
          quoteTweetId: 1,
          retweetOf: 1,
          isRetweet: 1,
          timestamp: 1,
          viewCount: 1,
          shareCount: 1,
          authorInfo: {
            _id: 1,
            username: 1,
            displayName: 1,
            avatar: 1,
            verified: 1,
            privateAccount: 1,
          },
        },
      },
    ]);

    const [users, posts] = await Promise.all([usersPromise, postsPromise]);

    return res.status(200).json({
      users,
      posts: posts.map(mapAggregationPost),
    });
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};
