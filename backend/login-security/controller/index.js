import LoginHistory from "../../models/loginHistory.js";
import User from "../../models/user.js";
import { getRequestIp } from "../userAgentParser.js";
import { requestOtp, verifyOtp as verifyOtpService } from "../otpService.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const sendOtp = async (req, res, next) => {
  try {
    const email = req.user?.email;
    const userId = req.user?.uid || req.user?.email;
    const userAgentHeader = req.headers["user-agent"] || "";
    const ipAddress = getRequestIp(req);

    await requestOtp({
      userId,
      email,
      ipAddress,
      userAgent: userAgentHeader,
    });

    return res.status(200).json({ message: "If eligible, a code has been sent." });
  } catch (error) {
    console.warn("WARN Login OTP request failed:", error?.message || error);
    return res.status(200).json({ message: "If eligible, a code has been sent." });
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const providedOtp = String(req.body?.otp || "").trim();
    if (!providedOtp || !/^\d{6}$/.test(providedOtp)) {
      throw createHttpError(400, "Invalid or expired OTP.");
    }

    const userId = req.user?.uid || req.user?.email;
    const userAgentHeader = req.headers["user-agent"] || "";
    const ipAddress = getRequestIp(req);

    await verifyOtpService({
      userId,
      ipAddress,
      userAgent: userAgentHeader,
      otp: providedOtp,
    });

    return res.status(200).json({ verified: true });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};

export const getLoginHistory = async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) {
      throw createHttpError(400, "Email required.");
    }

    const user = await User.findOne({ email }).select("_id");
    if (!user) {
      throw createHttpError(404, "User not found.");
    }

    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const records = await LoginHistory.find({ userId: user._id })
      .sort({ loginTimestamp: -1 })
      .skip(skip)
      .limit(limit + 1)
      .select("browserType operatingSystem deviceCategory ipAddress loginTimestamp");

    const hasMore = records.length > limit;
    const items = (hasMore ? records.slice(0, limit) : records).map((record) => ({
      browserType: record.browserType,
      operatingSystem: record.operatingSystem,
      deviceCategory: record.deviceCategory,
      ipAddress: record.ipAddress,
      loginTimestamp: record.loginTimestamp,
    }));

    return res.status(200).json({ items, hasMore });
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    return next(error);
  }
};
