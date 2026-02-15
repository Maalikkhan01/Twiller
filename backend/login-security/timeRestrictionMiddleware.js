const IST_TIME_ZONE = "Asia/Kolkata";
const WINDOW_START_MINUTES = 10 * 60;
const WINDOW_END_MINUTES = 13 * 60;

const getIstMinutes = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0,
  );

  return hour * 60 + minute;
};

export const isMobileLoginAllowed = (date = new Date()) => {
  const minutes = getIstMinutes(date);
  return minutes >= WINDOW_START_MINUTES && minutes < WINDOW_END_MINUTES;
};

export const timeRestrictionMiddleware = (deviceCategory) => {
  if (deviceCategory !== "mobile") return;
  if (!isMobileLoginAllowed()) {
    const error = new Error(
      "Mobile login is allowed only between 10 AM and 1 PM IST.",
    );
    error.statusCode = 403;
    throw error;
  }
};
