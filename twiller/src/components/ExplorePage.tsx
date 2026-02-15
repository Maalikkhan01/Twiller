"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search, TrendingUp } from "lucide-react";
import axiosInstance from "@/lib/axiosInstance";
import TweetCard from "./TweetCard";
import TweetSkeleton from "./TweetSkeleton";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { useAuth } from "@/context/AuthContext";

const pageSize = 20;

export default function ExplorePage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [searchHasMore, setSearchHasMore] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [trendingTweets, setTrendingTweets] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followLoadingById, setFollowLoadingById] = useState<Record<string, boolean>>({});
  const [followFeedback, setFollowFeedback] = useState("");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => clearTimeout(timeout);
  }, [query]);

  const fetchTrending = useCallback(async () => {
    if (!user) return;
    setTrendingLoading(true);
    try {
      const res = await axiosInstance.get("/post", {
        params: { limit: 10, sort: "trending" },
      });
      setTrendingTweets(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setTrendingLoading(false);
    }
  }, [user]);

  const fetchSuggested = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.get("/users/suggested");
      setSuggestedUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
    }
  }, [user]);

  const fetchFollowing = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.get("/api/v2/users/me");
      const following = Array.isArray(res.data?.following)
        ? res.data.following.map((id: any) => String(id))
        : [];
      setFollowingIds(new Set(following));
    } catch (error) {
      console.error(error);
    }
  }, [user]);

  const fetchSearch = useCallback(
    async (cursor?: string | null) => {
      if (!user || !debouncedQuery) return;
      if (cursor) {
        setSearchLoading(true);
      } else {
        setSearchLoading(true);
        setSearchResults([]);
        setSearchCursor(null);
        setSearchHasMore(true);
      }

      try {
        const res = await axiosInstance.get("/post", {
          params: { limit: pageSize, cursor: cursor || undefined, q: debouncedQuery },
        });
        const items = Array.isArray(res.data) ? res.data : [];
        setSearchResults((prev) => {
          if (!cursor) return items;
          const existing = new Set(prev.map((tweet) => tweet._id));
          const next = items.filter((tweet) => !existing.has(tweet._id));
          return [...prev, ...next];
        });
        setSearchCursor(items.length ? items[items.length - 1]._id : cursor || null);
        setSearchHasMore(items.length === pageSize);
      } catch (error) {
        console.error(error);
      } finally {
        setSearchLoading(false);
      }
    },
    [debouncedQuery, user],
  );

  useEffect(() => {
    if (!user) return;
    void fetchTrending();
    void fetchSuggested();
    void fetchFollowing();
  }, [fetchFollowing, fetchSuggested, fetchTrending, user]);

  const toggleFollow = async (targetUserId: string) => {
    if (!targetUserId || followLoadingById[targetUserId]) return;
    const currentlyFollowing = followingIds.has(targetUserId);
    setFollowLoadingById((prev) => ({ ...prev, [targetUserId]: true }));
    setFollowFeedback("");

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
      setFollowFeedback(currentlyFollowing ? "Unfollowed." : "Following.");
    } catch (error: any) {
      setFollowFeedback(
        error?.response?.data?.message || error?.message || "Follow action failed.",
      );
    } finally {
      setFollowLoadingById((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([]);
      setSearchCursor(null);
      setSearchHasMore(true);
      return;
    }
    void fetchSearch(null);
  }, [debouncedQuery, fetchSearch]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !debouncedQuery) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && searchHasMore && !searchLoading) {
          void fetchSearch(searchCursor);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [debouncedQuery, fetchSearch, searchCursor, searchHasMore, searchLoading]);

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-gray-800 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 h-4 w-4" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Twiller"
            className="pl-10 bg-black border-gray-800 text-white placeholder-gray-500 rounded-full"
          />
        </div>
      </div>

      {debouncedQuery ? (
        <div className="divide-y divide-gray-800">
          {searchLoading && searchResults.length === 0 ? (
            <TweetSkeleton count={3} />
          ) : searchResults.length === 0 ? (
            <Card className="bg-black border-none">
              <CardContent className="py-12 text-center text-gray-400">
                No results for "{debouncedQuery}".
              </CardContent>
            </Card>
          ) : (
            searchResults.map((tweet) => (
              <TweetCard key={tweet._id} tweet={tweet} />
            ))
          )}
          {searchLoading && searchResults.length > 0 && <TweetSkeleton count={1} />}
          <div ref={loadMoreRef} className="h-6" />
        </div>
      ) : (
        <div className="px-4 py-4 space-y-6">
          <Card className="bg-black border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-white font-semibold">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                Trending now
              </div>
              <div className="mt-4 divide-y divide-gray-800">
                {trendingLoading ? (
                  <TweetSkeleton count={2} />
                ) : trendingTweets.length === 0 ? (
                  <div className="py-6 text-sm text-gray-400">
                    No trending tweets yet.
                  </div>
                ) : (
                  trendingTweets.map((tweet) => (
                    <TweetCard key={tweet._id} tweet={tweet} />
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black border-gray-800">
            <CardContent className="p-4">
              <h3 className="text-white font-semibold">Suggested for you</h3>
              {followFeedback && (
                <p className="mt-2 text-xs text-blue-300">{followFeedback}</p>
              )}
              <div className="mt-4 space-y-4">
                {suggestedUsers.length === 0 ? (
                  <div className="text-sm text-gray-400">
                    No suggestions right now.
                  </div>
                ) : (
                  suggestedUsers.map((suggestion) => (
                    <div
                      key={suggestion._id || suggestion.username}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-white font-semibold">
                          {suggestion.displayName || suggestion.username}
                        </p>
                        <p className="text-gray-500 text-sm">
                          @{suggestion.username}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        data-qa="follow-toggle-button"
                        disabled={!suggestion._id || followLoadingById[suggestion._id]}
                        onClick={() => void toggleFollow(String(suggestion._id))}
                        className="rounded-full bg-white px-4 font-semibold text-black hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-700"
                      >
                        {followLoadingById[suggestion._id]
                          ? "..."
                          : followingIds.has(String(suggestion._id))
                            ? "Following"
                            : "Follow"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
