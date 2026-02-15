import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import TweetCard from "./TweetCard";
import TweetComposer from "./TweetComposer";
import axiosInstance from "@/lib/axiosInstance";
import TweetSkeleton from "./TweetSkeleton";
import { Card, CardContent } from "./ui/card";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/socket";
import { Button } from "./ui/button";
import { registerUiInteractionQa } from "@/lib/uiInteractionQa";

const Feed = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tweets, setTweets] = useState<any>([]);
  const [loading, setloading] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const pageSize = 20;
  const [pendingTweets, setPendingTweets] = useState<any[]>([]);
  const [showNewTweets, setShowNewTweets] = useState(false);
  const isAtTopRef = useRef(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const tweetsRef = useRef<any[]>([]);
  const [timelineTab, setTimelineTab] = useState<"foryou" | "following">("foryou");
  const [activeHashtag, setActiveHashtag] = useState("");
  const [replyTarget, setReplyTarget] = useState<{
    tweetId: string;
    displayName: string;
  } | null>(null);

  const fetchTweets = useCallback(async () => {
    try {
      setloading(true);
      setError("");

      if (activeHashtag) {
        const res = await axiosInstance.get("/api/v2/posts", {
          params: { limit: pageSize, hashtag: activeHashtag },
        });
        const items = Array.isArray(res.data) ? res.data : [];
        setTweets(items);
        setCursor(items.length ? items[items.length - 1]._id : null);
        setHasMore(items.length === pageSize);
        return;
      }

      const endpoint =
        timelineTab === "following"
          ? "/api/v2/discovery/timeline/following"
          : "/api/v2/discovery/timeline/algorithm";
      try {
        const res = await axiosInstance.get(endpoint, {
          params: { limit: pageSize },
        });
        const items = Array.isArray(res.data) ? res.data : [];
        setTweets(items);
        setCursor(items.length ? items[items.length - 1]._id : null);
        setHasMore(false);
      } catch {
        const legacy = await axiosInstance.get("/post", {
          params: { limit: pageSize },
        });
        const items = Array.isArray(legacy.data) ? legacy.data : [];
        setTweets(items);
        setCursor(items.length ? items[items.length - 1]._id : null);
        setHasMore(items.length === pageSize);
      }
    } catch (fetchError) {
      console.error(fetchError);
      setError(t("validation.generic"));
    } finally {
      setloading(false);
    }
  }, [activeHashtag, pageSize, t, timelineTab]);

  const fetchMore = useCallback(async () => {
    if (!activeHashtag || !cursor || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await axiosInstance.get("/api/v2/posts", {
        params: { limit: pageSize, cursor, hashtag: activeHashtag },
      });
      const items = Array.isArray(res.data) ? res.data : [];
      if (!items.length) {
        setHasMore(false);
        return;
      }
      setTweets((prev: any[]) => {
        const existing = new Set(prev.map((tweet) => tweet._id));
        const next = items.filter((tweet) => !existing.has(tweet._id));
        return [...prev, ...next];
      });
      setCursor(items[items.length - 1]._id || cursor);
      setHasMore(items.length === pageSize);
    } catch (fetchError) {
      console.error(fetchError);
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeHashtag, cursor, hasMore, isLoadingMore, pageSize]);

  useEffect(() => {
    void fetchTweets();
  }, [fetchTweets]);

  useEffect(() => {
    return registerUiInteractionQa();
  }, []);

  useEffect(() => {
    if (!user) return;
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null;
    const handleNewTweet = (tweet: any) => {
      if (!tweet?._id) return;
      if (tweetsRef.current.some((item) => item._id === tweet._id)) {
        return;
      }
      if (isAtTopRef.current) {
        setTweets((prev: any[]) => {
          if (prev.some((item) => item._id === tweet._id)) return prev;
          return [tweet, ...prev];
        });
        return;
      }

      setPendingTweets((prev) => {
        if (prev.some((item) => item._id === tweet._id)) return prev;
        setShowNewTweets(true);
        return [tweet, ...prev];
      });
    };

    void (async () => {
      try {
        socket = await getSocket();
        socket.on("tweet:new", handleNewTweet);
      } catch (socketError) {
        console.warn("Socket connection failed:", socketError);
      }
    })();

    return () => {
      if (socket) {
        socket.off("tweet:new", handleNewTweet);
      }
    };
  }, [user]);

  useEffect(() => {
    tweetsRef.current = tweets;
  }, [tweets]);

  useEffect(() => {
    const onScroll = () => {
      const atTop = window.scrollY < 120;
      setIsAtTop(atTop);
      isAtTopRef.current = atTop;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isAtTop && pendingTweets.length) {
      setTweets((prev: any[]) => [...pendingTweets, ...prev]);
      setPendingTweets([]);
      setShowNewTweets(false);
    }
  }, [isAtTop, pendingTweets]);

  const handleShowNewTweets = () => {
    if (!pendingTweets.length) return;
    setTweets((prev: any[]) => [...pendingTweets, ...prev]);
    setPendingTweets([]);
    setShowNewTweets(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchMore]);

  const handlenewtweet = (newtweet: any) => {
    setTweets((prev: any) => [newtweet, ...prev]);
  };

  const handleHashtagClick = (hashtag: string) => {
    setActiveHashtag(hashtag.toLowerCase());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReply = (tweetId: string, displayName: string) => {
    setReplyTarget({ tweetId, displayName });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("twiller:focus-composer"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const clearReplyTarget = () => {
    setReplyTarget(null);
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 z-10">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">{t("feed.home")}</h1>
        </div>

        <Tabs
          value={timelineTab}
          onValueChange={(value) => {
            const next = value === "following" ? "following" : "foryou";
            setTimelineTab(next);
            setActiveHashtag("");
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 bg-transparent border-b border-gray-800 rounded-none h-auto">
            <TabsTrigger
              value="foryou"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-1 data-[state=active]:border-blue-100 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold transition-colors duration-150"
            >
              {t("feed.forYou")}
            </TabsTrigger>
            <TabsTrigger
              value="following"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-1 data-[state=active]:border-blue-100 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold transition-colors duration-150"
            >
              {t("feed.following")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {activeHashtag && (
        <div className="sticky top-14 z-10 border-b border-gray-800 bg-black/90 px-4 py-2 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-300">#{activeHashtag}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
              onClick={() => setActiveHashtag("")}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
      {showNewTweets && (
        <div className="sticky top-20 z-10 py-3">
          <div className="mx-auto w-full max-w-[620px] px-3 sm:px-4">
            <button
              type="button"
              onClick={handleShowNewTweets}
              className="h-11 w-full rounded-full bg-blue-500/90 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
            >
              {pendingTweets.length} new tweet
              {pendingTweets.length > 1 ? "s" : ""} available
            </button>
          </div>
        </div>
      )}
      <div className="sticky top-20 z-10 bg-black/90 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[620px] px-3 sm:px-4">
          <TweetComposer
            onTweetPosted={handlenewtweet}
            replyToTweetId={replyTarget?.tweetId || null}
            replyToDisplayName={replyTarget?.displayName || ""}
            onClearReply={clearReplyTarget}
          />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[620px] overflow-x-hidden px-3 pb-4 sm:px-4">
        {loading ? (
          <TweetSkeleton count={3} />
        ) : error ? (
          <Card className="my-3 w-full border-gray-800 bg-[#0f1419] py-0">
            <CardContent className="py-12 text-center text-gray-400">
              {error}
            </CardContent>
          </Card>
        ) : (
          tweets.map((tweet: any) => (
            <TweetCard
              key={tweet._id}
              tweet={tweet}
              onHashtagClick={handleHashtagClick}
              onReply={handleReply}
            />
          ))
        )}
        {isLoadingMore && <TweetSkeleton count={1} />}
        <div ref={loadMoreRef} className="h-6" />
      </div>
    </div>
  );
};

export default Feed;
