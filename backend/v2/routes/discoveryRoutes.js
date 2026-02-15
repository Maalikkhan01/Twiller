import express from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { requireCurrentUser } from "../middleware/currentUser.js";
import {
  algorithmTimeline,
  followingTimeline,
  searchAll,
  trendingHashtags,
} from "../controllers/discoveryController.js";

const router = express.Router();

router.get(
  "/discovery/timeline/algorithm",
  verifyFirebaseToken,
  requireCurrentUser,
  algorithmTimeline,
);
router.get(
  "/discovery/timeline/following",
  verifyFirebaseToken,
  requireCurrentUser,
  followingTimeline,
);
router.get("/discovery/trending/hashtags", trendingHashtags);
router.get("/discovery/search", verifyFirebaseToken, requireCurrentUser, searchAll);

export default router;
