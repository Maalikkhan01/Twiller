"use client";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import React, { useEffect, useRef, useState } from "react";
import LoadingSpinner from "../loading-spinner";
import Sidebar from "./Sidebar";
import RightSidebar from "./Rightsidebar";
import ProfilePage from "../ProfilePage";
import MoreMenuPage from "../MoreMenuPage";
import SettingsPage from "../SettingsPage";
import NotificationsPage from "../NotificationsPage";
import ExplorePage from "../ExplorePage";
import MessagesPage from "../MessagesPage";
import BookmarksPage from "../BookmarksPage";
import { useTranslation } from "react-i18next";

const Mainlayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState("home");
  const pollingLock = useRef(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const activePage = currentPage.split(":")[0];
  const moreSection = currentPage.split(":")[1];
  const sidebarPage =
    activePage === "settings" || activePage === "notifications"
      ? "more"
      : activePage;

  useEffect(() => {
    if (!user?.notificationPreferences?.keywordNotifications) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const poll = async () => {
      if (pollingLock.current) return;
      pollingLock.current = true;
      try {
        const res = await axiosInstance.get("/keyword-notifications");
        const items = Array.isArray(res.data) ? res.data : [];
        for (const item of items) {
          if (!item?.tweetId || !item?.content) continue;
          try {
            const notification = new Notification(t("notifications.keywordAlert"), {
              body: item.content,
              icon: "/logo.png",
            });
            notification.onclick = () => {
              try {
                window.focus();
                window.location.href = `/#tweet-${item.tweetId}`;
              } catch (error) {
                console.error(error);
              }
            };
          } catch (error) {
            console.error(error);
          }
        }
        if (items.length) {
          setNotificationCount((prev) => prev + items.length);
        }
      } catch (error) {
        console.error(error);
      } finally {
        pollingLock.current = false;
      }
    };

    const interval = setInterval(poll, 25000);
    poll();
    return () => clearInterval(interval);
  }, [t, user?._id, user?.notificationPreferences?.keywordNotifications]);

  useEffect(() => {
    if (activePage === "notifications") {
      setNotificationCount(0);
    }
  }, [activePage]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-4xl font-bold mb-4">X</div>
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1280px] justify-center overflow-x-hidden">
        <div className="w-20 shrink-0 border-r border-gray-800 lg:w-64">
        <Sidebar
          currentPage={sidebarPage}
          onNavigate={setCurrentPage}
          notificationCount={notificationCount}
        />
      </div>
      <main className="min-w-0 flex-1 border-x border-gray-800 xl:flex-none xl:w-[680px]">
        {activePage === "profile" ? (
          <ProfilePage />
        ) : activePage === "explore" ? (
          <ExplorePage />
        ) : activePage === "messages" ? (
          <MessagesPage />
        ) : activePage === "bookmarks" ? (
          <BookmarksPage />
        ) : activePage === "more" ? (
          <MoreMenuPage onNavigate={setCurrentPage} />
        ) : activePage === "settings" ? (
          <SettingsPage
            initialSection={moreSection}
            onNavigate={setCurrentPage}
          />
        ) : activePage === "notifications" ? (
          <NotificationsPage onNavigate={setCurrentPage} />
        ) : (
          children
        )}
      </main>
      <div className="hidden xl:block w-[340px] shrink-0 border-l border-gray-800 p-4">
        <RightSidebar />
      </div>
      </div>
    </div>
  );
};

export default Mainlayout;
