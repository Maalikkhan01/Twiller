import express from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { requireCurrentUser } from "../middleware/currentUser.js";
import {
  followUser,
  getMe,
  getUserProfile,
  mentionSuggestions,
  unfollowUser,
  updateProfileEnhancements,
} from "../controllers/usersController.js";

const router = express.Router();

router.get("/users/me", verifyFirebaseToken, requireCurrentUser, getMe);
router.patch(
  "/users/me/profile",
  verifyFirebaseToken,
  requireCurrentUser,
  updateProfileEnhancements,
);
router.get(
  "/users/mentions/suggest",
  verifyFirebaseToken,
  requireCurrentUser,
  mentionSuggestions,
);
router.get("/users/:userId", verifyFirebaseToken, requireCurrentUser, getUserProfile);
router.post("/users/:userId/follow", verifyFirebaseToken, requireCurrentUser, followUser);
router.delete(
  "/users/:userId/follow",
  verifyFirebaseToken,
  requireCurrentUser,
  unfollowUser,
);

export default router;
