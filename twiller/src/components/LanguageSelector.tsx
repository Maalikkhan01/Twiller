"use client";

import { useEffect, useMemo, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useTranslation } from "react-i18next";

const OTP_REGEX = /^\d{6}$/;

export default function LanguageSelector() {
  const { t } = useTranslation();
  const { language, setLanguage, availableLanguages } = useLanguage();
  const [selectedKey, setSelectedKey] = useState(language.key);
  const [otp, setOtp] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedLanguage = useMemo(
    () =>
      availableLanguages.find((item) => item.key === selectedKey) || language,
    [availableLanguages, language, selectedKey],
  );

  useEffect(() => {
    setSelectedKey(language.key);
  }, [language.key]);

  const openOtpModal = async (languageKey: string) => {
    setIsModalOpen(true);
    setOtp("");
    setStatusMessage("");
    setErrorMessage("");
    setIsSending(true);
    try {
      await axiosInstance.post("/language/send-otp", { language: languageKey });
      setStatusMessage(t("language.otpSent"));
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.message || t("language.otpSendFailed"),
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleLanguageChange = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextKey = event.target.value;
    setSelectedKey(nextKey);
    if (nextKey === language.key) return;
    await openOtpModal(nextKey);
  };

  const handleVerify = async () => {
    if (!OTP_REGEX.test(otp.trim())) {
      setErrorMessage(t("language.otpInvalid"));
      return;
    }

    setIsVerifying(true);
    setErrorMessage("");
    try {
      const response = await axiosInstance.post("/language/verify-otp", {
        language: selectedKey,
        otp: otp.trim(),
      });
      await setLanguage(response?.data?.preferredLanguage || selectedKey);
      try {
        const stored = localStorage.getItem("twitter-user");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.preferredLanguage =
            response?.data?.preferredLanguage || selectedKey;
          localStorage.setItem("twitter-user", JSON.stringify(parsed));
        }
      } catch {
        // ignore localStorage sync errors
      }
      setStatusMessage(t("language.updateSuccess"));
      setIsModalOpen(false);
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.message || t("language.otpVerifyFailed"),
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    await openOtpModal(selectedKey);
  };

  const otpDescription =
    selectedLanguage.otpChannel === "email"
      ? t("language.otpDescriptionEmail")
      : t("language.otpDescriptionSms");

  return (
    <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-white font-semibold">{t("language.title")}</p>
          <p className="text-xs text-gray-400">{t("language.description")}</p>
          <p className="mt-2 text-xs text-gray-400">
            {t("language.current", {
              language: t(selectedLanguage.labelKey),
            })}
          </p>
        </div>
        <div className="min-w-[180px]">
          <label className="sr-only" htmlFor="language-select">
            {t("language.selectLabel")}
          </label>
          <select
            id="language-select"
            value={selectedKey}
            onChange={(event) => void handleLanguageChange(event)}
            className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
          >
            {availableLanguages.map((item) => (
              <option key={item.key} value={item.key}>
                {t(item.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusMessage ? (
        <p className="mt-3 text-xs text-green-400">{statusMessage}</p>
      ) : null}
      {errorMessage ? (
        <p className="mt-3 text-xs text-red-400">{errorMessage}</p>
      ) : null}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-black p-6 text-white">
            <h2 className="text-lg font-semibold">{t("language.otpTitle")}</h2>
            <p className="mt-2 text-xs text-gray-400">{otpDescription}</p>

            <div className="mt-4 space-y-3">
              <Input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder={t("language.otpPlaceholder")}
                className="border-gray-700 bg-black text-white"
                maxLength={6}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                  disabled={isVerifying}
                  onClick={() => void handleVerify()}
                >
                  {isVerifying
                    ? t("language.verifyingOtp")
                    : t("language.verifyOtp")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-gray-700 text-white"
                  onClick={() => setIsModalOpen(false)}
                >
                  {t("language.cancel")}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-blue-400"
                disabled={isSending}
                onClick={() => void handleResend()}
              >
                {isSending ? t("language.sendingOtp") : t("language.resend")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
