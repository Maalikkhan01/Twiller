import express from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { requireCurrentUser } from "../middleware/currentUser.js";
import { v2TweetCreateLimiter } from "../middleware/rateLimiters.js";
import { validateCreatePostBody } from "../middleware/validation.js";
import {
  createPost,
  getPostById,
  getThread,
  incrementViewCount,
  listPosts,
  pinPost,
  setReplyRestriction,
  sharePost,
  unpinPost,
  voteOnPoll,
} from "../controllers/postsController.js";

const router = express.Router();

router.get("/posts", verifyFirebaseToken, requireCurrentUser, listPosts);
router.post(
  "/posts",
  verifyFirebaseToken,
  requireCurrentUser,
  v2TweetCreateLimiter,
  validateCreatePostBody,
  createPost,
);
router.get("/posts/:postId", verifyFirebaseToken, requireCurrentUser, getPostById);
router.get("/posts/:postId/thread", verifyFirebaseToken, requireCurrentUser, getThread);
router.post(
  "/posts/:postId/poll/vote",
  verifyFirebaseToken,
  requireCurrentUser,
  voteOnPoll,
);
router.post("/posts/:postId/pin", verifyFirebaseToken, requireCurrentUser, pinPost);
router.delete("/posts/pin", verifyFirebaseToken, requireCurrentUser, unpinPost);
router.patch(
  "/posts/:postId/reply-restriction",
  verifyFirebaseToken,
  requireCurrentUser,
  setReplyRestriction,
);
router.post("/posts/:postId/view", incrementViewCount);
router.post("/posts/:postId/share", sharePost);

export default router;
