"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import { useTranslation } from "react-i18next";
import { getSocket } from "@/lib/socket";

interface NotificationsPageProps {
  onNavigate?: (page: string) => void;
}

export default function NotificationsPage({
  onNavigate,
}: NotificationsPageProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const res = await axiosInstance.get("/keyword-notifications");
        const data = Array.isArray(res.data) ? res.data : [];
        setItems((prev) => {
          const existing = new Set(prev.map((item) => item.tweetId));
          const next = data.filter((item) => !existing.has(item.tweetId));
          return [...next, ...prev];
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    void fetchNotifications();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null;
    const handleNotification = (payload: any) => {
      if (!payload?.tweetId) return;
      setItems((prev) => {
        if (prev.some((item) => item.tweetId === payload.tweetId)) {
          return prev;
        }
        return [payload, ...prev];
      });
    };

    void (async () => {
      try {
        socket = await getSocket();
        socket.on("notification:new", handleNotification);
      } catch (error) {
        console.warn("Socket connection failed:", error);
      }
    })();

    return () => {
      if (socket) {
        socket.off("notification:new", handleNotification);
      }
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 px-4 py-3 z-10">
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
              {t("sidebar.notifications")}
            </h1>
            <p className="text-sm text-gray-400">{t("notifications.keywordAlert")}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-800">
        {loading ? (
          <div className="px-4 py-6 space-y-3">
            {[...Array(3)].map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-14 rounded-xl bg-gray-900/60 animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No notifications yet.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.tweetId}
              className="px-4 py-4 hover:bg-gray-950/60 transition-colors"
            >
              <p className="text-sm text-gray-400">
                {t("notifications.keywordAlert")}
              </p>
              <p className="mt-1 text-white">{item.content}</p>
              {item.timestamp && (
                <p className="mt-2 text-xs text-gray-500">
                  {new Date(item.timestamp).toLocaleString(i18n.language)}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
