import axios from "axios";
import crypto from "crypto";
import mongoose from "mongoose";
import { Buffer } from "buffer";
import { getPlanConfig, PLAN_KEYS } from "./planConfig.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getRazorpayConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw createHttpError(503, "Payment service is not configured.");
  }

  return { keyId, keySecret };
};

const getWebhookSecret = () => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw createHttpError(503, "Webhook secret is not configured.");
  }
  return secret;
};

const getInvoiceEmailConfig = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.INVOICE_FROM_EMAIL || process.env.OTP_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    throw createHttpError(503, "Invoice email service is not configured.");
  }
  return { apiKey, fromEmail };
};

const PAYMENT_START_MINUTES = 10 * 60;
const PAYMENT_END_MINUTES = 11 * 60;

export const isWithinPaymentWindow = () => {
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
  const totalMinutes = hour * 60 + minute;

  return (
    totalMinutes >= PAYMENT_START_MINUTES &&
    totalMinutes < PAYMENT_END_MINUTES
  );
};

export const assertPaymentWindowOpen = () => {
  if (!isWithinPaymentWindow()) {
    throw createHttpError(
      403,
      "Payments are allowed only between 10 AM and 11 AM IST.",
    );
  }
};

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    paymentId: { type: String, unique: true, sparse: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    planKey: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, default: "created" },
    processedAt: { type: Date, default: null },
    invoiceSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const MODEL_NAME = "SubscriptionPayment";
export const SubscriptionPayment =
  mongoose.models[MODEL_NAME] ||
  mongoose.model(MODEL_NAME, subscriptionPaymentSchema);

export const createOrderForPlan = async ({ planKey, userId }) => {
  const plan = getPlanConfig(planKey);
  if (!plan || plan.key === PLAN_KEYS.FREE || plan.price <= 0) {
    throw createHttpError(400, "Invalid subscription plan.");
  }

  const { keyId, keySecret } = getRazorpayConfig();
  const amount = Math.round(plan.price * 100);
  const receipt = `twiller_${userId}_${Date.now()}`;
  const idempotencyKey = crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");

  const response = await axios.post(
    "https://api.razorpay.com/v1/orders",
    {
      amount,
      currency: plan.currency,
      receipt,
      payment_capture: 1,
      notes: {
        planKey: plan.key,
        userId: String(userId),
      },
    },
    {
      auth: {
        username: keyId,
        password: keySecret,
      },
      headers: {
        "X-Idempotency-Key": idempotencyKey,
        "Content-Type": "application/json",
      },
    },
  );

  const order = response.data;

  await SubscriptionPayment.create({
    orderId: order.id,
    userId,
    planKey: plan.key,
    amount: order.amount,
    currency: order.currency,
    status: "created",
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    plan,
  };
};

export const verifyWebhookSignature = (rawBody, signature) => {
  if (!signature) {
    throw createHttpError(400, "Missing webhook signature.");
  }

  const secret = getWebhookSecret();
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const digestBuffer = Buffer.from(digest, "hex");

  if (
    sigBuffer.length !== digestBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, digestBuffer)
  ) {
    throw createHttpError(400, "Invalid webhook signature.");
  }
};

export const markPaymentCaptured = async ({ orderId, paymentId }) => {
  return SubscriptionPayment.findOneAndUpdate(
    { orderId, status: { $ne: "paid" } },
    { $set: { status: "paid", paymentId, processedAt: new Date() } },
    { new: true },
  );
};

export const getPaymentByOrderId = async (orderId) =>
  SubscriptionPayment.findOne({ orderId }).lean();

export const markInvoiceSent = async (orderId) =>
  SubscriptionPayment.findOneAndUpdate(
    { orderId },
    { $set: { invoiceSentAt: new Date() } },
    { new: true },
  );

export const sendInvoiceEmail = async ({
  to,
  planName,
  amount,
  startDate,
  expiryDate,
  orderId,
  paymentId,
}) => {
  const { apiKey, fromEmail } = getInvoiceEmailConfig();

  const formattedStart = new Date(startDate).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  const formattedExpiry = expiryDate
    ? new Date(expiryDate).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      })
    : "N/A";

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: fromEmail,
      to,
      subject: "Twiller Subscription Invoice",
      text: `Invoice details:\nPlan: ${planName}\nAmount: INR ${amount}\nStart: ${formattedStart}\nExpiry: ${formattedExpiry}\nOrder: ${orderId}\nPayment: ${paymentId}`,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );
};

export const computeExpiryDate = (startDate, plan) => {
  if (!plan?.durationMonths || plan.durationMonths <= 0) {
    return null;
  }

  const expiry = new Date(startDate);
  expiry.setMonth(expiry.getMonth() + plan.durationMonths);
  return expiry;
};
