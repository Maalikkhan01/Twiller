import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { verifyFirebaseToken } from "../lib/firebaseAdmin.js";
import { loginSecurityCheckpoint } from "../login-security/loginSecurityMiddleware.js";
import { createAudioTweet, sendAudioOtp, verifyAudioOtp } from "./controller.js";
import {
  audioTimeWindowMiddleware,
  MAX_AUDIO_SIZE_BYTES,
} from "./audioValidator.js";

const router = express.Router();

const tempDirectory = path.join(process.cwd(), "audio", "tmp");
if (!fs.existsSync(tempDirectory)) {
  fs.mkdirSync(tempDirectory, { recursive: true });
}

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, tempDirectory);
    },
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname || "") || ".audio";
      callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: MAX_AUDIO_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype && file.mimetype.startsWith("audio/")) {
      callback(null, true);
      return;
    }
    callback(new Error("Only audio files are allowed."));
  },
});

const handleAudioUpload = (req, res, next) => {
  audioUpload.single("audio")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      error.statusCode = 413;
      error.message = "Audio file size must be 100MB or less.";
    } else {
      error.statusCode = 400;
    }

    return next(error);
  });
};

router.post("/send-otp", verifyFirebaseToken, sendAudioOtp);
router.post("/verify-otp", verifyFirebaseToken, verifyAudioOtp);
router.post(
  "/tweet",
  verifyFirebaseToken,
  loginSecurityCheckpoint,
  audioTimeWindowMiddleware,
  handleAudioUpload,
  createAudioTweet,
);

export default router;
