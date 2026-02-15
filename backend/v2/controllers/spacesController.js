import mongoose from "mongoose";
import Space from "../../models/space.js";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const createSpace = async (req, res, next) => {
  try {
    const title = String(req.body?.title || "").trim();
    if (!title) {
      throw createHttpError(400, "Space title is required");
    }

    const scheduledTime = req.body?.scheduledTime
      ? new Date(req.body.scheduledTime)
      : null;
    if (scheduledTime && Number.isNaN(scheduledTime.getTime())) {
      throw createHttpError(400, "Invalid scheduledTime");
    }

    const space = await Space.create({
      title,
      description: String(req.body?.description || "").trim(),
      host: req.currentUser._id,
      participants: [req.currentUser._id],
      scheduledTime,
      recordingEnabled: Boolean(req.body?.recordingEnabled),
      status: scheduledTime ? "scheduled" : "live",
    });

    const populated = await Space.findById(space._id).populate(
      "host participants",
      "username displayName avatar verified",
    );

    return res.status(201).json(populated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const listSpaces = async (req, res, next) => {
  try {
    const status = String(req.query.status || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const filter = {};
    if (["scheduled", "live", "ended"].includes(status)) {
      filter.status = status;
    }

    const spaces = await Space.find(filter)
      .sort({ scheduledTime: 1, createdAt: -1 })
      .limit(limit)
      .populate("host participants", "username displayName avatar verified");

    return res.status(200).json(spaces);
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

export const getSpaceById = async (req, res, next) => {
  try {
    const { spaceId } = req.params;
    if (!isValidObjectId(spaceId)) {
      throw createHttpError(400, "Invalid space id");
    }

    const space = await Space.findById(spaceId).populate(
      "host participants",
      "username displayName avatar verified",
    );
    if (!space) {
      throw createHttpError(404, "Space not found");
    }

    return res.status(200).json(space);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const joinSpace = async (req, res, next) => {
  try {
    const { spaceId } = req.params;
    if (!isValidObjectId(spaceId)) {
      throw createHttpError(400, "Invalid space id");
    }

    const updated = await Space.findByIdAndUpdate(
      spaceId,
      { $addToSet: { participants: req.currentUser._id } },
      { new: true },
    ).populate("host participants", "username displayName avatar verified");

    if (!updated) {
      throw createHttpError(404, "Space not found");
    }

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const leaveSpace = async (req, res, next) => {
  try {
    const { spaceId } = req.params;
    if (!isValidObjectId(spaceId)) {
      throw createHttpError(400, "Invalid space id");
    }

    const updated = await Space.findByIdAndUpdate(
      spaceId,
      { $pull: { participants: req.currentUser._id } },
      { new: true },
    ).populate("host participants", "username displayName avatar verified");

    if (!updated) {
      throw createHttpError(404, "Space not found");
    }

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};
