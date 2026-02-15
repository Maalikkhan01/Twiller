import User from "../models/user.js";
import { getPlanConfig, listPlans, PLAN_KEYS } from "./planConfig.js";
import {
  assertPaymentWindowOpen,
  createOrderForPlan,
  isWithinPaymentWindow,
} from "./paymentService.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const resolveEffectiveSubscription = (user) => {
  if (!user) {
    return { plan: getPlanConfig(PLAN_KEYS.FREE), status: "inactive" };
  }

  let isActive = user.subscriptionStatus === "active";
  if (user.subscriptionExpiry) {
    const expiry = new Date(user.subscriptionExpiry).getTime();
    if (Number.isFinite(expiry) && expiry < Date.now()) {
      isActive = false;
    }
  }

  if (!isActive) {
    return { plan: getPlanConfig(PLAN_KEYS.FREE), status: "inactive" };
  }

  return {
    plan: getPlanConfig(user.subscriptionPlan || PLAN_KEYS.FREE),
    status: "active",
  };
};

export const getPlans = (_req, res) => {
  const plans = listPlans().map((plan) => ({
    key: plan.key,
    name: plan.name,
    price: plan.price,
    currency: plan.currency,
    tweetLimit: plan.tweetLimit,
    durationMonths: plan.durationMonths,
  }));

  return res.status(200).json({
    plans,
    paymentWindowOpen: isWithinPaymentWindow(),
  });
};

export const getSubscriptionStatus = async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) {
      throw createHttpError(400, "Email required.");
    }

    const user = await User.findOne({ email }).select(
      "subscriptionPlan subscriptionStatus subscriptionExpiry tweetCount email",
    );

    if (!user) {
      throw createHttpError(404, "User not found.");
    }

    const { plan, status } = resolveEffectiveSubscription(user);

    return res.status(200).json({
      planKey: plan.key,
      planName: plan.name,
      status,
      expiry: user.subscriptionExpiry,
      tweetCount: user.tweetCount || 0,
      tweetLimit: plan.tweetLimit,
      paymentWindowOpen: isWithinPaymentWindow(),
    });
  } catch (error) {
    return next(error);
  }
};

export const createSubscriptionOrder = async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) {
      throw createHttpError(400, "Email required.");
    }

    const planKey = String(req.body?.planKey || "").toUpperCase();
    const plan = getPlanConfig(planKey);

    if (!plan || plan.key === PLAN_KEYS.FREE) {
      throw createHttpError(400, "Invalid subscription plan.");
    }

    assertPaymentWindowOpen();

    const user = await User.findOne({ email }).select("_id email");
    if (!user) {
      throw createHttpError(404, "User not found.");
    }

    const order = await createOrderForPlan({
      planKey: plan.key,
      userId: user._id,
    });

    return res.status(200).json({
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
      plan: {
        key: plan.key,
        name: plan.name,
        price: plan.price,
      },
    });
  } catch (error) {
    return next(error);
  }
};
