import axios from "axios";
import { Buffer } from "buffer";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getResendConfig = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.OTP_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw createHttpError(503, "OTP email service is not configured.");
  }

  return { apiKey, fromEmail };
};

const getTwilioConfig = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw createHttpError(503, "OTP SMS service is not configured.");
  }

  return { accountSid, authToken, fromNumber };
};

export const sendOtpByEmail = async (email, otp) => {
  const { apiKey, fromEmail } = getResendConfig();

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: fromEmail,
      to: email,
      subject: "Twiller Language Change OTP",
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

export const sendOtpBySms = async (phone, otp) => {
  const { accountSid, authToken, fromNumber } = getTwilioConfig();
  const payload = new URLSearchParams({
    From: fromNumber,
    To: phone,
    Body: `Your Twiller OTP is ${otp}. It expires in 5 minutes.`,
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
