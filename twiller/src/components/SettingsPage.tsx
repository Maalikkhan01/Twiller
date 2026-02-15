"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import LanguageSelector from "./LanguageSelector";
import LoadingSpinner from "./loading-spinner";
import { useTranslation } from "react-i18next";

interface SettingsPageProps {
  initialSection?: string;
  onNavigate?: (page: string) => void;
}

export default function SettingsPage({
  initialSection,
  onNavigate,
}: SettingsPageProps) {
  const { user, updateNotificationPreferences } = useAuth();
  const { t, i18n } = useTranslation();
  const [keywordNotifications, setKeywordNotifications] = useState(false);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [loginHistoryHasMore, setLoginHistoryHasMore] = useState(false);
  const loginHistoryLimit = 5;

  useEffect(() => {
    if (!initialSection) return;
    const element = document.getElementById(`settings-${initialSection}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [initialSection]);

  useEffect(() => {
    const fetchLoginHistory = async () => {
      if (!user?._id) return;
      try {
        setLoginHistoryLoading(true);
        const res = await axiosInstance.get("/login-security/history", {
          params: { limit: loginHistoryLimit, skip: 0 },
        });
        const items = res.data?.items || [];
        setLoginHistory(items);
        setLoginHistoryHasMore(Boolean(res.data?.hasMore));
      } catch (error) {
        console.error(error);
      } finally {
        setLoginHistoryLoading(false);
      }
    };

    setLoginHistory([]);
    setLoginHistoryHasMore(false);
    void fetchLoginHistory();
  }, [user?._id]);

  useEffect(() => {
    setKeywordNotifications(
      Boolean(user?.notificationPreferences?.keywordNotifications),
    );
  }, [user?.notificationPreferences?.keywordNotifications]);

  const handleKeywordToggle = async () => {
    if (!user) return;
    const nextValue = !keywordNotifications;

    if (nextValue) {
      if (typeof window === "undefined" || !("Notification" in window)) {
        setKeywordNotifications(false);
        await updateNotificationPreferences({ keywordNotifications: false });
        return;
      }

      let permission = Notification.permission;
      if (permission !== "granted") {
        try {
          permission = await Notification.requestPermission();
        } catch {
          permission = "denied";
        }
      }

      if (permission !== "granted") {
        setKeywordNotifications(false);
        await updateNotificationPreferences({ keywordNotifications: false });
        return;
      }
    }

    setKeywordNotifications(nextValue);
    try {
      await updateNotificationPreferences({
        keywordNotifications: nextValue,
      });
    } catch (error) {
      console.error(error);
      setKeywordNotifications(
        Boolean(user?.notificationPreferences?.keywordNotifications),
      );
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-900"
            onClick={() => onNavigate?.("more")}
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">
              {t("sidebar.settings")}
            </h1>
            <p className="text-sm text-gray-400">{t("sidebar.more")}</p>
          </div>
        </div>
      </div>

      <section
        id="settings-notifications"
        className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white font-semibold">
              {t("sidebar.notifications")}
            </p>
            <p className="text-xs text-gray-400">
              {t("profile.keywordNotificationsDesc")}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => void handleKeywordToggle()}
              className={`relative h-8 w-14 rounded-full transition ${
                keywordNotifications ? "bg-blue-500" : "bg-gray-700"
              }`}
              aria-pressed={keywordNotifications}
            >
              <span
                className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-transform ${
                  keywordNotifications ? "translate-x-6" : ""
                }`}
              />
            </button>
            <span className="text-sm text-gray-300">
              {keywordNotifications
                ? t("profile.toggleOn")
                : t("profile.toggleOff")}
            </span>
          </div>
        </div>
      </section>

      <section id="settings-language">
        <LanguageSelector />
      </section>

      <section id="settings-security">
        <Card className="bg-black border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {t("profile.loginHistory.title")}
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {loginHistoryLoading && loginHistory.length === 0 ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <div
                      key={`history-skeleton-${index}`}
                      className="h-12 rounded-lg bg-gray-900/60 animate-pulse"
                    />
                  ))}
                </div>
              ) : loginHistory.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {t("profile.loginHistory.empty")}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 text-xs text-gray-500 sm:grid-cols-5">
                    <span>{t("profile.loginHistory.device")}</span>
                    <span>{t("profile.loginHistory.browser")}</span>
                    <span>{t("profile.loginHistory.os")}</span>
                    <span>{t("profile.loginHistory.ip")}</span>
                    <span>{t("profile.loginHistory.dateTime")}</span>
                  </div>
                  {loginHistory.map((entry) => (
                    <div
                      key={`${entry.ipAddress}-${entry.loginTimestamp}`}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-gray-800 bg-gray-950/40 p-3 text-sm text-gray-200 sm:grid-cols-5"
                    >
                      <span className="capitalize">
                        {entry.deviceCategory || "-"}
                      </span>
                      <span>{entry.browserType || "-"}</span>
                      <span>{entry.operatingSystem || "-"}</span>
                      <span className="truncate">{entry.ipAddress || "-"}</span>
                      <span>
                        {new Date(entry.loginTimestamp).toLocaleString(
                          i18n.language,
                        )}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {loginHistoryHasMore && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="ghost"
                  className="text-blue-400 hover:text-blue-300"
                  onClick={() => {
                    void (async () => {
                      if (!user?._id) return;
                      try {
                        setLoginHistoryLoading(true);
                        const res = await axiosInstance.get(
                          "/login-security/history",
                          {
                            params: {
                              limit: loginHistoryLimit,
                              skip: loginHistory.length,
                            },
                          },
                        );
                        const items = res.data?.items || [];
                        setLoginHistory((prev) => [...prev, ...items]);
                        setLoginHistoryHasMore(Boolean(res.data?.hasMore));
                      } catch (error) {
                        console.error(error);
                      } finally {
                        setLoginHistoryLoading(false);
                      }
                    })();
                  }}
                  disabled={loginHistoryLoading}
                >
                  {loginHistoryLoading ? (
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span>{t("common.loading")}</span>
                    </div>
                  ) : (
                    t("profile.loginHistory.loadMore")
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
