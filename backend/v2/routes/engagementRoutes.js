import express from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { requireCurrentUser } from "../middleware/currentUser.js";
import { v2LikeToggleLimiter } from "../middleware/rateLimiters.js";
import {
  createQuoteTweet,
  toggleLike,
  toggleRetweet,
} from "../controllers/engagementController.js";

const router = express.Router();

router.post(
  "/posts/:postId/like",
  verifyFirebaseToken,
  requireCurrentUser,
  v2LikeToggleLimiter,
  toggleLike,
);
router.post(
  "/posts/:postId/retweet",
  verifyFirebaseToken,
  requireCurrentUser,
  toggleRetweet,
);
router.post(
  "/posts/:postId/quote",
  verifyFirebaseToken,
  requireCurrentUser,
  createQuoteTweet,
);

export default router;
