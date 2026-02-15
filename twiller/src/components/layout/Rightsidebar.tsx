"use client";

import { Search } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Input } from "../ui/input";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useTranslation } from "react-i18next";
import axiosInstance from "@/lib/axiosInstance";
import { useAuth } from "@/context/AuthContext";

export default function RightSidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followLoadingById, setFollowLoadingById] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState("");

  const fetchSuggestions = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await axiosInstance.get("/users/suggested");
      setSuggestions(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      setFeedback(error?.response?.data?.message || "Unable to load suggestions.");
    }
  }, [user?._id]);

  const fetchFollowing = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await axiosInstance.get("/api/v2/users/me");
      const following = Array.isArray(res.data?.following)
        ? res.data.following.map((id: any) => String(id))
        : [];
      setFollowingIds(new Set(following));
    } catch (error: any) {
      setFeedback(error?.response?.data?.message || "Unable to load follow state.");
    }
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) return;
    void fetchSuggestions();
    void fetchFollowing();
  }, [fetchFollowing, fetchSuggestions, user?._id]);

  const toggleFollow = async (targetUserId: string) => {
    if (!targetUserId || followLoadingById[targetUserId]) return;
    const currentlyFollowing = followingIds.has(targetUserId);
    setFollowLoadingById((prev) => ({ ...prev, [targetUserId]: true }));
    setFeedback("");
    try {
      if (currentlyFollowing) {
        await axiosInstance.delete(`/api/v2/users/${targetUserId}/follow`);
      } else {
        await axiosInstance.post(`/api/v2/users/${targetUserId}/follow`);
      }
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (currentlyFollowing) {
          next.delete(targetUserId);
        } else {
          next.add(targetUserId);
        }
        return next;
      });
      setFeedback(currentlyFollowing ? "Unfollowed." : "Following.");
    } catch (error: any) {
      setFeedback(error?.response?.data?.message || "Unable to update follow.");
    } finally {
      setFollowLoadingById((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  return (
    <div className="w-full space-y-4 px-1 py-1">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder={t("rightSidebar.searchPlaceholder")}
          className="h-11 rounded-full border-gray-800 bg-black pl-12 text-white placeholder:text-gray-500"
        />
      </div>

      <Card className="rounded-2xl border-gray-800 bg-[#0f1419] py-0 shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
        <CardContent className="p-4">
          <h3 className="mb-2 text-xl font-bold text-white">
            {t("rightSidebar.subscribeTitle")}
          </h3>
          <p className="mb-4 text-sm text-gray-400">
            {t("rightSidebar.subscribeBody")}
          </p>
          <Button className="h-11 rounded-full bg-blue-500 font-semibold text-white transition-colors duration-150 hover:bg-blue-600">
            {t("rightSidebar.subscribeButton")}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-gray-800 bg-[#0f1419] py-0 shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
        <CardContent className="p-4">
          <h3 className="mb-4 text-xl font-bold text-white">
            {t("rightSidebar.youMightLike")}
          </h3>
          {feedback && <p className="mb-3 text-xs text-blue-300">{feedback}</p>}
          <div className="space-y-4">
            {suggestions.map((suggestion) => (
              <div key={suggestion._id || suggestion.username} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={
                        suggestion.avatar ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                          suggestion.username || suggestion.displayName || "user",
                        )}`
                      }
                      alt={suggestion.displayName}
                    />
                    <AvatarFallback>{(suggestion.displayName || "U")[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="font-semibold text-white">
                        {suggestion.displayName || suggestion.username}
                      </span>
                      {suggestion.verified && (
                        <div className="rounded-full bg-blue-500 p-0.5">
                          <svg
                            className="h-3 w-3 fill-current text-white"
                            viewBox="0 0 20 20"
                          >
                            <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-400">@{suggestion.username}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={!suggestion._id || followLoadingById[suggestion._id]}
                  onClick={() => void toggleFollow(String(suggestion._id))}
                  className="h-11 rounded-full bg-white px-4 font-semibold text-black transition-colors duration-150 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-700"
                >
                  {followLoadingById[suggestion._id]
                    ? "..."
                    : followingIds.has(String(suggestion._id))
                      ? "Following"
                      : t("rightSidebar.follow")}
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            className="mt-4 h-11 p-0 text-blue-400 transition-colors duration-150 hover:text-blue-300"
          >
            {t("rightSidebar.showMore")}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2 p-4 text-xs text-gray-500">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <a href="#" className="hover:underline">
            {t("legal.termsOfService")}
          </a>
          <a href="#" className="hover:underline">
            {t("legal.privacyPolicy")}
          </a>
          <a href="#" className="hover:underline">
            {t("legal.cookiePolicy")}
          </a>
          <a href="#" className="hover:underline">
            {t("legal.accessibility")}
          </a>
          <a href="#" className="hover:underline">
            {t("legal.adsInfo")}
          </a>
        </div>
        <div>{t("footer.copy")}</div>
      </div>
    </div>
  );
}
