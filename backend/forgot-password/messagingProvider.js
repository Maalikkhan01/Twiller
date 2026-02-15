import axios from "axios";
import { Buffer } from "buffer";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getResendConfig = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.FORGOT_PASSWORD_FROM_EMAIL || process.env.OTP_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw createHttpError(
      503,
      "Password reset email service is not configured.",
    );
  }

  return { apiKey, fromEmail };
};

const getTwilioConfig = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw createHttpError(
      503,
      "Password reset SMS service is not configured.",
    );
  }

  return { accountSid, authToken, fromNumber };
};

export const assertEmailConfigured = () => {
  getResendConfig();
};

export const assertSmsConfigured = () => {
  getTwilioConfig();
};

export const sendPasswordByEmail = async (email, resetLink) => {
  const { apiKey, fromEmail } = getResendConfig();

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: fromEmail,
      to: email,
      subject: "Twiller Password Reset",
      text: `Use this link to reset your Twiller password: ${resetLink}\nThis link expires in 15 minutes.`,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );
};

export const sendPasswordBySms = async (phone, resetLink) => {
  const { accountSid, authToken, fromNumber } = getTwilioConfig();
  const payload = new URLSearchParams({
    From: fromNumber,
    To: phone,
    Body: `Reset your Twiller password: ${resetLink} (expires in 15 minutes).`,
  });

  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64",
  );

  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    payload.toString(),
    {
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
};
