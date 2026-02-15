import express from "express";
import cors from "cors";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import FormData from "form-data";
import { Server as SocketIOServer } from "socket.io";
import User from "./models/user.js";
import Tweet from "./models/tweet.js";
import KeywordNotification from "./models/keywordNotification.js";
import Bookmark from "./models/bookmark.js";
import audioRoutes from "./audio/routes.js";
import forgotPasswordRoutes from "./forgot-password/routes/index.js";
import subscriptionRoutes from "./subscriptions/routes/index.js";
import languageRoutes from "./language/routes/index.js";
import loginSecurityRoutes from "./login-security/routes/index.js";
import v2Routes from "./v2/routes/index.js";
import {
  checkTweetLimit,
  trackTweetCount,
} from "./subscriptions/tweetLimitMiddleware.js";
import { getFirebaseAuth, verifyFirebaseToken } from "./lib/firebaseAdmin.js";
import errorHandler from "./middleware/errorHandler.js";
import { loginSecurityCheckpoint } from "./login-security/loginSecurityMiddleware.js";
import {
  authLimiter,
  otpLimiter,
  uploadLimiter,
  writeLimiter,
} from "./middleware/rateLimiters.js";

process.on("unhandledRejection", (reason) => {
  console.error("ERROR Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("ERROR Uncaught Exception:", error);
});

const envResult = dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const envCount = envResult.parsed ? Object.keys(envResult.parsed).length : 0;
console.log(`OK Loaded ${envCount} env variables from .env`);
if (envResult.error) {
  console.warn("WARN .env not found or failed to load, relying on process env");
}

const resolveServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      console.error("ERROR FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON");
      return null;
    }
  }

  const candidatePaths = [process.env.FIREBASE_SERVICE_ACCOUNT_PATH].filter(
    Boolean,
  );

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        return JSON.parse(fs.readFileSync(candidate, "utf8"));
      } catch {
        console.error(
          `ERROR Invalid Firebase service account JSON: ${candidate}`,
        );
        return null;
      }
    }
  }

  return null;
};

const validateEnv = () => {
  let hasError = false;

  if (!process.env.MONGODB_URL) {
    console.error("ERROR MONGODB_URL missing in .env");
    hasError = true;
  }

  if (!process.env.IMGBB_API_KEY) {
    console.error("ERROR Missing ENV: IMGBB_API_KEY");
    hasError = true;
  }

  if (!resolveServiceAccount()) {
    console.error(
      "ERROR Missing ENV: FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH",
    );
    hasError = true;
  }

  if (hasError) {
    process.exit(1);
  }
};

validateEnv();

const app = express();

const allowedOrigins = new Set(
  [process.env.FRONTEND_URL].filter(Boolean),
);

if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://127.0.0.1:3000");
}

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  return allowedOrigins.has(origin);
};

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  },
});

app.set("io", io);

io.use(async (socket, next) => {
  const authHeader = socket.handshake.headers?.authorization || "";
  const token =
    socket.handshake.auth?.token ||
    (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null);

  if (!token) {
    return next(new Error("Unauthorized"));
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    socket.data.firebaseUser = decoded;

    if (decoded?.email) {
      const user = await User.findOne({ email: decoded.email }).select("_id");
      if (user?._id) {
        socket.data.userId = user._id.toString();
        socket.join(`user:${user._id.toString()}`);
      }
    }
  } catch {
    return next(new Error("Unauthorized"));
  }

  return next();
});

io.on("connection", () => {});

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  }),
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      if (req.originalUrl?.startsWith("/subscriptions/webhook")) {
        req.rawBody = buf;
      }
    },
  }),
);
app.use("/audio", uploadLimiter, audioRoutes);
app.use("/forgot-password", authLimiter, forgotPasswordRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/language", otpLimiter, languageRoutes);
app.use("/login-security", otpLimiter, loginSecurityRoutes);
app.use("/api/v2", v2Routes);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ALLOWED_IMAGE_EXTENSIONS.has(ext) ? ext : "";
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${safeExt}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (
      !ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) ||
      !ALLOWED_IMAGE_EXTENSIONS.has(ext)
    ) {
      const err = new Error("Only jpg, jpeg, png, and webp images are allowed.");
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  },
});

