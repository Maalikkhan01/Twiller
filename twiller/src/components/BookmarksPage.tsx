"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import TweetCard from "./TweetCard";
import TweetSkeleton from "./TweetSkeleton";
import { Card, CardContent } from "./ui/card";
import { useAuth } from "@/context/AuthContext";

const pageSize = 20;

export default function BookmarksPage() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fetchBookmarks = useCallback(
    async (cursorValue?: string | null) => {
      if (!user) return;
      setLoading(true);
      try {
        const res = await axiosInstance.get("/bookmarks", {
          params: { limit: pageSize, cursor: cursorValue || undefined },
        });
        const items = Array.isArray(res.data) ? res.data : [];
        setBookmarks((prev) => {
          if (!cursorValue) return items;
          const existing = new Set(prev.map((item) => item._id));
          const next = items.filter((item) => !existing.has(item._id));
          return [...prev, ...next];
        });
        setCursor(
          items.length && items[items.length - 1].bookmarkId
            ? items[items.length - 1].bookmarkId
            : cursorValue || null,
        );
        setHasMore(items.length === pageSize);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void fetchBookmarks(null);
  }, [fetchBookmarks]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchBookmarks(cursor);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, fetchBookmarks, hasMore, loading]);

  const handleBookmarkChange = useCallback((tweetId: string, isBookmarked: boolean) => {
    if (isBookmarked) return;
    setBookmarks((prev) => prev.filter((item) => item._id !== tweetId));
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-gray-800 px-4 py-3">
        <h1 className="text-xl font-bold text-white">Bookmarks</h1>
        <p className="text-sm text-gray-400">Saved tweets for later.</p>
      </div>

      <div className="divide-y divide-gray-800">
        {loading && bookmarks.length === 0 ? (
          <TweetSkeleton count={3} />
        ) : bookmarks.length === 0 ? (
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center text-gray-400">
              You have no saved tweets yet.
            </CardContent>
          </Card>
        ) : (
          bookmarks.map((tweet) => (
            <TweetCard
              key={tweet._id}
              tweet={tweet}
              onBookmarkChange={handleBookmarkChange}
            />
          ))
        )}
        {loading && bookmarks.length > 0 && <TweetSkeleton count={1} />}
        <div ref={loadMoreRef} className="h-6" />
      </div>
    </div>
  );
}
