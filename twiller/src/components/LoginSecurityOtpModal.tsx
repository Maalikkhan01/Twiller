"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import LoadingSpinner from "./loading-spinner";

interface LoginSecurityOtpModalProps {
  isOpen: boolean;
  isSending: boolean;
  isVerifying: boolean;
  error?: string;
  infoMessage?: string;
  onSubmit: (otp: string) => void;
  onResend: () => void;
  onCancel: () => void;
}

export default function LoginSecurityOtpModal({
  isOpen,
  isSending,
  isVerifying,
  error,
  infoMessage,
  onSubmit,
  onResend,
  onCancel,
}: LoginSecurityOtpModalProps) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setOtp("");
      setLocalError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isVerifying) return;

    if (!/^\d{6}$/.test(otp)) {
      setLocalError(t("language.otpInvalid"));
      return;
    }

    setLocalError("");
    onSubmit(otp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-md bg-black border-gray-800 text-white">
        <CardHeader className="relative pb-6">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-gray-900"
            onClick={onCancel}
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <ShieldCheck className="h-10 w-10 text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {t("auth.loginSecurityTitle")}
            </CardTitle>
            <p className="mt-2 text-sm text-gray-400">
              {t("auth.loginSecurityDescription")}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(error || localError) && (
            <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
              {error || localError}
            </div>
          )}
          {infoMessage && !error && !localError && (
            <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-3 text-sm text-blue-200">
              {infoMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("language.otpPlaceholder")}
              value={otp}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/\D/g, "");
                setOtp(nextValue.slice(0, 6));
                if (localError) setLocalError("");
              }}
              className="bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
              disabled={isVerifying || isSending}
            />
            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full text-lg"
              disabled={isVerifying || isSending}
            >
              {isVerifying ? (
                <div className="flex items-center space-x-2">
                  <LoadingSpinner size="sm" />
                  <span>{t("language.verifyingOtp")}</span>
                </div>
              ) : (
                t("language.verifyOtp")
              )}
            </Button>
          </form>

          <div className="flex items-center justify-between text-sm text-gray-400">
            <Button
              type="button"
              variant="ghost"
              className="text-blue-400 hover:text-blue-300"
              onClick={onResend}
              disabled={isSending || isVerifying}
            >
              {isSending ? t("language.sendingOtp") : t("language.resend")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-gray-400 hover:text-white"
              onClick={onCancel}
              disabled={isSending || isVerifying}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
