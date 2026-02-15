export const MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_AUDIO_DURATION_SECONDS = 5 * 60;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getIstMinutesOfDay = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0,
  );

  return hour * 60 + minute;
};

export const enforceAudioTimeWindow = () => {
  const minutes = getIstMinutesOfDay();
  const start = 14 * 60;
  const end = 19 * 60;

  if (minutes < start || minutes > end) {
    throw createHttpError(
      403,
      "Audio tweets are allowed only between 2 PM and 7 PM IST.",
    );
  }
};

export const validateAudioFile = (file) => {
  if (!file) {
    throw createHttpError(400, "Audio file is required.");
  }

  if (!file.mimetype || !file.mimetype.startsWith("audio/")) {
    throw createHttpError(415, "Only audio files are allowed.");
  }

  if (file.size > MAX_AUDIO_SIZE_BYTES) {
    throw createHttpError(413, "Audio file size must be 100MB or less.");
  }
};

export const validateAudioDuration = (duration) => {
  const normalized = Number(duration);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw createHttpError(400, "Unable to validate audio duration.");
  }

  if (normalized > MAX_AUDIO_DURATION_SECONDS) {
    throw createHttpError(400, "Audio duration must be 5 minutes or less.");
  }

  return Math.ceil(normalized);
};

export const audioTimeWindowMiddleware = (_req, _res, next) => {
  try {
    enforceAudioTimeWindow();
    return next();
  } catch (error) {
    return next(error);
  }
};
