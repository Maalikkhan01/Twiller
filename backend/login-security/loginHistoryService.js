import LoginHistory from "../models/loginHistory.js";
import User from "../models/user.js";
import { buildSessionKey, parseUserAgent } from "./userAgentParser.js";

const RECENT_WINDOW_MS = 5 * 60 * 1000;
const recentLogins = new Map();

const sanitize = (value, fallback = "Unknown", maxLength = 120) => {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const shouldSkipRecent = (sessionKey) => {
  const lastSeen = recentLogins.get(sessionKey);
  const now = Date.now();
  if (lastSeen && now - lastSeen < RECENT_WINDOW_MS) {
    return true;
  }
  recentLogins.set(sessionKey, now);
  const timeout = setTimeout(() => recentLogins.delete(sessionKey), RECENT_WINDOW_MS);
  timeout.unref?.();
  return false;
};

export const queueLoginHistory = ({
  userEmail,
  userId,
  userAgent,
  ipAddress,
  metadata,
}) => {
  setImmediate(async () => {
    try {
      const resolvedMetadata = metadata || parseUserAgent(userAgent);
      const sessionUserId = userId ? String(userId) : userEmail;
      const sessionKey = buildSessionKey({
        userId: sessionUserId,
        ipAddress,
        userAgent: resolvedMetadata.userAgent || userAgent,
      });

      if (shouldSkipRecent(sessionKey)) return;

      let resolvedUserId = userId;
      if (!resolvedUserId && userEmail) {
        const user = await User.findOne({ email: userEmail }).select("_id");
        resolvedUserId = user?._id;
      }

      if (!resolvedUserId) return;

      await LoginHistory.create({
        userId: resolvedUserId,
        browserType: sanitize(resolvedMetadata.browserType),
        operatingSystem: sanitize(resolvedMetadata.operatingSystem),
        deviceCategory: sanitize(resolvedMetadata.deviceCategory, "desktop", 20),
        ipAddress: sanitize(ipAddress, "unknown", 64),
        loginTimestamp: new Date(),
      });
    } catch (error) {
      console.error(
        "ERROR Login history insert failed:",
        error?.message || error,
      );
    }
  });
};
