import axios from "axios";
import { buildSessionKey } from "./userAgentParser.js";
import { getRedisClient, readJson, writeJson } from "../lib/redisClient.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000;
const MIN_SEND_INTERVAL_MS = 60 * 1000;
const VERIFY_BLOCK_MS = 10 * 60 * 1000;

const OTP_KEY_PREFIX = "otp:login:";
const META_KEY_PREFIX = "otp:login:meta:";
const VERIFIED_KEY_PREFIX = "otp:login:verified:";

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

const getResendConfig = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.OTP_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw createHttpError(503, "OTP email service is not configured.");
  }

  return { apiKey, fromEmail };
};

const sendOtpByEmail = async (email, otp) => {
  const { apiKey, fromEmail } = getResendConfig();
  await axios.post(
    "https://api.resend.com/emails",
    {
      from: fromEmail,
      to: email,
      subject: "Twiller Login Verification",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );
};

const pruneSendHistory = (history, now) =>
  (history || []).filter((timestamp) => now - timestamp < SEND_WINDOW_MS);

const enforceSendLimit = (record, now) => {
  if (record.blockedUntil && record.blockedUntil > now) {
    throw createHttpError(429, "Too many OTP attempts. Try again later.");
  }

  const history = pruneSendHistory(record.sendHistory, now);
  const lastRequest = history[history.length - 1];

  if (lastRequest && now - lastRequest < MIN_SEND_INTERVAL_MS) {
    throw createHttpError(429, "Please wait before requesting another OTP.");
  }

  if (history.length >= MAX_SENDS_PER_WINDOW) {
    throw createHttpError(429, "Too many OTP requests. Please try again later.");
  }

  history.push(now);
  record.sendHistory = history;
};

export const queueOtpSend = ({ userId, email, ipAddress, userAgent }) => {
  setImmediate(async () => {
    try {
      await requestOtp({ userId, email, ipAddress, userAgent });
    } catch (error) {
      console.warn("WARN Login OTP send failed:", error?.message || error);
    }
  });
};

export const requestOtp = async ({ userId, email, ipAddress, userAgent }) => {
  if (!email) {
    throw createHttpError(400, "Email is required for OTP delivery.");
  }

  const sessionKey = buildSessionKey({ userId, ipAddress, userAgent });
  const now = Date.now();
  const otpKey = `${OTP_KEY_PREFIX}${sessionKey}`;
  const metaKey = `${META_KEY_PREFIX}${sessionKey}`;

  try {
    const client = await getRedisOrThrow();
    const metaRecord = (await readJson(client, metaKey)) || {
      attempts: 0,
      sendHistory: [],
      blockedUntil: 0,
    };

    enforceSendLimit(metaRecord, now);

    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    await sendOtpByEmail(email, otp);

    await writeJson(
      client,
      otpKey,
      {
        otp,
        expiresAt: now + OTP_TTL_MS,
        attempts: 0,
      },
      OTP_TTL_MS,
    );

    const metaTtlMs = Math.max(
      SEND_WINDOW_MS,
      (metaRecord.blockedUntil || 0) - now,
    );
    await writeJson(client, metaKey, metaRecord, metaTtlMs);

    return { expiresInSeconds: OTP_TTL_MS / 1000 };
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createHttpError(503, "OTP service is unavailable.");
  }
};

export const verifyOtp = async ({ userId, ipAddress, userAgent, otp }) => {
  const sessionKey = buildSessionKey({ userId, ipAddress, userAgent });
  const now = Date.now();
  const otpKey = `${OTP_KEY_PREFIX}${sessionKey}`;
  const metaKey = `${META_KEY_PREFIX}${sessionKey}`;
  const verifiedKey = `${VERIFIED_KEY_PREFIX}${sessionKey}`;

  try {
    const client = await getRedisOrThrow();
    const [record, metaRecord] = await Promise.all([
      readJson(client, otpKey),
      readJson(client, metaKey),
    ]);

    if (!record) {
      throw createHttpError(400, "Invalid or expired OTP.");
    }

    if (metaRecord?.blockedUntil && metaRecord.blockedUntil > now) {
      throw createHttpError(429, "Too many invalid OTP attempts.");
    }

    if (record.expiresAt < now) {
      await client.del(otpKey);
      throw createHttpError(400, "Invalid or expired OTP.");
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      const blockedUntil = now + VERIFY_BLOCK_MS;
      const nextMeta = {
        sendHistory: metaRecord?.sendHistory || [],
        blockedUntil,
      };
      await client.del(otpKey);
      await writeJson(
        client,
        metaKey,
        nextMeta,
        Math.max(SEND_WINDOW_MS, VERIFY_BLOCK_MS),
      );
      throw createHttpError(429, "Too many invalid OTP attempts.");
    }

    if (record.otp !== String(otp || "").trim()) {
      record.attempts += 1;
      const remainingMs = record.expiresAt - now;
      if (remainingMs > 0) {
        await writeJson(client, otpKey, record, remainingMs);
      } else {
        await client.del(otpKey);
      }
      throw createHttpError(400, "Invalid or expired OTP.");
    }

    await client.del(otpKey);
    const verifiedUntil = now + SESSION_TTL_MS;
    await client.set(verifiedKey, String(verifiedUntil), {
      PX: SESSION_TTL_MS,
    });

    return { verifiedUntil };
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createHttpError(503, "OTP service is unavailable.");
  }
};

export const isSessionVerified = async ({ userId, ipAddress, userAgent }) => {
  const sessionKey = buildSessionKey({ userId, ipAddress, userAgent });
  const verifiedKey = `${VERIFIED_KEY_PREFIX}${sessionKey}`;

  try {
    const client = await getRedisOrThrow();
    const value = await client.get(verifiedKey);
    if (!value) return false;

    const verifiedUntil = Number(value);
    if (!verifiedUntil || verifiedUntil < Date.now()) {
      await client.del(verifiedKey);
      return false;
    }

    return true;
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createHttpError(503, "OTP service is unavailable.");
  }
};
