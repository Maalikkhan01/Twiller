import User from "../models/user.js";
import { getPlanConfig, PLAN_KEYS } from "./planConfig.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isSubscriptionActive = (user) => {
  if (user?.subscriptionStatus !== "active") return false;
  if (user?.subscriptionExpiry) {
    const expiry = new Date(user.subscriptionExpiry).getTime();
    if (Number.isFinite(expiry) && expiry < Date.now()) {
      return false;
    }
  }
  return true;
};

const resolveEffectivePlanKey = (user) => {
  if (!user) return PLAN_KEYS.FREE;
  if (!isSubscriptionActive(user)) return PLAN_KEYS.FREE;
  return user.subscriptionPlan || PLAN_KEYS.FREE;
};

export const checkTweetLimit = async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) return next();

    const user = await User.findOne({ email })
      .select("subscriptionPlan subscriptionStatus subscriptionExpiry tweetCount")
      .lean();

    if (!user) return next();

    req.subscriptionUser = user;

    const planKey = resolveEffectivePlanKey(user);
    const plan = getPlanConfig(planKey);
    const limit = plan.tweetLimit;

    if (limit === null || limit === undefined) {
      return next();
    }

    const currentCount = Number(user.tweetCount || 0);
    if (currentCount >= limit) {
      return next(
        createHttpError(403, "Tweet limit reached. Upgrade your plan."),
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export const trackTweetCount = (req, res, next) => {
  const email = req.user?.email;
  if (!email) return next();

  res.on("finish", () => {
    if (res.statusCode !== 201) return;
    User.findOneAndUpdate({ email }, { $inc: { tweetCount: 1 } })
      .exec()
      .catch(() => {});
  });

  return next();
};
