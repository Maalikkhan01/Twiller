import crypto from "crypto";
import { getAuthClient } from "./firebaseAdminClient.js";
import { assertWithinLimit, markRequested } from "./rateLimiter.js";
import PasswordResetToken from "../models/passwordResetToken.js";
import {
  assertEmailConfigured,
  assertSmsConfigured,
  sendPasswordByEmail,
  sendPasswordBySms,
} from "./messagingProvider.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?\d{8,15}$/;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const normalizePhone = (phone) => {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) {
    return `+${digits.slice(1).replace(/\D/g, "")}`;
  }
  const onlyNumbers = digits.replace(/\D/g, "");
  return onlyNumbers ? `+${onlyNumbers}` : "";
};

const parseIdentifier = (raw) => {
  const value = String(raw || "").trim();
  if (!value) {
    throw createHttpError(400, "Email or phone number is required.");
  }

  if (EMAIL_REGEX.test(value)) {
    return { type: "email", value: normalizeEmail(value) };
  }

  const normalizedPhone = normalizePhone(value);
  if (normalizedPhone && PHONE_REGEX.test(normalizedPhone)) {
    return { type: "phone", value: normalizedPhone };
  }

  throw createHttpError(400, "Provide a valid email or phone number.");
};

const resolveUser = async (auth, identifier) => {
  if (identifier.type === "email") {
    return auth.getUserByEmail(identifier.value);
  }
  return auth.getUserByPhoneNumber(identifier.value);
};

const createResetToken = () => crypto.randomBytes(32).toString("hex");

const hashResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildResetLink = (token) => {
  const baseUrl =
    process.env.RESET_PASSWORD_URL ||
    (process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL.replace(/\/$/, "")}/reset-password`
      : "");

  if (!baseUrl) {
    throw createHttpError(503, "Password reset link is not configured.");
  }

  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
};

export const requestPasswordReset = async (identifierInput) => {
  const identifier = parseIdentifier(identifierInput);
  const rateKey = `${identifier.type}:${identifier.value}`;

  await assertWithinLimit(rateKey);

  const auth = getAuthClient();
  let userRecord;
  try {
    userRecord = await resolveUser(auth, identifier);
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      await markRequested(rateKey);
      return;
    }
    if (
      error?.code === "auth/invalid-phone-number" ||
      error?.code === "auth/invalid-email"
    ) {
      throw createHttpError(400, "Provide a valid email or phone number.");
    }
    throw error;
  }

  if (identifier.type === "email") {
    assertEmailConfigured();
  } else {
    assertSmsConfigured();
  }

  const token = createResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await PasswordResetToken.deleteMany({ userId: userRecord.uid });
  const tokenRecord = await PasswordResetToken.create({
    userId: userRecord.uid,
    tokenHash,
    expiresAt,
  });

  const resetLink = buildResetLink(token);

  try {
    if (identifier.type === "email") {
      await sendPasswordByEmail(identifier.value, resetLink);
    } else {
      await sendPasswordBySms(identifier.value, resetLink);
    }
  } catch (error) {
    await PasswordResetToken.deleteOne({ _id: tokenRecord._id });
    throw error;
  }

  await markRequested(rateKey);
};

export const resetPasswordWithToken = async ({ token, newPassword }) => {
  const trimmedToken = String(token || "").trim();
  const trimmedPassword = String(newPassword || "").trim();

  if (!trimmedToken || !trimmedPassword) {
    throw createHttpError(400, "Token and new password are required.");
  }

  if (trimmedPassword.length < 6) {
    throw createHttpError(400, "Password must be at least 6 characters.");
  }

  const tokenHash = hashResetToken(trimmedToken);
  const now = new Date();

  const record = await PasswordResetToken.findOne({ tokenHash });
  if (!record) {
    throw createHttpError(400, "Invalid or expired reset token.");
  }

  if (record.expiresAt < now) {
    await PasswordResetToken.deleteOne({ tokenHash });
    throw createHttpError(400, "Invalid or expired reset token.");
  }

  const auth = getAuthClient();
  try {
    await auth.updateUser(record.userId, { password: trimmedPassword });
  } catch (error) {
    if (error?.code === "auth/invalid-password") {
      throw createHttpError(400, "Password does not meet requirements.");
    }
    throw error;
  }

  await PasswordResetToken.deleteOne({ tokenHash });
};
