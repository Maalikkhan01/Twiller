import express from "express";
import { sendOtp, verifyOtp } from "../controller.js";
import { verifyFirebaseToken } from "../../lib/firebaseAdmin.js";
import { loginSecurityCheckpoint } from "../../login-security/loginSecurityMiddleware.js";

const router = express.Router();

router.post("/send-otp", verifyFirebaseToken, loginSecurityCheckpoint, sendOtp);
router.post("/verify-otp", verifyFirebaseToken, loginSecurityCheckpoint, verifyOtp);

export default router;
