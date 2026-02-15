import User from "../models/user.js";
import { getAuthClient } from "./firebaseAdminClient.js";
import { getLanguageByKey } from "./languageConfig.js";
import {
  clearOtp,
  generateOtp,
  registerSendAttempt,
  storeOtp,
  verifyOtp as verifyOtpRecord,
} from "./otpService.js";
import { sendOtpByEmail, sendOtpBySms } from "./messagingProvider.js";

const GENERIC_SEND_MESSAGE = "If eligible, a code has been sent.";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const sendOtp = async (req, res, next) => {
  try {
    const language = getLanguageByKey(req.body?.language);
    if (!language) {
      throw createHttpError(400, "Invalid language selection.");
    }

    const uid = req.user?.uid;
    if (!uid) {
      throw createHttpError(401, "Unauthorized");
    }

    const auth = getAuthClient();
    let userRecord;
    try {
      userRecord = await auth.getUser(uid);
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        await registerSendAttempt(uid);
        return res.status(200).json({ message: GENERIC_SEND_MESSAGE });
      }
      throw error;
    }

    const recipient =
      language.otpChannel === "email"
        ? userRecord.email
        : userRecord.phoneNumber;

    if (!recipient) {
      await registerSendAttempt(uid);
      return res.status(200).json({ message: GENERIC_SEND_MESSAGE });
    }

    const sentAt = await registerSendAttempt(uid);
    const otp = generateOtp();

    try {
      if (language.otpChannel === "email") {
        await sendOtpByEmail(recipient, otp);
      } else {
        await sendOtpBySms(recipient, otp);
      }
      await storeOtp(uid, otp, language.key, language.otpChannel, sentAt);
    } catch (error) {
      await clearOtp(uid);
      throw error;
    }

    return res.status(200).json({ message: GENERIC_SEND_MESSAGE });
  } catch (error) {
    return next(error);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const language = getLanguageByKey(req.body?.language);
    if (!language) {
      throw createHttpError(400, "Invalid language selection.");
    }

    const uid = req.user?.uid;
    if (!uid) {
      throw createHttpError(401, "Unauthorized");
    }

    const otp = String(req.body?.otp || "").trim();
    if (!otp) {
      throw createHttpError(400, "OTP verification failed.");
    }

    await verifyOtpRecord(uid, language.key, otp);

    const updated = await User.findOneAndUpdate(
      { email: req.user?.email },
      { $set: { preferredLanguage: language.key } },
      { new: true, upsert: false },
    );

    if (!updated) {
      throw createHttpError(404, "User not found.");
    }

    return res.status(200).json({
      preferredLanguage: updated.preferredLanguage || language.key,
      message: "Language updated.",
    });
  } catch (error) {
    return next(error);
  }
};
