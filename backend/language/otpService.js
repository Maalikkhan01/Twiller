import crypto from "crypto";
import { getRedisClient, readJson, writeJson } from "../lib/redisClient.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_PER_WINDOW = 5;
const MIN_OTP_INTERVAL_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

const OTP_KEY_PREFIX = "otp:language:";
const RATE_KEY_PREFIX = "otp:language:rate:";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getRedisOrThrow = async () => {
  const client = await getRedisClient();
  if (!client) {
    throw createHttpError(503, "OTP service is not configured.");
  }
  return client;
};

const pruneHistory = (history, now) =>
  (history || []).filter((ts) => now - ts < RATE_WINDOW_MS);

const ensureWithinRateLimit = (history, now) => {
  const activeHistory = pruneHistory(history, now);
  const lastRequest = activeHistory[activeHistory.length - 1];

  if (lastRequest && now - lastRequest < MIN_OTP_INTERVAL_MS) {
    throw createHttpError(429, "Please wait before requesting another OTP.");
  }

  if (activeHistory.length >= MAX_OTP_PER_WINDOW) {
    throw createHttpError(429, "Too many OTP requests. Please try again later.");
  }

  return activeHistory;
};

export const registerSendAttempt = async (key) => {
  const now = Date.now();
  const rateKey = `${RATE_KEY_PREFIX}${key}`;

  try {
    const client = await getRedisOrThrow();
    const history = (await readJson(client, rateKey)) || [];
    const activeHistory = ensureWithinRateLimit(history, now);
    activeHistory.push(now);
    await writeJson(client, rateKey, activeHistory, RATE_WINDOW_MS);
    return now;
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createHttpError(503, "OTP service is unavailable.");
  }
};

export const generateOtp = () =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

export const storeOtp = async (
  key,
  otp,
  languageKey,
  channel,
  createdAt = Date.now(),
) => {
  const otpKey = `${OTP_KEY_PREFIX}${key}`;
  try {
    const client = await getRedisOrThrow();
    await writeJson(
      client,
      otpKey,
      {
        otp,
        languageKey,
        channel,
        attempts: 0,
        expiresAt: createdAt + OTP_TTL_MS,
      },
      OTP_TTL_MS,
    );
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createHttpError(503, "OTP service is unavailable.");
  }
};

export const clearOtp = async (key) => {
  const otpKey = `${OTP_KEY_PREFIX}${key}`;
  try {
    const client = await getRedisOrThrow();
    await client.del(otpKey);
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createHttpError(503, "OTP service is unavailable.");
  }
};

export const verifyOtp = async (key, languageKey, providedOtp) => {
  const otpKey = `${OTP_KEY_PREFIX}${key}`;
  const now = Date.now();

  try {
    const client = await getRedisOrThrow();
    const record = await readJson(client, otpKey);
    if (!record) {
      throw createHttpError(400, "OTP verification failed.");
    }

    if (record.expiresAt < now) {
      await client.del(otpKey);
      throw createHttpError(400, "OTP verification failed.");
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      await client.del(otpKey);
      throw createHttpError(429, "Too many invalid OTP attempts.");
    }

    if (record.languageKey !== languageKey) {
      record.attempts += 1;
      const remainingMs = record.expiresAt - now;
      if (remainingMs > 0) {
        await writeJson(client, otpKey, record, remainingMs);
      } else {
        await client.del(otpKey);
      }
      throw createHttpError(400, "OTP verification failed.");
    }

    if (record.otp !== String(providedOtp || "").trim()) {
      record.attempts += 1;
      const remainingMs = record.expiresAt - now;
      if (remainingMs > 0) {
        await writeJson(client, otpKey, record, remainingMs);
      } else {
        await client.del(otpKey);
      }
      throw createHttpError(400, "OTP verification failed.");
    }

    await client.del(otpKey);
    return { verifiedAt: now };
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createHttpError(503, "OTP service is unavailable.");
  }
};