const KEYWORD_REGEX = /(cricket|science)/i;
const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const queueKeywordNotifications = (tweet, authorId) => {
  setImmediate(async () => {
    try {
      if (!tweet?.content || !KEYWORD_REGEX.test(tweet.content)) {
        return;
      }

      const recipients = await User.find({
        _id: { $ne: authorId },
        "notificationPreferences.keywordNotifications": true,
      }).select("_id");

      if (!recipients.length) {
        return;
      }

      const payload = recipients.map((recipient) => ({
        user: recipient._id,
        tweet: tweet._id,
      }));

      await KeywordNotification.insertMany(payload);

      if (payload.length) {
        for (const recipient of payload) {
          io.to(`user:${recipient.user.toString()}`).emit("notification:new", {
            tweetId: tweet._id,
            content: tweet.content,
            timestamp: tweet.timestamp,
          });
        }
      }
    } catch (error) {
      console.error(
        "ERROR Keyword notification failed:",
        error?.message || error,
      );
    }
  });
};

app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

const getOptionalUserId = async (req) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    if (!decoded?.email) return null;
    const user = await User.findOne({ email: decoded.email }).select("_id");
    return user?._id || null;
  } catch {
    return null;
  }
};

const port = process.env.PORT || 5000;
const url = process.env.MONGODB_URL;

