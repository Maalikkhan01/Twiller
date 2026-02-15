"use client";

import React from "react";
import { Bell, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { useTranslation } from "react-i18next";

interface MoreMenuPageProps {
  onNavigate?: (page: string) => void;
}

export default function MoreMenuPage({ onNavigate }: MoreMenuPageProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 pb-4">
        <h1 className="text-xl font-bold text-white">{t("sidebar.more")}</h1>
        <p className="text-sm text-gray-400">{t("sidebar.settings")}</p>
      </div>

      <div className="space-y-3">
        <Button
          variant="ghost"
          className="w-full justify-start rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-5 text-white hover:bg-gray-950/80 transition-colors duration-150"
          onClick={() => onNavigate?.("notifications")}
        >
          <Bell className="mr-3 h-5 w-5 text-blue-400" />
          {t("sidebar.notifications")}
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-5 text-white hover:bg-gray-950/80 transition-colors duration-150"
          onClick={() => onNavigate?.("settings")}
        >
          <Settings className="mr-3 h-5 w-5 text-blue-400" />
          {t("sidebar.settings")}
        </Button>
      </div>
    </div>
  );
}
