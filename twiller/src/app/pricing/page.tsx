"use client";

import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Mainlayout from "@/components/layout/Mainlayout";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";

type Plan = {
  key: string;
  name: string;
  price: number;
  currency: string;
  tweetLimit: number | null;
  durationMonths: number;
};

type SubscriptionStatus = {
  planKey: string;
  planName: string;
  status: string;
  expiry: string | null;
  tweetCount: number;
  tweetLimit: number | null;
};

type PlanResponse = {
  plans: Plan[];
  paymentWindowOpen?: boolean;
};

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const isWithinPaymentWindow = () => {
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
  return totalMinutes >= 10 * 60 && totalMinutes < 11 * 60;
};

const PricingContent = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [windowOpen, setWindowOpen] = useState(isWithinPaymentWindow());

  useEffect(() => {
    const interval = setInterval(() => {
      setWindowOpen(isWithinPaymentWindow());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await axiosInstance.get<PlanResponse>(
          "/subscriptions/plans",
        );
        setPlans(response.data?.plans || []);
      } catch {
        setPlans([]);
      }
    };
    void loadPlans();
  }, []);

  useEffect(() => {
    const loadStatus = async () => {
      if (!user) {
        setStatus(null);
        return;
      }
      try {
        const response = await axiosInstance.get<SubscriptionStatus>(
          "/subscriptions/me",
        );
        setStatus(response.data);
      } catch {
        setStatus(null);
      }
    };
    void loadStatus();
  }, [user?._id]);

  const handlePurchase = async (planKey: string) => {
    if (!user) {
      setMessage(t("pricing.loginRequired"));
      return;
    }

    if (!windowOpen) {
      setMessage(t("pricing.paymentWindowClosed"));
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await axiosInstance.post("/subscriptions/create-order", {
        planKey,
      });

      const { orderId, amount, currency, keyId, plan } = response.data || {};
      if (!window.Razorpay) {
        setMessage(t("pricing.gatewayFailed"));
        return;
      }

      const options = {
        key: keyId,
        amount,
        currency,
        name: "Twiller",
        description: `${plan?.name || planKey} Plan`,
        order_id: orderId,
        prefill: {
          email: user.email,
        },
        theme: {
          color: "#2563eb",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
      setMessage(t("pricing.paymentOpened"));
    } catch (error: any) {
      setMessage(
        error?.response?.data?.message ||
          t("pricing.paymentStartFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const currentPlanLabel = useMemo(() => {
    if (!status?.planName) return "FREE";
    return status.planName;
  }, [status?.planName]);

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
      <div className="min-h-screen bg-black text-white px-4 py-12">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">{t("pricing.title")}</h1>
            <p className="text-sm text-gray-400">
              {t("pricing.currentPlan", { plan: currentPlanLabel })}
            </p>
            <p className="text-xs text-gray-500">
              {t("pricing.paymentWindowInfo")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const isFree = plan.price === 0;
              const isCurrent =
                status?.planKey === plan.key && status?.status === "active";
              const limitLabel =
                plan.tweetLimit === null
                  ? t("pricing.unlimited")
                  : plan.tweetLimit;

              return (
                <Card
                  key={plan.key}
                  className="bg-gray-950/60 border-gray-800 text-white"
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription className="text-gray-400">
                      {isFree ? "INR 0" : `INR ${plan.price}/month`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-gray-300">
                      {t("pricing.tweetLimitLabel", { limit: limitLabel })}
                    </p>
                    {plan.durationMonths > 0 && (
                      <p className="text-xs text-gray-500">
                        {t("pricing.renewsEvery", {
                          count: plan.durationMonths,
                        })}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter>
                    {isFree ? (
                      <Button
                        variant="outline"
                        className="w-full border-gray-700 text-gray-400"
                        disabled
                      >
                        {t("pricing.freePlan")}
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                        disabled={
                          !windowOpen || isLoading || !user || isCurrent
                        }
                        onClick={() => void handlePurchase(plan.key)}
                      >
                        {isCurrent
                          ? t("pricing.currentPlanButton")
                          : windowOpen
                            ? t("pricing.subscribe")
                            : t("pricing.unavailable")}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {message ? (
            <div className="text-sm text-blue-400">{message}</div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default function PricingPage() {
  return (
    <AuthProvider>
      <Mainlayout>
        <PricingContent />
      </Mainlayout>
    </AuthProvider>
  );
}