mongoose
  .connect(url)
  .then(() => {
    console.log("OK MongoDB Connected");
    server.listen(port, () => {
      console.log(`OK Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("ERROR MongoDB Failed:", err.message);
    process.exit(1);
  });

// Register
app.post("/register", authLimiter, verifyFirebaseToken, async (req, res, next) => {
  try {
    const existinguser = await User.findOne({ email: req.body.email });
    if (existinguser) {
      return res.status(200).json(existinguser);
    }
    const newUser = new User(req.body);
    const saved = await newUser.save();
    return res.status(201).json(saved);
  } catch (error) {
    error.statusCode = 400;
    return next(error);
  }
});

// logged in user
app.get(
  "/loggedinuser",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) {
      const err = new Error("Email required");
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findOne({ email });
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    return res.status(200).json(user);
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
  },
);

// update Profile
app.patch(
  "/userupdate/:email",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  writeLimiter,
  async (req, res, next) => {
  try {
    if (req.user?.email !== req.params.email) {
      const err = new Error("Forbidden");
      err.statusCode = 403;
      throw err;
    }

    const { displayName, bio, location, website, avatar } = req.body;
    const updates = { displayName, bio, location, website, avatar };
    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    const updated = await User.findOneAndUpdate(
      { email: req.user.email },
      { $set: updates },
      { new: true, upsert: false },
    );

    if (!updated) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
  },
);

app.patch(
  "/notification-preferences",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  writeLimiter,
  async (req, res, next) => {
    try {
      const email = req.user?.email;
      if (!email) {
        const err = new Error("Email required");
        err.statusCode = 400;
        throw err;
      }

      const { keywordNotifications } = req.body || {};
      if (typeof keywordNotifications !== "boolean") {
        const err = new Error("keywordNotifications must be boolean");
        err.statusCode = 400;
        throw err;
      }

      const updated = await User.findOneAndUpdate(
        { email },
        {
          $set: {
            "notificationPreferences.keywordNotifications": keywordNotifications,
          },
        },
        { new: true, upsert: false },
      );

      if (!updated) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
      }

      return res.status(200).json(updated);
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      return next(error);
    }
  },
);

app.get(
  "/keyword-notifications",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  async (req, res, next) => {
    try {
      const email = req.user?.email;
      if (!email) {
        const err = new Error("Email required");
        err.statusCode = 400;
        throw err;
      }

      const user = await User.findOne({ email });
      if (!user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
      }

      if (!user.notificationPreferences?.keywordNotifications) {
        return res.status(200).json([]);
      }

      const notifications = await KeywordNotification.find({
        user: user._id,
      })
        .sort({ createdAt: 1 })
        .limit(20)
        .populate("tweet", "content timestamp");

      const payload = notifications
        .map((notification) => ({
          tweetId: notification.tweet?._id,
          content: notification.tweet?.content,
          timestamp: notification.tweet?.timestamp,
        }))
        .filter((item) => item.tweetId && item.content);

      if (notifications.length) {
        await KeywordNotification.deleteMany({
          _id: { $in: notifications.map((notification) => notification._id) },
        });
      }

      return res.status(200).json(payload);
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      return next(error);
    }
  },
);

// Tweet API
app.post(
  "/post",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  writeLimiter,
  checkTweetLimit,
  trackTweetCount,
  async (req, res, next) => {
  try {
    const { content, image } = req.body;
    if (!content || !content.trim()) {
      const err = new Error("Content required");
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    const tweet = await Tweet.create({
      author: user._id,
      content,
      image: image || null,
    });

    await tweet.populate("author", "username displayName avatar");
    queueKeywordNotifications(tweet, user._id);
    io.emit("tweet:new", tweet);
    return res.status(201).json(tweet);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
  },
);

// get all tweet with pagination
app.get("/post", async (req, res, next) => {
  try {
    const limitValue = Number(req.query.limit) || 20;
    const limit = Math.min(Math.max(limitValue, 1), 50);
    const filter = req.query.author ? { author: req.query.author } : {};
    const rawQuery =
      typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (rawQuery) {
      const safeQuery = escapeRegex(rawQuery.slice(0, 100));
      filter.content = { $regex: new RegExp(safeQuery, "i") };
    }
    const cursor = req.query.cursor;
    const hasCursor =
      typeof cursor === "string" && mongoose.Types.ObjectId.isValid(cursor);
    if (hasCursor) {
      filter._id = { $lt: cursor };
    }

    const sortMode = typeof req.query.sort === "string" ? req.query.sort : "";
    const sort =
      sortMode === "trending"
        ? { likes: -1, retweets: -1, timestamp: -1 }
        : { timestamp: -1 };

    let query = Tweet.find(filter)
      .sort(sort)
      .limit(limit)
      .populate("author", "username displayName avatar");

    if (!hasCursor) {
      const pageValue = Number(req.query.page);
      const skip =
        Number.isFinite(pageValue) && pageValue > 0
          ? (pageValue - 1) * limit
          : Math.max(Number(req.query.skip) || 0, 0);
      query = query.skip(skip);
    }

    const tweet = await query;
    const currentUserId = await getOptionalUserId(req);
    if (currentUserId && tweet.length) {
      const bookmarks = await Bookmark.find({
        user: currentUserId,
        tweet: { $in: tweet.map((item) => item._id) },
      }).select("tweet");
      const bookmarked = new Set(
        bookmarks.map((item) => item.tweet.toString()),
      );
      const payload = tweet.map((item) => ({
        ...item.toObject(),
        isBookmarked: bookmarked.has(item._id.toString()),
      }));
      return res.status(200).json(payload);
    }

    return res.status(200).json(tweet);
  } catch (error) {
    error.statusCode = 400;
    return next(error);
  }
});

// suggested users
app.get(
  "/users/suggested",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  async (req, res, next) => {
    try {
      const email = req.user?.email;
      if (!email) {
        const err = new Error("Email required");
        err.statusCode = 400;
        throw err;
      }

      const currentUser = await User.findOne({ email }).select("_id");
      if (!currentUser) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
      }

      const users = await User.find({ _id: { $ne: currentUser._id } })
        .sort({ joinedDate: -1 })
        .limit(5)
        .select("username displayName avatar");

      return res.status(200).json(users);
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      return next(error);
    }
  },
);

// LIKE TWEET
app.post(
  "/like/:tweetid",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  writeLimiter,
  async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    const updated = await Tweet.findOneAndUpdate(
      { _id: req.params.tweetid, likedBy: { $ne: user._id } },
      { $addToSet: { likedBy: user._id }, $inc: { likes: 1 } },
      { new: true },
    ).populate("author", "username displayName avatar");

    if (!updated) {
      const existing = await Tweet.findById(req.params.tweetid).populate(
        "author",
        "username displayName avatar",
      );
      if (!existing) {
        const err = new Error("Tweet not found");
        err.statusCode = 404;
        throw err;
      }
      return res.status(200).json(existing);
    }

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
  },
);

// retweet
app.post(
  "/retweet/:tweetid",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  writeLimiter,
  async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    const updated = await Tweet.findOneAndUpdate(
      { _id: req.params.tweetid, retweetedBy: { $ne: user._id } },
      { $addToSet: { retweetedBy: user._id }, $inc: { retweets: 1 } },
      { new: true },
    ).populate("author", "username displayName avatar");

    if (!updated) {
      const existing = await Tweet.findById(req.params.tweetid).populate(
        "author",
        "username displayName avatar",
      );
      if (!existing) {
        const err = new Error("Tweet not found");
        err.statusCode = 404;
        throw err;
      }
      return res.status(200).json(existing);
    }

    return res.status(200).json(updated);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
  },
);

// upload image
app.post(
  "/upload",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  uploadLimiter,
  upload.single("image"),
  async (req, res, next) => {
    const localFilePath = req.file?.path;
    try {
      if (!process.env.IMGBB_API_KEY) {
        const err = new Error("IMGBB_API_KEY is not configured");
        err.statusCode = 500;
        throw err;
      }

      if (!req.file) {
        const err = new Error("Image required");
        err.statusCode = 400;
        throw err;
      }

      const formData = new FormData();
      formData.append("image", fs.createReadStream(localFilePath));

      const response = await axios.post(
        "https://api.imgbb.com/1/upload",
        formData,
        {
          params: { key: process.env.IMGBB_API_KEY },
          headers: formData.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        },
      );

      return res.status(200).json({ url: response.data.data.display_url });
    } catch (error) {
      error.statusCode = error.statusCode || 500;
      return next(error);
    } finally {
      if (localFilePath) {
        try {
          await fs.promises.unlink(localFilePath);
        } catch {
          // no-op
        }
      }
    }
  },
);

// bookmarks
app.get(
  "/bookmarks",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  async (req, res, next) => {
    try {
      const email = req.user?.email;
      if (!email) {
        const err = new Error("Email required");
        err.statusCode = 400;
        throw err;
      }

      const user = await User.findOne({ email }).select("_id");
      if (!user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
      }

      const limitValue = Number(req.query.limit) || 20;
      const limit = Math.min(Math.max(limitValue, 1), 50);
      const cursor = req.query.cursor;
      const filter = { user: user._id };
      if (typeof cursor === "string" && mongoose.Types.ObjectId.isValid(cursor)) {
        filter._id = { $lt: cursor };
      }

      const bookmarks = await Bookmark.find(filter)
        .sort({ _id: -1 })
        .limit(limit)
        .populate({
          path: "tweet",
          populate: { path: "author", select: "username displayName avatar" },
        });

      const payload = bookmarks
        .filter((item) => item.tweet)
        .map((item) => ({
          ...item.tweet.toObject(),
          isBookmarked: true,
          bookmarkId: item._id,
        }));

      return res.status(200).json(payload);
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      return next(error);
    }
  },
);

app.post(
  "/bookmarks/:tweetId",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  writeLimiter,
  async (req, res, next) => {
    try {
      const email = req.user?.email;
      if (!email) {
        const err = new Error("Email required");
        err.statusCode = 400;
        throw err;
      }

      const user = await User.findOne({ email }).select("_id");
      if (!user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
      }

      const tweetId = req.params.tweetId;
      if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        const err = new Error("Invalid tweet id");
        err.statusCode = 400;
        throw err;
      }

      const tweetExists = await Tweet.exists({ _id: tweetId });
      if (!tweetExists) {
        const err = new Error("Tweet not found");
        err.statusCode = 404;
        throw err;
      }

      await Bookmark.updateOne(
        { user: user._id, tweet: tweetId },
        { $setOnInsert: { user: user._id, tweet: tweetId } },
        { upsert: true },
      );

      return res.status(200).json({ bookmarked: true });
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      return next(error);
    }
  },
);

app.delete(
  "/bookmarks/:tweetId",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  writeLimiter,
  async (req, res, next) => {
    try {
      const email = req.user?.email;
      if (!email) {
        const err = new Error("Email required");
        err.statusCode = 400;
        throw err;
      }

      const user = await User.findOne({ email }).select("_id");
      if (!user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
      }

      const tweetId = req.params.tweetId;
      if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        const err = new Error("Invalid tweet id");
        err.statusCode = 400;
        throw err;
      }

      await Bookmark.deleteOne({ user: user._id, tweet: tweetId });
      return res.status(200).json({ bookmarked: false });
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      return next(error);
    }
  },
);

app.use(errorHandler);
