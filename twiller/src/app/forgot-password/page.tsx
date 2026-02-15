"use client";

import { useState, type FormEvent } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

type StatusState = {
  tone: "success" | "error";
  message: string;
};

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState("");
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    const trimmed = identifier.trim();
    if (!trimmed) {
      setStatus({
        tone: "error",
        message: t("forgot.errorEmpty"),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosInstance.post("/forgot-password", {
        identifier: trimmed,
      });
      setStatus({
        tone: "success",
        message: t("forgot.success"),
      });
      setIdentifier("");
    } catch (error: any) {
      if (error?.response?.status === 429) {
        setStatus({
          tone: "error",
          message: t("forgot.errorTooMany"),
        });
      } else {
        setStatus({
          tone: "error",
          message: error?.response?.data?.message || t("forgot.errorGeneric"),
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-neutral-950/70 p-8 shadow-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{t("forgot.title")}</h1>
          <p className="mt-2 text-sm text-gray-400">
            {t("forgot.description")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder={t("forgot.placeholder")}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="bg-black text-white border-gray-700 placeholder:text-gray-500"
              autoComplete="username"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("forgot.sending") : t("forgot.sendButton")}
          </Button>

          <p className="text-xs text-gray-500">
            {t("forgot.limitInfo")}
          </p>

          {status ? (
            <div
              className={`text-sm ${
                status.tone === "error" ? "text-red-400" : "text-green-400"
              }`}
            >
              {status.message}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
