import mongoose from "mongoose";
import List from "../../models/list.js";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const createList = async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      throw createHttpError(400, "List name is required");
    }

    const list = await List.create({
      name,
      description: String(req.body?.description || "").trim(),
      owner: req.currentUser._id,
      members: [req.currentUser._id],
      isPrivate: Boolean(req.body?.isPrivate),
    });

    const populated = await List.findById(list._id).populate(
      "owner members",
      "username displayName avatar verified",
    );

    return res.status(201).json(populated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const listLists = async (req, res, next) => {
  try {
    const mineOnly = req.query.mine === "true";
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);

    const filter = mineOnly
      ? { owner: req.currentUser._id }
      : {
          $or: [
            { owner: req.currentUser._id },
            { members: req.currentUser._id },
            { isPrivate: false },
          ],
        };

    const lists = await List.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("owner members", "username displayName avatar verified");

    return res.status(200).json(lists);
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

export const addMemberToList = async (req, res, next) => {
  try {
    const { listId } = req.params;
    const { userId } = req.body || {};

    if (!isValidObjectId(listId) || !isValidObjectId(userId)) {
      throw createHttpError(400, "Invalid id");
    }

    const list = await List.findOneAndUpdate(
      { _id: listId, owner: req.currentUser._id },
      { $addToSet: { members: userId } },
      { new: true },
    ).populate("owner members", "username displayName avatar verified");

    if (!list) {
      throw createHttpError(404, "List not found or no permission");
    }

    return res.status(200).json(list);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const removeMemberFromList = async (req, res, next) => {
  try {
    const { listId, userId } = req.params;
    if (!isValidObjectId(listId) || !isValidObjectId(userId)) {
      throw createHttpError(400, "Invalid id");
    }

    const list = await List.findOneAndUpdate(
      { _id: listId, owner: req.currentUser._id },
      { $pull: { members: userId } },
      { new: true },
    ).populate("owner members", "username displayName avatar verified");

    if (!list) {
      throw createHttpError(404, "List not found or no permission");
    }

    return res.status(200).json(list);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};
