import express from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { loginSecurityCheckpoint } from "../../login-security/loginSecurityMiddleware.js";
import { paymentLimiter } from "../../middleware/rateLimiters.js";
import {
  createSubscriptionOrder,
  getPlans,
  getSubscriptionStatus,
} from "../controller.js";
import { handleSubscriptionWebhook } from "../webhookHandler.js";

const router = express.Router();

router.get("/plans", getPlans);
router.get("/me", verifyFirebaseToken, loginSecurityCheckpoint, getSubscriptionStatus);
router.post(
  "/create-order",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  paymentLimiter,
  createSubscriptionOrder,
);
router.post("/webhook", handleSubscriptionWebhook);

export default router;
