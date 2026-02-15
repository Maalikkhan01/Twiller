"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Paperclip, Send, Plus, X } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import axiosInstance from "@/lib/axiosInstance";
import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "./loading-spinner";

const MAX_DM_MEDIA_BYTES = 5 * 1024 * 1024;

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const formatTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatRelative = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d`;
};

export default function MessagesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<any[]>([]);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaPreview, setMediaPreview] = useState("");
  const [isMediaUploading, setIsMediaUploading] = useState(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "success" | "error" | "info";
  } | null>(null);
  const mediaPreviewRef = useRef<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 2500);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    return () => {
      if (mediaPreviewRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreviewRef.current);
      }
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user?._id) return;
    setIsConversationLoading(true);
    try {
      const res = await axiosInstance.get("/api/v2/messages/conversations");
      const list = Array.isArray(res.data) ? res.data : [];
      setConversations(list);
      if (list.length && !activeConversationId) {
        setActiveConversationId(list[0]._id);
      }
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error, "Unable to load conversations."),
        tone: "error",
      });
    } finally {
      setIsConversationLoading(false);
    }
  }, [activeConversationId, user?._id]);

  const fetchMessages = useCallback(async () => {
    if (!activeConversationId) return;
    setIsMessagesLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/v2/messages/conversations/${activeConversationId}/messages`,
      );
      const list = Array.isArray(res.data) ? [...res.data].reverse() : [];
      setMessages(list);
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error, "Unable to load messages."),
        tone: "error",
      });
    } finally {
      setIsMessagesLoading(false);
    }
  }, [activeConversationId]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!activeConversationId) return;
    void fetchMessages();
  }, [activeConversationId, fetchMessages]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((conversation) => {
      const title = String(conversation.title || "").toLowerCase();
      const preview = String(conversation.lastMessagePreview || "").toLowerCase();
      const participantText = Array.isArray(conversation.participants)
        ? conversation.participants
            .map((participant: any) =>
              `${participant?.displayName || ""} ${participant?.username || ""}`,
            )
            .join(" ")
            .toLowerCase()
        : "";
      return title.includes(q) || preview.includes(q) || participantText.includes(q);
    });
  }, [conversations, search]);

  const getConversationLabel = (conversation: any) => {
    if (!conversation) return "Conversation";
    if (conversation.title) return conversation.title;

    const participants = Array.isArray(conversation.participants)
      ? conversation.participants
      : [];
    const other = participants.find(
      (participant: any) => String(participant?._id) !== String(user?._id),
    );
    return (
      other?.displayName ||
      other?.username ||
      conversation.type ||
      "Conversation"
    );
  };

  const createConversation = async () => {
    const targetId = recipientId.trim();
    if (!targetId || isCreatingConversation) return;
    setIsCreatingConversation(true);
    try {
      const res = await axiosInstance.post("/api/v2/messages/conversations", {
        participantIds: [targetId],
      });
      const created = res.data;
      setConversations((prev) => {
        const exists = prev.some((item) => item._id === created?._id);
        if (exists) {
          return prev.map((item) => (item._id === created._id ? created : item));
        }
        return [created, ...prev];
      });
      setActiveConversationId(created?._id || "");
      setRecipientId("");
      setFeedback({ message: "Conversation ready.", tone: "success" });
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error, "Unable to create conversation."),
        tone: "error",
      });
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleMediaUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setFeedback({ message: "Only images are supported in DM upload.", tone: "error" });
      event.target.value = "";
      return;
    }
    if (selected.size > MAX_DM_MEDIA_BYTES) {
      setFeedback({ message: "DM media must be 5MB or less.", tone: "error" });
      event.target.value = "";
      return;
    }

    setIsMediaUploading(true);
    setMediaUploadProgress(0);
    try {
      if (mediaPreviewRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreviewRef.current);
      }
      const preview = URL.createObjectURL(selected);
      mediaPreviewRef.current = preview;
      setMediaPreview(preview);

      const formData = new FormData();
      formData.set("image", selected);
      const res = await axiosInstance.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          setMediaUploadProgress(
            Math.round((progressEvent.loaded / progressEvent.total) * 100),
          );
        },
      });
      const uploadedUrl = String(res.data?.url || "");
      if (!uploadedUrl) {
        throw new Error("Upload URL missing");
      }
      setMediaUrl(uploadedUrl);
      setFeedback({ message: "Media uploaded.", tone: "success" });
    } catch (error) {
      setMediaUrl("");
      setMediaPreview("");
      setFeedback({
        message: getErrorMessage(error, "Unable to upload media."),
        tone: "error",
      });
    } finally {
      event.target.value = "";
      setIsMediaUploading(false);
      setMediaUploadProgress(0);
    }
  };

  const clearMedia = () => {
    setMediaUrl("");
    setMediaPreview("");
    if (mediaPreviewRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(mediaPreviewRef.current);
    }
    mediaPreviewRef.current = null;
  };

  const sendMessage = async () => {
    if (!activeConversationId || isSendingMessage) return;
    const trimmed = messageInput.trim();
    if (!trimmed && !mediaUrl) {
      setFeedback({ message: "Type a message or attach media.", tone: "error" });
      return;
    }

    setIsSendingMessage(true);
    try {
      const payload = {
        content: trimmed,
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaUrl ? "image" : "none",
      };
      const res = await axiosInstance.post(
        `/api/v2/messages/conversations/${activeConversationId}/messages`,
        payload,
      );
      const created = res.data;
      setMessages((prev) => [...prev, created]);
      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation._id !== activeConversationId) return conversation;
          return {
            ...conversation,
            lastMessageAt: created?.createdAt || new Date().toISOString(),
            lastMessagePreview: trimmed || "Media",
          };
        }),
      );
      setMessageInput("");
      clearMedia();
      setFeedback({ message: "Message sent.", tone: "success" });
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error, "Unable to send message."),
        tone: "error",
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const activeConversation = conversations.find(
    (conversation) => conversation._id === activeConversationId,
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-x-hidden">
      <aside className="w-full border-r border-gray-800 lg:w-80">
        <div className="sticky top-0 border-b border-gray-800 bg-black/90 p-4 backdrop-blur-md">
          <h1 className="text-xl font-bold text-white">Messages</h1>
          <div className="relative mt-4">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Search messages"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-full border-gray-800 bg-black pl-10 text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-800">
          {isConversationLoading ? (
            <div className="p-6 text-sm text-gray-400">Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-sm text-gray-400">No conversations yet.</div>
          ) : (
            filteredConversations.map((conversation) => (
              <button
                key={conversation._id}
                onClick={() => setActiveConversationId(conversation._id)}
                className={`w-full p-4 text-left transition-colors ${
                  activeConversationId === conversation._id
                    ? "bg-gray-950/60"
                    : "hover:bg-gray-950/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-white">
                    {getConversationLabel(conversation)}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatRelative(conversation.lastMessageAt)}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-gray-500">
                  {conversation.lastMessagePreview || "No messages yet"}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-[420px] flex-1 flex-col">
        <div className="border-b border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                {activeConversation ? getConversationLabel(activeConversation) : "Start a chat"}
              </h2>
              {activeConversation?.lastMessageAt && (
                <p className="text-xs text-gray-500">
                  Last activity {formatTime(activeConversation.lastMessageAt)}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-full px-4"
              onClick={() => setActiveConversationId("")}
            >
              <Plus className="mr-1 h-4 w-4" />
              New
            </Button>
          </div>
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

        {!activeConversationId ? (
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <Card className="w-full max-w-md border-gray-800 bg-black py-0">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white">Create conversation</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Enter a user ID to start a direct conversation.
                </p>
                <Input
                  className="mt-4 border-gray-700 bg-black text-white"
                  placeholder="Recipient user id"
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                />
                <Button
                  type="button"
                  className="mt-4 h-11 w-full rounded-full bg-sky-500 text-white hover:bg-sky-600"
                  onClick={() => void createConversation()}
                  disabled={!recipientId.trim() || isCreatingConversation}
                >
                  {isCreatingConversation ? (
                    <span className="inline-flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Creating
                    </span>
                  ) : (
                    "Start conversation"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {isMessagesLoading ? (
                <div className="text-sm text-gray-400">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-gray-400">No messages in this conversation yet.</div>
              ) : (
                messages.map((message) => {
                  const mine = String(message?.sender?._id) === String(user?._id);
                  return (
                    <div
                      key={message._id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? "bg-sky-500 text-white"
                            : "bg-gray-900 text-gray-100"
                        }`}
                      >
                        {message.mediaUrl && (
                          <img
                            src={message.mediaUrl}
                            alt="Message media"
                            className="mb-2 aspect-square w-full max-w-[220px] rounded-xl object-cover"
                          />
                        )}
                        {message.content && (
                          <p className="break-words whitespace-pre-wrap">{message.content}</p>
                        )}
                        <p
                          className={`mt-1 text-[10px] ${
                            mine ? "text-sky-100" : "text-gray-400"
                          }`}
                        >
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-gray-800 px-4 py-3">
              {mediaPreview && (
                <div className="relative mb-3 max-w-[220px] overflow-hidden rounded-xl border border-gray-800">
                  <img
                    src={mediaPreview}
                    alt="Media preview"
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {isMediaUploading && (
                <p className="mb-2 text-xs text-blue-300">
                  Uploading media... {mediaUploadProgress}%
                </p>
              )}

              <div className="flex items-end gap-2">
                <label
                  data-qa="dm-media-upload"
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                    isMediaUploading || isSendingMessage
                      ? "cursor-not-allowed border-gray-800 bg-gray-900 text-gray-500"
                      : "cursor-pointer border-gray-700 bg-black text-white hover:bg-gray-900"
                  }`}
                >
                  <Paperclip className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleMediaUpload(event);
                    }}
                    disabled={isMediaUploading || isSendingMessage}
                  />
                </label>
                <Input
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value.slice(0, 4000))}
                  placeholder="Type a message"
                  className="h-11 flex-1 border-gray-700 bg-black text-white"
                />
                <Button
                  type="button"
                  data-qa="dm-send-button"
                  onClick={() => void sendMessage()}
                  disabled={isSendingMessage || (!messageInput.trim() && !mediaUrl)}
                  className="h-11 min-w-[92px] rounded-full bg-sky-500 px-4 font-semibold text-white hover:bg-sky-600 disabled:bg-gray-700 disabled:text-gray-400"
                >
                  {isSendingMessage ? (
                    <span className="inline-flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Send
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Send
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
