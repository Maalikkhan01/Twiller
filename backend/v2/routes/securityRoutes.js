import express from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { requireCurrentUser } from "../middleware/currentUser.js";
import {
  setContentModeration,
  setPrivateAccountFlag,
  toggleBlockUser,
  toggleMuteUser,
} from "../controllers/securityController.js";

const router = express.Router();

router.patch(
  "/security/private-account",
  verifyFirebaseToken,
  requireCurrentUser,
  setPrivateAccountFlag,
);
router.post(
  "/security/block/:userId",
  verifyFirebaseToken,
  requireCurrentUser,
  toggleBlockUser,
);
router.post(
  "/security/mute/:userId",
  verifyFirebaseToken,
  requireCurrentUser,
  toggleMuteUser,
);
router.patch(
  "/security/posts/:postId/moderation",
  verifyFirebaseToken,
  requireCurrentUser,
  setContentModeration,
);

export default router;
