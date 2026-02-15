"use client";

import React from "react";

import {
  Home,
  Search,
  Mail,
  Bookmark,
  User,
  MoreHorizontal,
  Settings,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import TwitterLogo from "../Twitterlogo";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
  notificationCount?: number;
}

export default function Sidebar({
  currentPage = "home",
  onNavigate,
  notificationCount = 0,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const avatarSeed =
    user?.username || user?.email || user?.displayName || "user";
  const avatarUrl =
    user?.avatar ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
      avatarSeed,
    )}`;

  const handleComposeClick = () => {
    onNavigate?.("home");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("twiller:focus-composer"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const navigation = [
    {
      name: t("sidebar.home"),
      icon: Home,
      current: currentPage === "home",
      page: "home",
    },
    {
      name: t("sidebar.explore"),
      icon: Search,
      current: currentPage === "explore",
      page: "explore",
    },
    {
      name: t("sidebar.messages"),
      icon: Mail,
      current: currentPage === "messages",
      page: "messages",
    },
    {
      name: t("sidebar.bookmarks"),
      icon: Bookmark,
      current: currentPage === "bookmarks",
      page: "bookmarks",
    },
    {
      name: t("sidebar.profile"),
      icon: User,
      current: currentPage === "profile",
      page: "profile",
    },
    {
      name: t("sidebar.more"),
      icon: MoreHorizontal,
      current: currentPage === "more",
      page: "more",
      badge: notificationCount > 0,
      badgeCount: notificationCount,
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col bg-black">
      <div className="p-3 lg:p-4">
        <TwitterLogo size="lg" className="text-white" />
      </div>

      <nav className="flex-1 px-2 lg:px-3">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <Button
                variant="ghost"
                className={`relative h-11 w-full justify-center rounded-full px-3 text-base hover:bg-gray-900 lg:justify-start lg:px-4 lg:text-lg ${
                  item.current
                    ? "font-bold before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-1 before:bg-blue-500 before:rounded-full"
                    : "font-normal"
                } text-white hover:text-white transition-colors duration-150`}
                onClick={() => onNavigate?.(item.page)}
              >
                <item.icon className="h-6 w-6 lg:mr-3" />
                <span className="hidden lg:inline">{item.name}</span>
                {item.badge && (
                  <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-xs text-white lg:ml-2">
                    {item.badgeCount > 9 ? "9+" : item.badgeCount}
                  </span>
                )}
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-8 px-2">
          <Button
            type="button"
            onClick={handleComposeClick}
            data-qa="sidebar-post-button"
            className="h-12 w-full rounded-full bg-sky-500 py-3 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-sky-600 hover:shadow-md lg:text-base"
          >
            <span className="hidden lg:inline">{t("sidebar.post")}</span>
            <span className="lg:hidden">+</span>
          </Button>
        </div>
      </nav>

      {user && (
        <div className="border-t border-gray-800 p-3 lg:p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center rounded-full p-3 hover:bg-gray-900 lg:justify-start"
              >
                <Avatar className="mr-0 h-10 w-10 lg:mr-3">
                  <AvatarImage src={avatarUrl} alt={user.displayName} />
                  <AvatarFallback>{user.displayName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="hidden flex-1 text-left lg:block">
                  <div className="text-white font-semibold">
                    {user.displayName}
                  </div>
                  <div className="text-gray-400 text-sm">@{user.username}</div>
                </div>
                <MoreHorizontal className="ml-2 hidden h-5 w-5 text-gray-400 lg:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-black border-gray-800">
              <DropdownMenuItem
                className="text-white hover:bg-gray-900"
                onClick={() => onNavigate?.("settings")}
              >
                <Settings className="mr-2 h-4 w-4" />
                {t("sidebar.settings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem
                className="text-white hover:bg-gray-900"
                onClick={() => {
                  void logout();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("sidebar.logout", { username: user.username })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
