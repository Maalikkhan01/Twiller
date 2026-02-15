import mongoose from "mongoose";
import User from "../../models/user.js";
import Tweet from "../../models/tweet.js";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const toggleObjectIdInArray = (arrayValues = [], targetId) => {
  const exists = arrayValues.some((value) => value.toString() === targetId);
  if (exists) {
    return {
      existsAfter: false,
      nextValues: arrayValues.filter((value) => value.toString() !== targetId),
    };
  }
  return {
    existsAfter: true,
    nextValues: [...arrayValues, targetId],
  };
};

export const setPrivateAccountFlag = async (req, res, next) => {
  try {
    const privateAccount = Boolean(req.body?.privateAccount);
    const updated = await User.findByIdAndUpdate(
      req.currentUser._id,
      { $set: { privateAccount } },
      { new: true },
    ).select("_id privateAccount");

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const toggleBlockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      throw createHttpError(400, "Invalid user id");
    }
    if (userId === req.currentUser._id.toString()) {
      throw createHttpError(400, "Cannot block yourself");
    }

    const target = await User.findById(userId).select("_id");
    if (!target) {
      throw createHttpError(404, "User not found");
    }

    const { existsAfter } = toggleObjectIdInArray(
      req.currentUser.blockedUsers || [],
      userId,
    );

    const update = existsAfter
      ? { $addToSet: { blockedUsers: userId }, $pull: { mutedUsers: userId } }
      : { $pull: { blockedUsers: userId } };

    const updated = await User.findByIdAndUpdate(req.currentUser._id, update, {
      new: true,
    }).select("_id blockedUsers mutedUsers");

    return res.status(200).json({
      blocked: existsAfter,
      blockedUsers: updated?.blockedUsers || [],
      mutedUsers: updated?.mutedUsers || [],
    });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const toggleMuteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      throw createHttpError(400, "Invalid user id");
    }
    if (userId === req.currentUser._id.toString()) {
      throw createHttpError(400, "Cannot mute yourself");
    }

    const target = await User.findById(userId).select("_id");
    if (!target) {
      throw createHttpError(404, "User not found");
    }

    const { existsAfter } = toggleObjectIdInArray(
      req.currentUser.mutedUsers || [],
      userId,
    );

    const update = existsAfter
      ? { $addToSet: { mutedUsers: userId } }
      : { $pull: { mutedUsers: userId } };

    const updated = await User.findByIdAndUpdate(req.currentUser._id, update, {
      new: true,
    }).select("_id mutedUsers");

    return res.status(200).json({
      muted: existsAfter,
      mutedUsers: updated?.mutedUsers || [],
    });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const setContentModeration = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }

    const moderationFlag = Boolean(req.body?.moderationFlag);
    const moderationReason = String(req.body?.moderationReason || "").trim();

    const updated = await Tweet.findOneAndUpdate(
      { _id: postId, author: req.currentUser._id },
      { $set: { moderationFlag, moderationReason } },
      { new: true },
    ).populate("author", "username displayName avatar verified");

    if (!updated) {
      throw createHttpError(404, "Post not found or not owned by user");
    }

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};
