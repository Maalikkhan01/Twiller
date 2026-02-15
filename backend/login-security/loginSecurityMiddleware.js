import { parseUserAgent, getRequestIp } from "./userAgentParser.js";
import { timeRestrictionMiddleware } from "./timeRestrictionMiddleware.js";
import { isSessionVerified } from "./otpService.js";
import { queueLoginHistory } from "./loginHistoryService.js";

const OTP_REQUIRED_MESSAGE = "OTP verification required.";

export const loginSecurityCheckpoint = async (req, res, next) => {
  const userAgentHeader = req.headers["user-agent"] || "";
  const ipAddress = getRequestIp(req);
  const metadata = parseUserAgent(userAgentHeader);
  const securityUserId = req.user?.uid || req.user?.email || "anonymous";

  req.loginSecurity = {
    ...metadata,
    ipAddress,
  };

  try {
    timeRestrictionMiddleware(metadata.deviceCategory);
  } catch (error) {
    return res
      .status(error.statusCode || 403)
      .json({ message: error.message });
  }

  if (metadata.isChrome) {
    try {
      const verified = await isSessionVerified({
        userId: securityUserId,
        ipAddress,
        userAgent: metadata.userAgent,
      });

      if (!verified) {
        return res.status(403).json({
          message: OTP_REQUIRED_MESSAGE,
          requiresOtp: true,
        });
      }
    } catch (error) {
      return res
        .status(error.statusCode || 503)
        .json({ message: error.message || OTP_REQUIRED_MESSAGE });
    }
  }

  const shouldLogHistory =
    typeof req.originalUrl === "string" &&
    req.originalUrl.startsWith("/loggedinuser");

  if (shouldLogHistory) {
    queueLoginHistory({
      userEmail: req.user?.email,
      userId: null,
      userAgent: metadata.userAgent,
      ipAddress,
      metadata,
    });
  }

  return next();
};
