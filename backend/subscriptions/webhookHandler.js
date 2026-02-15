import User from "../models/user.js";
import { getPlanConfig, PLAN_KEYS } from "./planConfig.js";
import {
  computeExpiryDate,
  getPaymentByOrderId,
  markPaymentCaptured,
  markInvoiceSent,
  sendInvoiceEmail,
  verifyWebhookSignature,
} from "./paymentService.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const extractRawBody = (req) => {
  if (req.rawBody) {
    return Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(String(req.rawBody));
  }
  if (typeof req.body === "string") {
    return Buffer.from(req.body);
  }
  return Buffer.from(JSON.stringify(req.body || {}));
};

export const handleSubscriptionWebhook = async (req, res, next) => {
  try {
    const signature =
      req.headers["x-razorpay-signature"] ||
      req.headers["X-Razorpay-Signature"];

    verifyWebhookSignature(extractRawBody(req), String(signature || ""));

    const event = req.body?.event;
    if (event !== "payment.captured") {
      return res.status(200).json({ status: "ignored" });
    }

    const paymentEntity = req.body?.payload?.payment?.entity;
    if (!paymentEntity?.order_id || !paymentEntity?.id) {
      throw createHttpError(400, "Invalid webhook payload.");
    }

    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    const orderRecord = await getPaymentByOrderId(orderId);
    if (!orderRecord) {
      throw createHttpError(400, "Order not found.");
    }

    if (
      Number(paymentEntity.amount) !== Number(orderRecord.amount) ||
      paymentEntity.currency !== orderRecord.currency
    ) {
      throw createHttpError(400, "Payment amount mismatch.");
    }

    const plan = getPlanConfig(orderRecord.planKey);
    if (!plan || plan.key === PLAN_KEYS.FREE) {
      throw createHttpError(400, "Invalid plan.");
    }

    const isFirstProcess = orderRecord.status !== "paid";
    let lockedRecord = null;
    if (isFirstProcess) {
      lockedRecord = await markPaymentCaptured({ orderId, paymentId });
      if (!lockedRecord) {
        return res.status(200).json({ status: "ok" });
      }
    }

    const user = await User.findById(orderRecord.userId);
    if (!user) {
      throw createHttpError(404, "User not found.");
    }

    const startDate = isFirstProcess
      ? new Date()
      : orderRecord.processedAt || new Date();
    const baseExpiryDate =
      isFirstProcess &&
      user.subscriptionExpiry &&
      new Date(user.subscriptionExpiry).getTime() > startDate.getTime()
        ? new Date(user.subscriptionExpiry)
        : startDate;
    const expiryDate = isFirstProcess
      ? computeExpiryDate(baseExpiryDate, plan)
      : user.subscriptionExpiry;

    if (isFirstProcess) {
      user.subscriptionPlan = plan.key;
      user.subscriptionStatus = "active";
      user.subscriptionExpiry = expiryDate;
      user.tweetCount = 0;
      await user.save();
    }

    const shouldSendInvoice =
      !orderRecord.invoiceSentAt &&
      (!lockedRecord || !lockedRecord.invoiceSentAt);

    if (user.email && shouldSendInvoice) {
      await sendInvoiceEmail({
        to: user.email,
        planName: plan.name,
        amount: plan.price,
        startDate,
        expiryDate,
        orderId,
        paymentId,
      });
      await markInvoiceSent(orderId);
    }

    return res.status(200).json({ status: "ok" });
  } catch (error) {
    return next(error);
  }
};
