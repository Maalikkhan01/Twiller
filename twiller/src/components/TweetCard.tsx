"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  MoreHorizontal,
  Bookmark,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import LoadingSpinner from "./loading-spinner";

const asUserId = (value: any) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return "";
};

const formatNumber = (num?: number) => {
  const safeNumber = Number.isFinite(num) ? (num as number) : 0;
  if (safeNumber >= 1000000) {
    return `${(safeNumber / 1000000).toFixed(1)}M`;
  }
  if (safeNumber >= 1000) {
    return `${(safeNumber / 1000).toFixed(1)}K`;
  }
  return safeNumber.toString();
};

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const ENTITY_REGEX = /(https?:\/\/[^\s]+|#[a-zA-Z0-9_]+|@[a-zA-Z0-9_.]+)/g;

type TweetCardProps = {
  tweet: any;
  onBookmarkChange?: (tweetId: string, isBookmarked: boolean) => void;
  onHashtagClick?: (hashtag: string) => void;
  onReply?: (tweetId: string, displayName: string) => void;
};

export default function TweetCard({
  tweet,
  onBookmarkChange,
  onHashtagClick,
  onReply,
}: TweetCardProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [tweetstate, setTweetState] = useState(tweet);
  const [isBookmarked, setIsBookmarked] = useState(Boolean(tweet?.isBookmarked));
  const [isVotingPoll, setIsVotingPoll] = useState(false);
  const [showRetweetConfirm, setShowRetweetConfirm] = useState(false);
  const [pending, setPending] = useState({
    like: false,
    retweet: false,
    share: false,
    bookmark: false,
  });
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    setTweetState(tweet);
    setIsBookmarked(Boolean(tweet?.isBookmarked));
  }, [tweet]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 2200);
    return () => clearTimeout(timer);
  }, [feedback]);

  const setPendingFlag = (flag: keyof typeof pending, value: boolean) => {
    setPending((prev) => ({ ...prev, [flag]: value }));
  };

  const likeTweet = async (tweetId: string) => {
    if (!user?._id || pending.like) return;
    const previous = tweetstate;
    const likedBy = Array.isArray(previous.likedBy) ? previous.likedBy : [];
    const normalizedLikedBy = likedBy.map(asUserId).filter(Boolean);
    const hasLiked = normalizedLikedBy.includes(user._id);
    const nextLikes = Math.max(0, (previous.likes || 0) + (hasLiked ? -1 : 1));
    const nextLikedBy = hasLiked
      ? normalizedLikedBy.filter((id: string) => id !== user._id)
      : [...normalizedLikedBy, user._id];

    setPendingFlag("like", true);
    setTweetState({ ...previous, likes: nextLikes, likedBy: nextLikedBy });

    try {
      let response;
      if (hasLiked) {
        response = await axiosInstance.post(`/api/v2/posts/${tweetId}/like`);
      } else {
        try {
          response = await axiosInstance.post(`/like/${tweetId}`);
        } catch {
          response = await axiosInstance.post(`/api/v2/posts/${tweetId}/like`);
        }
      }

      const nextPost = response.data?.post || response.data;
      if (nextPost?._id) {
        setTweetState(nextPost);
      }
      setFeedback({ message: "Like updated.", tone: "success" });
    } catch (error) {
      setTweetState(previous);
      setFeedback({
        message: getErrorMessage(error, "Unable to update like."),
        tone: "error",
      });
    } finally {
      setPendingFlag("like", false);
    }
  };

  const retweetTweet = async (tweetId: string) => {
    if (!user?._id || pending.retweet) return;
    const previous = tweetstate;
    const retweetedBy = Array.isArray(previous.retweetedBy)
      ? previous.retweetedBy
      : [];
    const normalizedRetweetedBy = retweetedBy.map(asUserId).filter(Boolean);
    const hasRetweeted = normalizedRetweetedBy.includes(user._id);
    const nextRetweets = Math.max(
      0,
      (previous.retweets || 0) + (hasRetweeted ? -1 : 1),
    );
    const nextRetweetedBy = hasRetweeted
      ? normalizedRetweetedBy.filter((id: string) => id !== user._id)
      : [...normalizedRetweetedBy, user._id];

    setPendingFlag("retweet", true);
    setTweetState({
      ...previous,
      retweets: nextRetweets,
      retweetedBy: nextRetweetedBy,
    });

    try {
      let response;
      if (hasRetweeted) {
        response = await axiosInstance.post(`/api/v2/posts/${tweetId}/retweet`);
      } else {
        try {
          response = await axiosInstance.post(`/retweet/${tweetId}`);
        } catch {
          response = await axiosInstance.post(`/api/v2/posts/${tweetId}/retweet`);
        }
      }

      const payload = response.data;
      if (payload?.post?._id) {
        setTweetState(payload.post);
      } else if (payload?._id) {
        setTweetState(payload);
      }
      setFeedback({
        message: hasRetweeted ? "Retweet removed." : "Retweeted.",
        tone: "success",
      });
    } catch (error) {
      setTweetState(previous);
      setFeedback({
        message: getErrorMessage(error, "Unable to update retweet."),
        tone: "error",
      });
    } finally {
      setPendingFlag("retweet", false);
    }
  };

  const toggleBookmark = async (tweetId: string) => {
    if (!user?._id || pending.bookmark) return;
    const previous = isBookmarked;
    const next = !previous;
    setPendingFlag("bookmark", true);
    setIsBookmarked(next);
    try {
      if (next) {
        await axiosInstance.post(`/bookmarks/${tweetId}`);
      } else {
        await axiosInstance.delete(`/bookmarks/${tweetId}`);
      }
      onBookmarkChange?.(tweetId, next);
      setFeedback({
        message: next ? "Saved to bookmarks." : "Removed from bookmarks.",
        tone: "success",
      });
    } catch (error) {
      setIsBookmarked(previous);
      onBookmarkChange?.(tweetId, previous);
      setFeedback({
        message: getErrorMessage(error, "Unable to update bookmark."),
        tone: "error",
      });
    } finally {
      setPendingFlag("bookmark", false);
    }
  };

  const votePoll = async (optionId: string) => {
    if (!user?._id || !tweetstate?._id || !optionId || isVotingPoll) return;
    setIsVotingPoll(true);
    try {
      const res = await axiosInstance.post(
        `/api/v2/posts/${tweetstate._id}/poll/vote`,
        { optionId },
      );
      setTweetState(res.data);
      setFeedback({ message: "Vote submitted.", tone: "success" });
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error, "Unable to submit vote."),
        tone: "error",
      });
    } finally {
      setIsVotingPoll(false);
    }
  };

  const shareTweet = async () => {
    if (!tweetstate?._id || pending.share) return;
    setPendingFlag("share", true);
    try {
      const res = await axiosInstance.post(`/api/v2/posts/${tweetstate._id}/share`);
      const shareUrl =
        res.data?.shareUrl ||
        `${window.location.origin}/#tweet-${tweetstate._id}`;

      if (navigator.share) {
        await navigator.share({
          title: "Twiller post",
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setFeedback({ message: "Share link ready.", tone: "success" });
    } catch (error) {
      try {
        const fallback = `${window.location.origin}/#tweet-${tweetstate._id}`;
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(fallback);
          setFeedback({ message: "Share link copied.", tone: "success" });
        } else {
          throw error;
        }
      } catch (fallbackError) {
        setFeedback({
          message: getErrorMessage(fallbackError, "Unable to share this post."),
          tone: "error",
        });
      }
    } finally {
      setPendingFlag("share", false);
    }
  };

  const renderContent = (text: string) => {
    const parts = text.split(ENTITY_REGEX);
    return parts.map((part, index) => {
      if (!part) {
        return null;
      }

      if (/^#[a-zA-Z0-9_]+$/.test(part)) {
        const hashtag = part.replace("#", "").toLowerCase();
        return (
          <button
            key={`tag-${index}`}
            type="button"
            className="text-blue-400 hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onHashtagClick?.(hashtag);
            }}
          >
            {part}
          </button>
        );
      }

      if (/^@[a-zA-Z0-9_.]+$/.test(part)) {
        return (
          <span key={`mention-${index}`} className="text-blue-300">
            {part}
          </span>
        );
      }

      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={`url-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="break-all text-blue-400 hover:underline"
          >
            {part}
          </a>
        );
      }

      return <span key={`text-${index}`}>{part}</span>;
    });
  };

  const isLiked = useMemo(() => {
    const ids = (tweetstate?.likedBy || []).map(asUserId);
    return ids.includes(user?._id || "");
  }, [tweetstate?.likedBy, user?._id]);

  const isRetweet = useMemo(() => {
    const ids = (tweetstate?.retweetedBy || []).map(asUserId);
    return ids.includes(user?._id || "");
  }, [tweetstate?.retweetedBy, user?._id]);

  const pollHasVoted = useMemo(() => {
    if (!tweetstate?.poll || !user?._id) return false;
    return (tweetstate.poll.options || []).some((option: any) =>
      (option.voters || []).map(asUserId).includes(user._id),
    );
  }, [tweetstate?.poll, user?._id]);

  const pollExpired = useMemo(() => {
    const expiresAt = tweetstate?.poll?.expiresAt;
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  }, [tweetstate?.poll?.expiresAt]);

  const author = tweetstate.author || {};
  const avatarSeed = author.username || author.displayName || "user";
  const avatarUrl =
    author.avatar ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
      avatarSeed,
    )}`;

  const referencedPost =
    tweetstate.isRetweet && tweetstate.retweetOf
      ? tweetstate.retweetOf
      : tweetstate.quoteTweetId;
  const depthPadding = Math.min(Number(tweetstate.depth || 0), 4) * 8;

  const handleReplyClick = () => {
    if (!tweetstate?._id) return;
    onReply?.(
      tweetstate._id,
      author.displayName || `@${author.username || t("tweet.userFallback")}`,
    );
    setFeedback({ message: "Reply composer focused.", tone: "info" });
  };

  const commentsCount = tweetstate.comments ?? tweetstate.replies ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="mx-auto w-full max-w-[620px] cursor-pointer overflow-hidden"
      id={`tweet-${tweetstate._id}`}
      style={{ paddingLeft: depthPadding ? `${depthPadding}px` : undefined }}
    >
      <Card className="my-3 w-full max-w-full overflow-hidden rounded-2xl border border-gray-800 bg-[#0f1419] py-0 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-colors duration-150 hover:bg-[#131a20]">
        <CardContent className="p-4">
          <div className="flex min-w-0 space-x-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={avatarUrl} alt={author.displayName} />
              <AvatarFallback>
                {author.displayName?.[0] || t("tweet.userFallback")[0]}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-base font-semibold leading-6 text-white">
                  {author.displayName || t("tweet.userFallback")}
                </span>
                {author.verified && (
                  <div className="rounded-full bg-blue-500 p-0.5">
                    <svg
                      className="h-4 w-4 fill-current text-white"
                      viewBox="0 0 20 20"
                    >
                      <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                    </svg>
                  </div>
                )}
                <span className="truncate text-sm font-normal text-gray-400">
                  @{author.username || t("tweet.handleFallback")}
                </span>
                {tweetstate.parentTweetId && (
                  <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300">
                    Thread reply
                  </span>
                )}
                <span className="text-sm font-normal text-gray-500">|</span>
                <span className="text-sm font-normal text-gray-500">
                  {tweetstate.timestamp &&
                    new Date(tweetstate.timestamp).toLocaleDateString(
                      i18n.language,
                      {
                        month: "long",
                        year: "numeric",
                      },
                    )}
                </span>
                <div className="ml-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-11 w-11 rounded-full p-0 hover:bg-gray-900"
                  >
                    <MoreHorizontal className="h-5 w-5 text-gray-500" />
                  </Button>
                </div>
              </div>

              <div className="text-wrap-anywhere mb-3 overflow-hidden break-words text-[15px] leading-[1.5] text-white">
                {renderContent(tweetstate.content || "")}
              </div>

              {Array.isArray(tweetstate.linkPreviews) &&
                tweetstate.linkPreviews.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {tweetstate.linkPreviews.map((preview: any, index: number) => (
                      <a
                        key={`preview-${index}`}
                        href={preview.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="block rounded-xl border border-gray-800 bg-gray-950/60 p-3 hover:border-gray-700"
                      >
                        <p className="text-sm font-semibold text-white">
                          {preview.title || preview.url}
                        </p>
                        {preview.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                            {preview.description}
                          </p>
                        )}
                      </a>
                    ))}
                  </div>
                )}

              {tweetstate.poll?.options?.length > 0 && (
                <div className="mb-3 rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                  <p className="text-sm font-semibold text-white">
                    {tweetstate.poll.question}
                  </p>
                  <div className="mt-3 space-y-2">
                    {tweetstate.poll.options.map((option: any) => {
                      const optionVoters = (option.voters || []).map(asUserId);
                      const selected = optionVoters.includes(user?._id || "");
                      return (
                        <button
                          key={option._id}
                          type="button"
                          disabled={isVotingPoll || pollExpired || pollHasVoted}
                          onClick={(event) => {
                            event.stopPropagation();
                            void votePoll(option._id);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                            selected
                              ? "border-blue-500/60 bg-blue-500/10 text-blue-200"
                              : "border-gray-700 bg-black text-white hover:border-gray-500"
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          <span>{option.text}</span>
                          <span className="text-xs text-gray-400">
                            {formatNumber(option.voteCount)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    {formatNumber(tweetstate.poll.totalVotes)} votes
                    {pollExpired ? " | Poll ended" : ""}
                  </p>
                </div>
              )}

              {tweetstate.audioUrl && (
                <div className="mb-3">
                  <audio
                    controls
                    preload="metadata"
                    className="w-full"
                    src={tweetstate.audioUrl}
                  >
                    {t("tweet.audio.noSupport")}
                  </audio>
                </div>
              )}

              {tweetstate.gifUrl && (
                <div className="mb-3 overflow-hidden rounded-2xl">
                  <img
                    src={tweetstate.gifUrl}
                    alt="GIF"
                    className="aspect-square w-full object-cover"
                  />
                </div>
              )}

              {tweetstate.image && (
                <div className="mb-3 overflow-hidden rounded-2xl">
                  <img
                    src={tweetstate.image}
                    alt={t("tweet.imageAlt")}
                    className="aspect-square w-full object-cover"
                  />
                </div>
              )}

              {referencedPost && typeof referencedPost === "object" && (
                <div className="mb-3 rounded-xl border border-gray-800 bg-black/60 p-3">
                  <p className="text-xs text-gray-400 break-words">
                    @{referencedPost.author?.username || "tweet"} | referenced post
                  </p>
                  <p className="mt-1 break-words text-sm text-white">
                    {referencedPost.content || "Shared post"}
                  </p>
                </div>
              )}

              <div className="grid w-full grid-cols-5 gap-1 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-qa="tweet-reply-button"
                  className="group inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-full px-1 text-gray-500 transition-colors duration-150 hover:bg-blue-900/20 hover:text-blue-400 sm:gap-2 sm:px-2 disabled:opacity-70"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleReplyClick();
                  }}
                >
                  <MessageCircle className="h-5 w-5 group-hover:text-blue-400" />
                  <span className="text-sm font-normal leading-none">
                    {formatNumber(commentsCount)}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-qa="tweet-retweet-button"
                  disabled={pending.retweet}
                  className={`group inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-full px-1 transition-colors duration-150 hover:bg-green-900/20 sm:gap-2 sm:px-2 ${
                    isRetweet
                      ? "text-green-400"
                      : "text-gray-500 hover:text-green-400"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowRetweetConfirm(true);
                  }}
                >
                  {pending.retweet ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Repeat2
                      className={`h-5 w-5 ${
                        isRetweet
                          ? "text-green-400"
                          : "group-hover:text-green-400"
                      }`}
                    />
                  )}
                  <span className="text-sm font-normal leading-none">
                    {formatNumber(tweetstate.retweets)}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-qa="tweet-like-button"
                  disabled={pending.like}
                  className={`group inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-full px-1 transition-colors duration-150 hover:bg-red-900/20 sm:gap-2 sm:px-2 ${
                    isLiked
                      ? "text-red-500"
                      : "text-gray-500 hover:text-red-400"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void likeTweet(tweetstate._id);
                  }}
                >
                  {pending.like ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <motion.span
                      animate={{ scale: isLiked ? 1.15 : 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 18,
                      }}
                    >
                      <Heart
                        className={`h-5 w-5 ${
                          isLiked
                            ? "fill-current text-red-500"
                            : "group-hover:text-red-400"
                        }`}
                      />
                    </motion.span>
                  )}
                  <span className="text-sm font-normal leading-none">
                    {formatNumber(tweetstate.likes)}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-qa="tweet-share-button"
                  disabled={pending.share}
                  className="group inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-full px-1 text-gray-500 transition-colors duration-150 hover:bg-blue-900/20 hover:text-blue-400 sm:px-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    void shareTweet();
                  }}
                >
                  {pending.share ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Share className="h-5 w-5 group-hover:text-blue-400" />
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-qa="tweet-bookmark-button"
                  disabled={pending.bookmark}
                  className={`group inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-full px-1 transition-colors duration-150 hover:bg-yellow-900/20 sm:px-2 ${
                    isBookmarked
                      ? "text-yellow-400"
                      : "text-gray-500 hover:text-yellow-300"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleBookmark(tweetstate._id);
                  }}
                >
                  {pending.bookmark ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Bookmark
                      className={`h-5 w-5 ${
                        isBookmarked
                          ? "fill-current text-yellow-400"
                          : "group-hover:text-yellow-300"
                      }`}
                    />
                  )}
                </Button>
              </div>

              {showRetweetConfirm && (
                <div className="mt-3 rounded-xl border border-gray-800 bg-black/70 p-3">
                  <p className="text-sm text-white">
                    {isRetweet ? "Remove retweet?" : "Retweet this post?"}
                  </p>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowRetweetConfirm(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      data-qa="tweet-retweet-confirm"
                      disabled={pending.retweet}
                      className="h-9 px-3"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowRetweetConfirm(false);
                        void retweetTweet(tweetstate._id);
                      }}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              )}

              {feedback && (
                <p
                  className={`mt-2 text-xs ${
                    feedback.tone === "error"
                      ? "text-red-400"
                      : feedback.tone === "info"
                        ? "text-blue-300"
                        : "text-emerald-300"
                  }`}
                >
                  {feedback.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
