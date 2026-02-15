export const PLAN_KEYS = {
  FREE: "FREE",
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
};

export const PLAN_CONFIG = {
  [PLAN_KEYS.FREE]: {
    key: PLAN_KEYS.FREE,
    name: "FREE",
    price: 0,
    currency: "INR",
    tweetLimit: 1,
    durationMonths: 0,
  },
  [PLAN_KEYS.BRONZE]: {
    key: PLAN_KEYS.BRONZE,
    name: "BRONZE",
    price: 100,
    currency: "INR",
    tweetLimit: 3,
    durationMonths: 1,
  },
  [PLAN_KEYS.SILVER]: {
    key: PLAN_KEYS.SILVER,
    name: "SILVER",
    price: 300,
    currency: "INR",
    tweetLimit: 5,
    durationMonths: 1,
  },
  [PLAN_KEYS.GOLD]: {
    key: PLAN_KEYS.GOLD,
    name: "GOLD",
    price: 1000,
    currency: "INR",
    tweetLimit: null,
    durationMonths: 1,
  },
};

export const getPlanConfig = (planKey) =>
  PLAN_CONFIG[planKey] || PLAN_CONFIG[PLAN_KEYS.FREE];

export const listPlans = () => Object.values(PLAN_CONFIG);
