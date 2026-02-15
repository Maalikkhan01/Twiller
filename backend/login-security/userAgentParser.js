import crypto from "crypto";

const MAX_UA_LENGTH = 512;
const MAX_IP_LENGTH = 64;

const sanitize = (value, fallback = "Unknown", maxLength = 120) => {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const detectBrowser = (ua) => {
  const isEdge = /edg(e|a|ios)?\//i.test(ua) || /edge\//i.test(ua);
  const isIE = /msie|trident/i.test(ua);
  const isOpera = /opr\//i.test(ua) || /opera/i.test(ua);
  const isChrome = !isEdge && !isOpera && /chrome|crios/i.test(ua);
  const isFirefox = /firefox|fxios/i.test(ua);
  const isSafari = !isChrome && /safari/i.test(ua) && /version\//i.test(ua);

  if (isEdge) return { name: "Microsoft Edge", isEdge: true, isChrome: false };
  if (isIE)
    return { name: "Internet Explorer", isEdge: true, isChrome: false };
  if (isChrome)
    return { name: "Google Chrome", isEdge: false, isChrome: true };
  if (isFirefox)
    return { name: "Mozilla Firefox", isEdge: false, isChrome: false };
  if (isSafari)
    return { name: "Apple Safari", isEdge: false, isChrome: false };
  if (isOpera) return { name: "Opera", isEdge: false, isChrome: false };
  return { name: "Unknown", isEdge: false, isChrome: false };
};

const detectOS = (ua) => {
  if (/windows nt 10\.0/i.test(ua)) return "Windows";
  if (/windows nt 6\.3/i.test(ua)) return "Windows 8.1";
  if (/windows nt 6\.2/i.test(ua)) return "Windows 8";
  if (/windows nt 6\.1/i.test(ua)) return "Windows 7";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/macintosh|mac os x/i.test(ua)) return "macOS";
  if (/cros/i.test(ua)) return "Chrome OS";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown";
};

const detectDeviceCategory = (ua) => {
  const isMobile =
    /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|bb10/i.test(ua);
  const isTablet = /ipad|tablet/i.test(ua);

  if (isMobile || isTablet) return "mobile";
  if (/macintosh|mac os x|cros/i.test(ua)) return "laptop";
  return "desktop";
};

export const parseUserAgent = (userAgent = "") => {
  const rawUa = String(userAgent || "").slice(0, MAX_UA_LENGTH);
  const browser = detectBrowser(rawUa);
  const operatingSystem = detectOS(rawUa);
  const deviceCategory = detectDeviceCategory(rawUa);

  return {
    browserType: sanitize(browser.name),
    operatingSystem: sanitize(operatingSystem),
    deviceCategory: sanitize(deviceCategory, "desktop"),
    isChrome: browser.isChrome,
    isMicrosoftBrowser: browser.isEdge,
    userAgent: rawUa,
  };
};

export const getRequestIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const realIpHeader = req.headers["x-real-ip"];
  const realIpValue = Array.isArray(realIpHeader) ? realIpHeader[0] : realIpHeader;

  const candidate =
    (typeof forwardedValue === "string" && forwardedValue.split(",")[0]) ||
    (typeof realIpValue === "string" && realIpValue) ||
    req.socket?.remoteAddress ||
    req.ip ||
    "";

  const cleaned = String(candidate || "").replace(/^::ffff:/, "").trim();
  return cleaned.slice(0, MAX_IP_LENGTH) || "unknown";
};

export const buildSessionKey = ({ userId, ipAddress, userAgent }) => {
  const raw = `${userId || "unknown"}|${ipAddress || ""}|${userAgent || ""}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
};
