import express from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { requireCurrentUser } from "../middleware/currentUser.js";
import { v2DmSendLimiter } from "../middleware/rateLimiters.js";
import { validateSendMessageBody } from "../middleware/validation.js";
import {
  createConversation,
  getMessages,
  listConversations,
  respondToMessageRequest,
  sendMessage,
} from "../controllers/messagingController.js";

const router = express.Router();

router.post(
  "/messages/conversations",
  verifyFirebaseToken,
  requireCurrentUser,
  createConversation,
);
router.get(
  "/messages/conversations",
  verifyFirebaseToken,
  requireCurrentUser,
  listConversations,
);
router.post(
  "/messages/conversations/:conversationId/messages",
  verifyFirebaseToken,
  requireCurrentUser,
  v2DmSendLimiter,
  validateSendMessageBody,
  sendMessage,
);
router.get(
  "/messages/conversations/:conversationId/messages",
  verifyFirebaseToken,
  requireCurrentUser,
  getMessages,
);
router.post(
  "/messages/conversations/:conversationId/requests/:action",
  verifyFirebaseToken,
  requireCurrentUser,
  respondToMessageRequest,
);

export default router;
