import { Router } from "express";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import {
  sendOtp,
  verifyOtp,
  getLoginHistory,
} from "../controller/index.js";

const router = Router();

router.post("/send-otp", verifyFirebaseToken, sendOtp);
router.post("/verify-otp", verifyFirebaseToken, verifyOtp);
router.get("/history", verifyFirebaseToken, getLoginHistory);

export default router;
