import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import multer from "multer";
import fs from "fs";
import path from "path";
import User from "./models/user.js";
import Tweet from "./models/tweet.js";
import { verifyFirebaseToken } from "./lib/firebaseAdmin.js";
import errorHandler from "./middleware/errorHandler.js";

const envResult = dotenv.config();
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

  const candidatePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.join(process.cwd(), "config", "firebase-service-account.json"),
    path.join(process.cwd(), "config", "firebase-service-account.json.json"),
  ].filter(Boolean);

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

/* ✅ SINGLE CORS — FIXED */
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

const port = process.env.PORT || 5000;
const url = process.env.MONGODB_URL;

mongoose
  .connect(url)
  .then(() => {
    console.log("✅ OK MongoDB Connected");
    app.listen(port, () => {
      console.log(`🚀 OK Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("ERROR MongoDB Failed:", err.message);
    process.exit(1);
  });

// Register
app.post("/register", async (req, res, next) => {
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
app.get("/loggedinuser", verifyFirebaseToken, async (req, res, next) => {
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
});

// update Profile
app.patch("/userupdate/:email", verifyFirebaseToken, async (req, res, next) => {
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
});

// Tweet API
app.post("/post", verifyFirebaseToken, async (req, res, next) => {
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
    return res.status(201).json(tweet);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
});

// get all tweet with pagination
app.get("/post", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const filter = req.query.author ? { author: req.query.author } : {};

    const tweet = await Tweet.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "username displayName avatar");

    return res.status(200).json(tweet);
  } catch (error) {
    error.statusCode = 400;
    return next(error);
  }
});

// LIKE TWEET
app.post("/like/:tweetid", verifyFirebaseToken, async (req, res, next) => {
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
});

// retweet
app.post("/retweet/:tweetid", verifyFirebaseToken, async (req, res, next) => {
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
});

// upload image
app.post(
  "/upload",
  verifyFirebaseToken,
  upload.single("image"),
  async (req, res, next) => {
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

      const imageBase64 = req.file.buffer.toString("base64");
      const payload = new URLSearchParams({ image: imageBase64 });

      const response = await axios.post(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        payload.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );

      return res.status(200).json({ url: response.data.data.display_url });
    } catch (error) {
      error.statusCode = error.statusCode || 500;
      return next(error);
    }
  },
);

app.use(errorHandler);
