import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import FormData from "form-data";
import Tweet from "../models/tweet.js";
import User from "../models/user.js";
import {
  enforceAudioTimeWindow,
  validateAudioDuration,
  validateAudioFile,
} from "./audioValidator.js";
import { ensureAudioSession, sendOtp, verifyOtp } from "./otpService.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getCloudinaryConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CLOUDINARY_AUDIO_FOLDER || "twiller/audio";

  if (!cloudName || !apiKey || !apiSecret) {
    throw createHttpError(503, "Audio storage service is not configured.");
  }

  return { cloudName, apiKey, apiSecret, folder };
};

const buildSignature = (params, apiSecret) => {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto
    .createHash("sha1")
    .update(`${sorted}${apiSecret}`)
    .digest("hex");
};

const uploadToCloudinary = async (filePath) => {
  const { cloudName, apiKey, apiSecret, folder } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = buildSignature({ folder, timestamp }, apiSecret);
  const formData = new FormData();

  formData.append("file", fs.createReadStream(filePath));
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    formData,
    {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    },
  );

  return response.data;
};

const destroyCloudinaryAsset = async (publicId) => {
  if (!publicId) return;
  try {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = buildSignature({ public_id: publicId, timestamp }, apiSecret);
    const formData = new FormData();

    formData.append("public_id", publicId);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);

    await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`,
      formData,
      { headers: formData.getHeaders() },
    );
  } catch (error) {
    console.error("WARN Failed to cleanup cloudinary asset:", error?.message);
  }
};

const cleanupLocalFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // no-op
  }
};

export const sendAudioOtp = async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) {
      throw createHttpError(400, "Email required.");
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw createHttpError(404, "User not found.");
    }

    const result = await sendOtp(user.email);
    return res.status(200).json({
      message: "OTP sent successfully.",
      expiresInSeconds: result.expiresInSeconds,
    });
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

export const verifyAudioOtp = async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) {
      throw createHttpError(400, "Email required.");
    }

    const { otp } = req.body || {};
    if (!otp) {
      throw createHttpError(400, "OTP is required.");
    }

    const result = await verifyOtp(email, otp);
    return res.status(200).json({
      message: "OTP verified successfully.",
      verifiedUntil: result.verifiedUntil,
    });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const createAudioTweet = async (req, res, next) => {
  const localFilePath = req.file?.path;
  let uploadedAsset = null;

  try {
    const email = req.user?.email;
    if (!email) {
      throw createHttpError(400, "Email required.");
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw createHttpError(404, "User not found.");
    }

    enforceAudioTimeWindow();
    await ensureAudioSession(email);
    validateAudioFile(req.file);

    uploadedAsset = await uploadToCloudinary(localFilePath);
    const validatedDuration = validateAudioDuration(uploadedAsset?.duration);

    const content = String(req.body?.content || "").trim() || "Audio tweet";
    const tweet = await Tweet.create({
      author: user._id,
      content,
      audioUrl: uploadedAsset.secure_url,
      audioDuration: validatedDuration,
      tweetType: "audio",
    });

    await tweet.populate("author", "username displayName avatar");
    try {
      const io = req.app?.get("io");
      if (io) {
        io.emit("tweet:new", tweet);
      }
    } catch {
      // no-op
    }
    return res.status(201).json(tweet);
  } catch (error) {
    if (uploadedAsset?.public_id) {
      await destroyCloudinaryAsset(uploadedAsset.public_id);
    }
    error.statusCode = error.statusCode || 500;
    return next(error);
  } finally {
    await cleanupLocalFile(localFilePath);
  }
};
