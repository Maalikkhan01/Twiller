import mongoose from "mongoose";
import Conversation from "../../models/conversation.js";
import Message from "../../models/message.js";
import User from "../../models/user.js";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const asObjectIdStrings = (values = []) =>
  values.map((item) => item.toString());

export const createConversation = async (req, res, next) => {
  try {
    const participantIds = Array.isArray(req.body?.participantIds)
      ? req.body.participantIds
      : [];
    const isGroup = Boolean(req.body?.isGroup);

    const normalizedIds = new Set(
      participantIds.filter((id) => isValidObjectId(id)).map(String),
    );
    normalizedIds.add(req.currentUser._id.toString());

    const participants = Array.from(normalizedIds);

    if (!isGroup && participants.length !== 2) {
      throw createHttpError(
        400,
        "Private conversations require exactly one recipient",
      );
    }

    const users = await User.find({
      _id: { $in: participants },
    }).select("_id following");

    if (users.length !== participants.length) {
      throw createHttpError(404, "One or more participants were not found");
    }

    if (!isGroup) {
      const [first, second] = participants;
      const existing = await Conversation.findOne({
        type: "private",
        participants: { $all: [first, second] },
        $expr: { $eq: [{ $size: "$participants" }, 2] },
      })
        .populate("participants", "username displayName avatar verified")
        .sort({ updatedAt: -1 });

      if (existing) {
        return res.status(200).json(existing);
      }
    }

    let isMessageRequest = Boolean(req.body?.isMessageRequest);
    if (!isGroup && !isMessageRequest) {
      const recipient = users.find(
        (item) => item._id.toString() !== req.currentUser._id.toString(),
      );
      const recipientFollowing = asObjectIdStrings(recipient?.following || []);
      if (!recipientFollowing.includes(req.currentUser._id.toString())) {
        isMessageRequest = true;
      }
    }

    const conversation = await Conversation.create({
      title: String(req.body?.title || "").trim(),
      type: isGroup ? "group" : "private",
      participants,
      admins: [req.currentUser._id],
      createdBy: req.currentUser._id,
      encrypted: Boolean(req.body?.encrypted),
      isMessageRequest,
      requestStatus: isMessageRequest ? "pending" : "accepted",
      avatar: String(req.body?.avatar || "").trim(),
    });

    const populated = await Conversation.findById(conversation._id).populate(
      "participants",
      "username displayName avatar verified",
    );

    return res.status(201).json(populated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const listConversations = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

    const conversations = await Conversation.find({
      participants: req.currentUser._id,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(limit)
      .populate("participants", "username displayName avatar verified")
      .populate("createdBy", "username displayName avatar verified");

    return res.status(200).json(conversations);
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      throw createHttpError(400, "Invalid conversation id");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw createHttpError(404, "Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (item) => item.toString() === req.currentUser._id.toString(),
    );
    if (!isParticipant) {
      throw createHttpError(403, "You are not a conversation participant");
    }

    const content = String(req.body?.content || "").trim();
    const mediaUrl = String(req.body?.mediaUrl || "").trim();
    const mediaType = String(req.body?.mediaType || "none").trim();
    const voiceUrl = String(req.body?.voiceUrl || "").trim();

    if (!content && !mediaUrl && !voiceUrl) {
      throw createHttpError(400, "Message must include text or media");
    }

    if (
      conversation.isMessageRequest &&
      conversation.requestStatus === "rejected"
    ) {
      throw createHttpError(403, "Message request has been rejected");
    }

    const message = await Message.create({
      conversation: conversation._id,
      conversationId: conversation._id,
      sender: req.currentUser._id,
      content,
      mediaUrl,
      mediaType: ["none", "image", "video", "file"].includes(mediaType)
        ? mediaType
        : "none",
      voiceUrl,
      encrypted: Boolean(req.body?.encrypted || conversation.encrypted),
      readBy: [req.currentUser._id],
    });

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageAt: message.createdAt,
          lastMessagePreview: content || (voiceUrl ? "Voice message" : "Media"),
        },
      },
    );

    const populated = await Message.findById(message._id)
      .populate("sender", "username displayName avatar verified")
      .populate("conversation", "_id type title encrypted");

    return res.status(201).json(populated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      throw createHttpError(400, "Invalid conversation id");
    }

    const conversation = await Conversation.findById(conversationId).select(
      "_id participants",
    );
    if (!conversation) {
      throw createHttpError(404, "Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (item) => item.toString() === req.currentUser._id.toString(),
    );
    if (!isParticipant) {
      throw createHttpError(403, "You are not a conversation participant");
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const cursor = req.query.cursor;
    const filter = { conversation: conversation._id };
    if (cursor && isValidObjectId(cursor)) {
      filter._id = { $lt: cursor };
    }

    const messages = await Message.find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .populate("sender", "username displayName avatar verified");

    return res.status(200).json(messages);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const respondToMessageRequest = async (req, res, next) => {
  try {
    const { conversationId, action } = req.params;
    if (!isValidObjectId(conversationId)) {
      throw createHttpError(400, "Invalid conversation id");
    }

    if (!["accept", "reject"].includes(action)) {
      throw createHttpError(400, "Action must be accept or reject");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw createHttpError(404, "Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (item) => item.toString() === req.currentUser._id.toString(),
    );
    if (!isParticipant) {
      throw createHttpError(403, "You are not a conversation participant");
    }

    if (!conversation.isMessageRequest) {
      throw createHttpError(400, "Conversation is not a message request");
    }

    const update = {
      requestStatus: action === "accept" ? "accepted" : "rejected",
      isMessageRequest: action !== "accept",
    };

    const updated = await Conversation.findByIdAndUpdate(
      conversation._id,
      { $set: update },
      { new: true },
    ).populate("participants", "username displayName avatar verified");

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};
