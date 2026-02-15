import mongoose from "mongoose";
import Community from "../../models/community.js";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeHashtags = (hashtags = []) => {
  const normalized = hashtags
    .map((item) => String(item || "").replace("#", "").trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

export const createCommunity = async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      throw createHttpError(400, "Community name is required");
    }

    const community = await Community.create({
      name,
      description: String(req.body?.description || "").trim(),
      owner: req.currentUser._id,
      moderators: [req.currentUser._id],
      members: [req.currentUser._id],
      hashtags: normalizeHashtags(req.body?.hashtags || []),
      isPrivate: Boolean(req.body?.isPrivate),
    });

    const populated = await Community.findById(community._id).populate(
      "owner moderators members",
      "username displayName avatar verified",
    );

    return res.status(201).json(populated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const listCommunities = async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);

    const filter = query
      ? {
          $text: {
            $search: query,
          },
        }
      : {};

    const communities = await Community.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("owner moderators members", "username displayName avatar verified");

    return res.status(200).json(communities);
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

export const joinCommunity = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    if (!isValidObjectId(communityId)) {
      throw createHttpError(400, "Invalid community id");
    }

    const updated = await Community.findByIdAndUpdate(
      communityId,
      { $addToSet: { members: req.currentUser._id } },
      { new: true },
    ).populate("owner moderators members", "username displayName avatar verified");

    if (!updated) {
      throw createHttpError(404, "Community not found");
    }

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const leaveCommunity = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    if (!isValidObjectId(communityId)) {
      throw createHttpError(400, "Invalid community id");
    }

    const updated = await Community.findByIdAndUpdate(
      communityId,
      {
        $pull: {
          members: req.currentUser._id,
          moderators: req.currentUser._id,
        },
      },
      { new: true },
    ).populate("owner moderators members", "username displayName avatar verified");

    if (!updated) {
      throw createHttpError(404, "Community not found");
    }

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};
