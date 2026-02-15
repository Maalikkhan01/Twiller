const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const ensureSafeUrl = (value, fieldName) => {
  if (!isNonEmptyString(value)) return;
  if (value.length > 2048) {
    throw createHttpError(400, `${fieldName} is too long`);
  }
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("invalid protocol");
    }
  } catch {
    throw createHttpError(400, `${fieldName} must be a valid URL`);
  }
};

export const validateCreatePostBody = (req, _res, next) => {
  try {
    const content = String(req.body?.content || "");
    if (content.length > 280) {
      throw createHttpError(400, "Tweet exceeds 280 characters");
    }

    if (req.body?.image) {
      ensureSafeUrl(String(req.body.image), "Image URL");
    }

    if (req.body?.gifUrl) {
      ensureSafeUrl(String(req.body.gifUrl), "GIF URL");
    }

    if (req.body?.poll) {
      const poll = req.body.poll;
      if (typeof poll !== "object") {
        throw createHttpError(400, "Poll must be an object");
      }

      const question = String(poll.question || "").trim();
      const options = Array.isArray(poll.options)
        ? poll.options.map((option) => String(option || "").trim()).filter(Boolean)
        : [];

      if (!question) {
        throw createHttpError(400, "Poll question is required");
      }
      if (question.length > 280) {
        throw createHttpError(400, "Poll question exceeds 280 characters");
      }
      if (options.length < 2) {
        throw createHttpError(400, "Poll must have at least 2 options");
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export const validateSendMessageBody = (req, _res, next) => {
  try {
    const content = String(req.body?.content || "");
    if (content.length > 4000) {
      throw createHttpError(400, "Message content exceeds maximum length");
    }

    if (req.body?.mediaUrl) {
      ensureSafeUrl(String(req.body.mediaUrl), "Media URL");
    }

    if (req.body?.voiceUrl) {
      ensureSafeUrl(String(req.body.voiceUrl), "Voice URL");
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
