import axios from "axios";
import { getRedisClient, readJson, writeJson } from "../lib/redisClient.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const AUDIO_SESSION_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_PER_WINDOW = 5;
const MIN_OTP_INTERVAL_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

const OTP_KEY_PREFIX = "otp:audio:";
const RATE_KEY_PREFIX = "otp:audio:rate:";
const VERIFIED_KEY_PREFIX = "otp:audio:verified:";

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

const pruneRateLimit = (history, now) =>
  (history || []).filter((ts) => now - ts < RATE_WINDOW_MS);

const enforceRateLimit = async (client, email) => {
  const now = Date.now();
  const rateKey = `${RATE_KEY_PREFIX}${email}`;
  const history = (await readJson(client, rateKey)) || [];
  const activeHistory = pruneRateLimit(history, now);
  const lastRequest = activeHistory[activeHistory.length - 1];

  if (lastRequest && now - lastRequest < MIN_OTP_INTERVAL_MS) {
    throw createHttpError(429, "Please wait before requesting another OTP.");
  }

  if (activeHistory.length >= MAX_OTP_PER_WINDOW) {
    throw createHttpError(429, "Too many OTP requests. Please try again later.");
  }

  activeHistory.push(now);
  await writeJson(client, rateKey, activeHistory, RATE_WINDOW_MS);
};

const sendOtpByEmail = async (email, otp) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.OTP_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    throw createHttpError(503, "OTP service is not configured.");
  }

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: fromEmail,
      to: email,
      subject: "Twiller Audio Tweet OTP",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    },
    {
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
    },
  );
};

export const sendOtp = async (email) => {
  try {
    const client = await getRedisOrThrow();
    await enforceRateLimit(client, email);

    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    await sendOtpByEmail(email, otp);

    const otpKey = `${OTP_KEY_PREFIX}${email}`;
    await writeJson(
      client,
      otpKey,
      {
        otp,
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
      },
      OTP_TTL_MS,
    );

    return { expiresInSeconds: OTP_TTL_MS / 1000 };
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createHttpError(503, "OTP service is unavailable.");
  }
};

export const verifyOtp = async (email, providedOtp) => {
  const otpKey = `${OTP_KEY_PREFIX}${email}`;
  const verifiedKey = `${VERIFIED_KEY_PREFIX}${email}`;
  const now = Date.now();

  try {
    const client = await getRedisOrThrow();
    const record = await readJson(client, otpKey);
    if (!record) {
      throw createHttpError(400, "OTP not found or expired.");
    }

    if (record.expiresAt < now) {
      await client.del(otpKey);
      throw createHttpError(400, "OTP expired.");
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      await client.del(otpKey);
      throw createHttpError(429, "Too many invalid OTP attempts.");
    }

    if (record.otp !== String(providedOtp || "").trim()) {
      record.attempts += 1;
      const remainingMs = record.expiresAt - now;
      if (remainingMs > 0) {
        await writeJson(client, otpKey, record, remainingMs);
      } else {
        await client.del(otpKey);
      }
      throw createHttpError(400, "Invalid OTP.");
    }

    await client.del(otpKey);
    const verifiedUntil = now + AUDIO_SESSION_TTL_MS;
    await client.set(verifiedKey, String(verifiedUntil), {
      PX: AUDIO_SESSION_TTL_MS,
    });

    return { verifiedUntil };
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createHttpError(503, "OTP service is unavailable.");
  }
};

export const ensureAudioSession = async (email) => {
  const verifiedKey = `${VERIFIED_KEY_PREFIX}${email}`;

  try {
    const client = await getRedisOrThrow();
    const value = await client.get(verifiedKey);
    if (!value) {
      throw createHttpError(403, "OTP verification required for audio tweets.");
    }

    const verifiedUntil = Number(value);
    if (!verifiedUntil || verifiedUntil < Date.now()) {
      await client.del(verifiedKey);
      throw createHttpError(
        403,
        "Audio upload session expired. Please verify OTP again.",
      );
    }

    return { verifiedUntil };
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createHttpError(503, "OTP service is unavailable.");
  }
};
