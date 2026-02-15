import express from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { requireCurrentUser } from "../middleware/currentUser.js";
import {
  createSpace,
  getSpaceById,
  joinSpace,
  leaveSpace,
  listSpaces,
} from "../controllers/spacesController.js";

const router = express.Router();

router.post("/spaces", verifyFirebaseToken, requireCurrentUser, createSpace);
router.get("/spaces", verifyFirebaseToken, requireCurrentUser, listSpaces);
router.get("/spaces/:spaceId", verifyFirebaseToken, requireCurrentUser, getSpaceById);
router.post("/spaces/:spaceId/join", verifyFirebaseToken, requireCurrentUser, joinSpace);
router.post("/spaces/:spaceId/leave", verifyFirebaseToken, requireCurrentUser, leaveSpace);

export default router;
