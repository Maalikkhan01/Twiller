import mongoose from "mongoose";
import Tweet from "../../models/tweet.js";
import User from "../../models/user.js";
import { extractHashtags, extractLinks, extractMentions } from "../utils/contentParser.js";
import { fetchLinkPreviews } from "../services/linkPreviewService.js";
import { runWithOptionalTransaction } from "../services/transactionService.js";
import {
  buildVisibilityContext,
  buildVisibilityMatch,
  canReplyToTweet,
} from "../services/securityService.js";

const POST_POPULATE = [
  {
    path: "author",
    select: "username displayName avatar verified privateAccount followers",
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
  {
    path: "parentTweetId",
    select: "_id author content timestamp",
  },
];

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  return error;
};

const parseLimit = (value, fallback = 20) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 50);
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizePoll = (pollInput) => {
  if (!pollInput) return null;
  if (typeof pollInput !== "object") {
    throw createHttpError(400, "Poll must be an object");
  }

  const question = String(pollInput.question || "").trim();
  const rawOptions = Array.isArray(pollInput.options) ? pollInput.options : [];
  const options = rawOptions
    .map((option) => String(option || "").trim())
    .filter(Boolean);

  if (!question) {
    throw createHttpError(400, "Poll question is required");
  }
  if (question.length > 280) {
    throw createHttpError(400, "Poll question exceeds 280 characters");
  }
  if (options.length < 2 || options.length > 4) {
    throw createHttpError(400, "Poll must have 2 to 4 options");
  }

  const dedup = new Set(options.map((item) => item.toLowerCase()));
  if (dedup.size !== options.length) {
    throw createHttpError(400, "Poll options must be unique");
  }

  let expiresAt = null;
  if (pollInput.expiresAt) {
    const parsedDate = new Date(pollInput.expiresAt);
    if (Number.isNaN(parsedDate.getTime())) {
      throw createHttpError(400, "Invalid poll expiration time");
    }
    if (parsedDate <= new Date()) {
      throw createHttpError(400, "Poll expiration must be in the future");
    }
    expiresAt = parsedDate;
  }

  return {
    question,
    options: options.map((text) => ({
      text,
      voteCount: 0,
      voters: [],
    })),
    totalVotes: 0,
    allowMultiple: Boolean(pollInput.allowMultiple),
    expiresAt,
  };
};

const sanitizePost = (postDoc) => {
  const raw = typeof postDoc.toObject === "function" ? postDoc.toObject() : postDoc;
  if (raw?.author?.followers) {
    delete raw.author.followers;
  }
  return raw;
};

const populatePost = (id) =>
  Tweet.findById(id).populate(POST_POPULATE).exec();

