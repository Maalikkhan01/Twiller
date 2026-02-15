import express from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { requireCurrentUser } from "../middleware/currentUser.js";
import {
  addMemberToList,
  createList,
  listLists,
  removeMemberFromList,
} from "../controllers/listsController.js";

const router = express.Router();

router.post("/lists", verifyFirebaseToken, requireCurrentUser, createList);
router.get("/lists", verifyFirebaseToken, requireCurrentUser, listLists);
router.post(
  "/lists/:listId/members",
  verifyFirebaseToken,
  requireCurrentUser,
  addMemberToList,
);
router.delete(
  "/lists/:listId/members/:userId",
  verifyFirebaseToken,
  requireCurrentUser,
  removeMemberFromList,
);

export default router;
