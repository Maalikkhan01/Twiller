import express from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { requireCurrentUser } from "../middleware/currentUser.js";
import {
  createCommunity,
  joinCommunity,
  leaveCommunity,
  listCommunities,
} from "../controllers/communitiesController.js";

const router = express.Router();

router.post(
  "/communities",
  verifyFirebaseToken,
  requireCurrentUser,
  createCommunity,
);
router.get(
  "/communities",
  verifyFirebaseToken,
  requireCurrentUser,
  listCommunities,
);
router.post(
  "/communities/:communityId/join",
  verifyFirebaseToken,
  requireCurrentUser,
  joinCommunity,
);
router.post(
  "/communities/:communityId/leave",
  verifyFirebaseToken,
  requireCurrentUser,
  leaveCommunity,
);

export default router;
