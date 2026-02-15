import mongoose from "mongoose";
import Tweet from "../../models/tweet.js";
import { runWithOptionalTransaction } from "../services/transactionService.js";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const POST_POPULATE = [
  {
    path: "author",
    select: "username displayName avatar verified",
  },
  {
    path: "retweetOf",
    populate: {
      path: "author",
      select: "username displayName avatar verified",
    },
  },
  {
    path: "quoteTweetId",
    populate: {
      path: "author",
      select: "username displayName avatar verified",
    },
  },
];

export const toggleLike = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }

    const userId = req.currentUser._id;

    let updated = await Tweet.findOneAndUpdate(
      { _id: postId, likedBy: { $ne: userId } },
      { $addToSet: { likedBy: userId }, $inc: { likes: 1 } },
      { new: true },
    ).populate(POST_POPULATE);

    if (updated) {
      return res.status(200).json({ liked: true, post: updated });
    }

    updated = await Tweet.findOneAndUpdate(
      { _id: postId, likedBy: userId },
      { $pull: { likedBy: userId }, $inc: { likes: -1 } },
      { new: true },
    ).populate(POST_POPULATE);

    if (!updated) {
      throw createHttpError(404, "Post not found");
    }

    return res.status(200).json({ liked: false, post: updated });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const toggleRetweet = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }

    const source = await Tweet.findById(postId).select("_id author");
    if (!source) {
      throw createHttpError(404, "Post not found");
    }

    const userId = req.currentUser._id;
    const existingRetweet = await Tweet.findOne({
      author: userId,
      retweetOf: source._id,
      isRetweet: true,
    });

    if (existingRetweet) {
      await runWithOptionalTransaction(async (session) => {
        await Tweet.deleteOne(
          { _id: existingRetweet._id },
          session ? { session } : {},
        );
        await Tweet.updateOne(
          { _id: source._id },
          { $inc: { retweets: -1 } },
          session ? { session } : {},
        );
      });
      return res.status(200).json({
        retweeted: false,
        retweetPostId: existingRetweet._id,
      });
    }

    const retweet = await runWithOptionalTransaction(async (session) => {
      const [created] = await Tweet.create(
        [
          {
            author: userId,
            content: "",
            isRetweet: true,
            retweetOf: source._id,
            rootTweetId: source.rootTweetId || source._id,
          },
        ],
        session ? { session } : {},
      );

      await Tweet.updateOne(
        { _id: source._id },
        { $inc: { retweets: 1 } },
        session ? { session } : {},
      );
      return created;
    });

    const populated = await Tweet.findById(retweet._id).populate(POST_POPULATE);
    return res.status(201).json({ retweeted: true, post: populated });
  } catch (error) {
    if (error?.code === 11000) {
      error.statusCode = 409;
      error.message = "Already retweeted";
    }
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const createQuoteTweet = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const content = String(req.body?.content || "").trim();
    const image = req.body?.image ? String(req.body.image).trim() : null;
    const gifUrl = req.body?.gifUrl ? String(req.body.gifUrl).trim() : null;

    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }

    if (!content && !image && !gifUrl) {
      throw createHttpError(400, "Quote tweet requires content, image, or gif");
    }
    if (content.length > 280) {
      throw createHttpError(400, "Quote tweet exceeds 280 characters");
    }

    const quoted = await Tweet.findById(postId).select("_id");
    if (!quoted) {
      throw createHttpError(404, "Post not found");
    }

    const createdQuote = await runWithOptionalTransaction(async (session) => {
      const [created] = await Tweet.create(
        [
          {
            author: req.currentUser._id,
            content,
            image,
            gifUrl,
            quoteTweetId: quoted._id,
          },
        ],
        session ? { session } : {},
      );

      await Tweet.updateOne(
        { _id: quoted._id },
        { $inc: { retweets: 1 } },
        session ? { session } : {},
      );

      return created;
    });

    const populated = await Tweet.findById(createdQuote._id).populate(POST_POPULATE);
    return res.status(201).json(populated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};
