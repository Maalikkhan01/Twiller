import mongoose from "mongoose";
import User from "../../models/user.js";
import Tweet from "../../models/tweet.js";
import { runWithOptionalTransaction } from "../services/transactionService.js";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const getMe = async (req, res, next) => {
  try {
    const me = await User.findById(req.currentUser._id).select("-__v");
    return res.status(200).json(me);
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      throw createHttpError(400, "Invalid user id");
    }

    const user = await User.findById(userId).select(
      "username displayName avatar profilePicture coverPhoto bio website location birthday verified professionalAccount privateAccount followersCount followingCount pinnedTweetId joinedDate",
    );
    if (!user) {
      throw createHttpError(404, "User not found");
    }

    let pinnedTweet = null;
    if (user.pinnedTweetId) {
      pinnedTweet = await Tweet.findById(user.pinnedTweetId).populate({
        path: "author",
        select: "username displayName avatar verified",
      });
    }

    return res.status(200).json({
      ...user.toObject(),
      pinnedTweet,
    });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const updateProfileEnhancements = async (req, res, next) => {
  try {
    const allowedFields = [
      "profilePicture",
      "coverPhoto",
      "bio",
      "website",
      "location",
      "birthday",
      "professionalAccount",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (
      updates.birthday !== undefined &&
      updates.birthday !== null &&
      Number.isNaN(new Date(updates.birthday).getTime())
    ) {
      throw createHttpError(400, "Invalid birthday value");
    }

    const updated = await User.findByIdAndUpdate(
      req.currentUser._id,
      { $set: updates },
      { new: true },
    );

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const followUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.currentUser._id.toString();

    if (!isValidObjectId(userId)) {
      throw createHttpError(400, "Invalid user id");
    }
    if (userId === currentUserId) {
      throw createHttpError(400, "Cannot follow yourself");
    }

    const targetUser = await User.findById(userId).select("_id");
    if (!targetUser) {
      throw createHttpError(404, "User not found");
    }

    const result = await runWithOptionalTransaction(async (session) => {
      const options = session ? { session } : {};

      const currentUpdate = await User.updateOne(
        { _id: req.currentUser._id, following: { $ne: targetUser._id } },
        { $addToSet: { following: targetUser._id }, $inc: { followingCount: 1 } },
        options,
      );

      if (!currentUpdate.modifiedCount) {
        return { following: true, changed: false };
      }

      await User.updateOne(
        { _id: targetUser._id, followers: { $ne: req.currentUser._id } },
        { $addToSet: { followers: req.currentUser._id }, $inc: { followersCount: 1 } },
        options,
      );

      return { following: true, changed: true };
    });

    return res.status(200).json(result);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const unfollowUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.currentUser._id.toString();

    if (!isValidObjectId(userId)) {
      throw createHttpError(400, "Invalid user id");
    }
    if (userId === currentUserId) {
      throw createHttpError(400, "Cannot unfollow yourself");
    }

    const targetUser = await User.findById(userId).select("_id");
    if (!targetUser) {
      throw createHttpError(404, "User not found");
    }

    const result = await runWithOptionalTransaction(async (session) => {
      const options = session ? { session } : {};

      const currentUpdate = await User.updateOne(
        { _id: req.currentUser._id, following: targetUser._id },
        { $pull: { following: targetUser._id }, $inc: { followingCount: -1 } },
        options,
      );

      if (!currentUpdate.modifiedCount) {
        return { following: false, changed: false };
      }

      await User.updateOne(
        { _id: targetUser._id, followers: req.currentUser._id },
        { $pull: { followers: req.currentUser._id }, $inc: { followersCount: -1 } },
        options,
      );

      return { following: false, changed: true };
    });

    return res.status(200).json(result);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const mentionSuggestions = async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);

    if (!query) {
      return res.status(200).json([]);
    }

    const safePattern = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find({
      _id: { $ne: req.currentUser._id },
      $or: [
        { username: { $regex: new RegExp(`^${safePattern}`, "i") } },
        { displayName: { $regex: new RegExp(safePattern, "i") } },
      ],
    })
      .sort({ followersCount: -1, joinedDate: -1 })
      .limit(limit)
      .select("_id username displayName avatar verified");

    return res.status(200).json(users);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};