export const createPost = async (req, res, next) => {
  try {
    const content = String(req.body?.content || "");
    const trimmedContent = content.trim();
    const image = req.body?.image ? String(req.body.image).trim() : null;
    const gifUrl = req.body?.gifUrl ? String(req.body.gifUrl).trim() : null;
    const parentTweetId = req.body?.parentTweetId || null;
    const quoteTweetId = req.body?.quoteTweetId || null;
    const retweetOf = req.body?.retweetOf || null;
    const replyRestriction = req.body?.replyRestriction || "everyone";

    if (trimmedContent.length > 280) {
      throw createHttpError(400, "Tweet exceeds 280 characters");
    }

    if (quoteTweetId && retweetOf) {
      throw createHttpError(400, "Quote tweet and retweet cannot be combined");
    }

    const poll = normalizePoll(req.body?.poll);

    const hasRenderableContent = Boolean(
      trimmedContent ||
        image ||
        gifUrl ||
        poll ||
        quoteTweetId ||
        retweetOf,
    );
    if (!hasRenderableContent) {
      throw createHttpError(400, "Tweet content is required");
    }

    let parentTweet = null;
    if (parentTweetId) {
      if (!isValidObjectId(parentTweetId)) {
        throw createHttpError(400, "Invalid parentTweetId");
      }
      parentTweet = await Tweet.findById(parentTweetId);
      if (!parentTweet) {
        throw createHttpError(404, "Parent tweet not found");
      }

      const parentAuthor = await User.findById(parentTweet.author).select(
        "privateAccount followers",
      );

      if (
        parentAuthor &&
        !canReplyToTweet({
          parentTweet,
          parentAuthor,
          currentUser: req.currentUser,
        })
      ) {
        throw createHttpError(403, "Reply restriction does not allow this reply");
      }
    }

    if (quoteTweetId && !isValidObjectId(quoteTweetId)) {
      throw createHttpError(400, "Invalid quoteTweetId");
    }
    if (retweetOf && !isValidObjectId(retweetOf)) {
      throw createHttpError(400, "Invalid retweetOf id");
    }

    if (quoteTweetId) {
      const quoteExists = await Tweet.exists({ _id: quoteTweetId });
      if (!quoteExists) {
        throw createHttpError(404, "Quoted tweet not found");
      }
    }
    if (retweetOf) {
      const sourceExists = await Tweet.exists({ _id: retweetOf });
      if (!sourceExists) {
        throw createHttpError(404, "Retweet source not found");
      }
    }

    const hashtags = extractHashtags(trimmedContent);
    const mentions = extractMentions(trimmedContent);
    const links = extractLinks(trimmedContent);
    const linkPreviews = links.length ? await fetchLinkPreviews(links) : [];

    const postPayload = {
      author: req.currentUser._id,
      content: trimmedContent,
      image: image || null,
      gifUrl: gifUrl || null,
      poll,
      hashtags,
      mentions,
      linkPreviews,
      parentTweetId: parentTweet ? parentTweet._id : null,
      rootTweetId: parentTweet
        ? parentTweet.rootTweetId || parentTweet._id
        : null,
      depth: parentTweet ? (parentTweet.depth || 0) + 1 : 0,
      quoteTweetId: quoteTweetId || null,
      retweetOf: retweetOf || null,
      isRetweet: Boolean(retweetOf && !trimmedContent && !poll && !image && !gifUrl),
      replyRestriction: ["everyone", "followers", "mentioned"].includes(replyRestriction)
        ? replyRestriction
        : "everyone",
    };

    const createdPost = await runWithOptionalTransaction(async (session) => {
      const createOptions = session ? { session } : {};
      const [created] = await Tweet.create([postPayload], createOptions);

      if (parentTweet?._id) {
        await Tweet.updateOne(
          { _id: parentTweet._id },
          { $inc: { comments: 1 } },
          session ? { session } : {},
        );
      }

      if (retweetOf) {
        await Tweet.updateOne(
          { _id: retweetOf },
          { $inc: { retweets: 1 } },
          session ? { session } : {},
        );
      }

      if (quoteTweetId) {
        await Tweet.updateOne(
          { _id: quoteTweetId },
          { $inc: { retweets: 1 } },
          session ? { session } : {},
        );
      }

      return created;
    });

    const populated = await populatePost(createdPost._id);
    return res.status(201).json(sanitizePost(populated));
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const listPosts = async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 20);
    const cursor = req.query.cursor;
    const sort = req.query.sort === "trending"
      ? { likes: -1, retweets: -1, viewCount: -1, timestamp: -1 }
      : { timestamp: -1 };

    const filter = {};
    const match = buildVisibilityMatch(
      await buildVisibilityContext(req.currentUser),
    );

    if (match.author) {
      filter.author = match.author;
    }
    filter.moderationFlag = match.moderationFlag;

    if (req.query.author && isValidObjectId(req.query.author)) {
      filter.author = req.query.author;
    }

    const hashtag = String(req.query.hashtag || "").replace("#", "").toLowerCase();
    if (hashtag) {
      filter.hashtags = hashtag;
    }

    const mention = String(req.query.mention || "").replace("@", "").toLowerCase();
    if (mention) {
      filter.mentions = mention;
    }

    const search = String(req.query.q || "").trim();
    if (search) {
      filter.content = { $regex: new RegExp(escapeRegex(search.slice(0, 80)), "i") };
    }

    if (cursor && isValidObjectId(cursor)) {
      filter._id = { $lt: cursor };
    }

    if (req.query.includeReplies === "false") {
      filter.parentTweetId = null;
    }

    const posts = await Tweet.find(filter)
      .sort(sort)
      .limit(limit)
      .populate(POST_POPULATE);

    const currentUserId = req.currentUser?._id?.toString();
    const visiblePosts = posts.filter((post) => {
      const author = post.author;
      if (!author || !author.privateAccount) return true;
      if (author._id.toString() === currentUserId) return true;
      return (author.followers || []).some(
        (followerId) => followerId.toString() === currentUserId,
      );
    });

    return res.status(200).json(visiblePosts.map(sanitizePost));
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const getPostById = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }

    const post = await Tweet.findById(postId).populate(POST_POPULATE);
    if (!post) {
      throw createHttpError(404, "Post not found");
    }

    return res.status(200).json(sanitizePost(post));
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const getThread = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }

    const target = await Tweet.findById(postId);
    if (!target) {
      throw createHttpError(404, "Post not found");
    }

    const rootId = target.rootTweetId || target._id;
    const threadPosts = await Tweet.find({
      $or: [{ _id: rootId }, { rootTweetId: rootId }],
    })
      .sort({ timestamp: 1 })
      .populate(POST_POPULATE);

    const nodeById = new Map();
    for (const post of threadPosts) {
      nodeById.set(post._id.toString(), {
        ...sanitizePost(post),
        replies: [],
      });
    }

    let root = null;
    for (const node of nodeById.values()) {
      const parentId = node.parentTweetId?._id?.toString?.() || node.parentTweetId?.toString?.();
      if (parentId && nodeById.has(parentId)) {
        nodeById.get(parentId).replies.push(node);
      } else if (!root || node._id.toString() === rootId.toString()) {
        root = node;
      }
    }

    return res.status(200).json({
      rootTweetId: rootId,
      root,
      posts: Array.from(nodeById.values()),
    });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const voteOnPoll = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const optionId = req.body?.optionId;

    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }
    if (!isValidObjectId(optionId)) {
      throw createHttpError(400, "Invalid option id");
    }

    const updatedTweet = await runWithOptionalTransaction(async (session) => {
      const query = Tweet.findById(postId);
      if (session) {
        query.session(session);
      }
      const post = await query.exec();
      if (!post?.poll) {
        throw createHttpError(404, "Poll not found on this post");
      }
      if (post.poll.expiresAt && new Date(post.poll.expiresAt) < new Date()) {
        throw createHttpError(400, "Poll has expired");
      }

      const option = post.poll.options.id(optionId);
      if (!option) {
        throw createHttpError(404, "Poll option not found");
      }

      const currentUserId = req.currentUser._id.toString();
      const hasVotedOption = option.voters.some(
        (voterId) => voterId.toString() === currentUserId,
      );
      if (hasVotedOption) {
        throw createHttpError(409, "Already voted on this option");
      }

      if (post.poll.allowMultiple === false) {
        const hasVotedAny = post.poll.options.some((candidateOption) =>
          candidateOption.voters.some(
            (voterId) => voterId.toString() === currentUserId,
          ),
        );
        if (hasVotedAny) {
          throw createHttpError(409, "Poll already voted");
        }
      }

      option.voters.push(req.currentUser._id);
      option.voteCount += 1;
      post.poll.totalVotes += 1;
      await post.save(session ? { session } : {});
      return post;
    });

    const populated = await populatePost(updatedTweet._id);
    return res.status(200).json(sanitizePost(populated));
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const pinPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }

    const ownsTweet = await Tweet.exists({
      _id: postId,
      author: req.currentUser._id,
    });
    if (!ownsTweet) {
      throw createHttpError(403, "You can only pin your own posts");
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.currentUser._id,
      { $set: { pinnedTweetId: postId } },
      { new: true },
    ).select("_id pinnedTweetId");

    return res.status(200).json({
      pinnedTweetId: updatedUser?.pinnedTweetId || null,
    });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const unpinPost = async (req, res, next) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.currentUser._id,
      { $set: { pinnedTweetId: null } },
      { new: true },
    ).select("_id pinnedTweetId");

    return res.status(200).json({
      pinnedTweetId: updatedUser?.pinnedTweetId || null,
    });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const incrementViewCount = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }

    const post = await Tweet.findByIdAndUpdate(
      postId,
      { $inc: { viewCount: 1 } },
      { new: true },
    ).select("_id viewCount");

    if (!post) {
      throw createHttpError(404, "Post not found");
    }

    return res.status(200).json({ postId: post._id, viewCount: post.viewCount });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const sharePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }

    const post = await Tweet.findByIdAndUpdate(
      postId,
      { $inc: { shareCount: 1 } },
      { new: true },
    ).select("_id shareCount");

    if (!post) {
      throw createHttpError(404, "Post not found");
    }

    const frontendBase = process.env.FRONTEND_URL || "https://twiller.app";
    return res.status(200).json({
      postId: post._id,
      shareCount: post.shareCount,
      shareUrl: `${frontendBase}/#tweet-${post._id}`,
    });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const setReplyRestriction = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { replyRestriction } = req.body || {};

    if (!isValidObjectId(postId)) {
      throw createHttpError(400, "Invalid post id");
    }

    const allowed = ["everyone", "followers", "mentioned"];
    if (!allowed.includes(replyRestriction)) {
      throw createHttpError(400, "Invalid reply restriction value");
    }

    const post = await Tweet.findOneAndUpdate(
      { _id: postId, author: req.currentUser._id },
      { $set: { replyRestriction } },
      { new: true },
    ).populate(POST_POPULATE);

    if (!post) {
      throw createHttpError(404, "Post not found or not owned by user");
    }

    return res.status(200).json(sanitizePost(post));
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};
