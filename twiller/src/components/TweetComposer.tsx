import { useAuth } from "@/context/AuthContext";
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import {
  Image,
  Smile,
  Calendar,
  MapPin,
  BarChart3,
  Globe,
  Mic,
  Square,
  Upload,
  X,
} from "lucide-react";
import { Separator } from "./ui/separator";
import axiosInstance from "@/lib/axiosInstance";
import { Input } from "./ui/input";
import { useTranslation } from "react-i18next";
import LoadingSpinner from "./loading-spinner";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_DURATION_SECONDS = 5 * 60;
const MAX_TWEET_LENGTH = 280;

type TweetComposerProps = {
  onTweetPosted: (tweet: any) => void;
  replyToTweetId?: string | null;
  replyToDisplayName?: string;
  onClearReply?: () => void;
};

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const getIstMinutesOfDay = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0,
  );

  return hour * 60 + minute;
};

const isInsideAudioWindow = () => {
  const minutes = getIstMinutesOfDay();
  return minutes >= 14 * 60 && minutes <= 19 * 60;
};

const readAudioDuration = (file: File) =>
  new Promise<number>((resolve, reject) => {
    const mediaElement = document.createElement("audio");
    const blobUrl = URL.createObjectURL(file);

    mediaElement.preload = "metadata";
    mediaElement.onloadedmetadata = () => {
      const duration = mediaElement.duration;
      URL.revokeObjectURL(blobUrl);
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Unable to validate audio duration."));
        return;
      }
      resolve(duration);
    };
    mediaElement.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("Unable to read selected audio file."));
    };
    mediaElement.src = blobUrl;
  });

const TweetComposer = ({
  onTweetPosted,
  replyToTweetId = null,
  replyToDisplayName = "",
  onClearReply,
}: TweetComposerProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageurl, setimageurl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [showGifInput, setShowGifInput] = useState(false);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [isMentionLoading, setIsMentionLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioMessage, setAudioMessage] = useState("");
  const [audioError, setAudioError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const [isAudioPosting, setIsAudioPosting] = useState(false);
  const [isAudioProcessing, setIsAudioProcessing] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isWithinAudioWindow, setIsWithinAudioWindow] = useState(
    isInsideAudioWindow(),
  );
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const audioPreviewUrlRef = useRef<string | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);

  const maxLength = MAX_TWEET_LENGTH;

  useEffect(() => {
    const timer = setInterval(() => {
      setIsWithinAudioWindow(isInsideAudioWindow());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (previewUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      if (audioPreviewUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(audioPreviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const focusComposer = () => {
      composerInputRef.current?.focus();
      composerInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    };

    window.addEventListener("twiller:focus-composer", focusComposer);
    return () => {
      window.removeEventListener("twiller:focus-composer", focusComposer);
    };
  }, []);

  const setPreviewSource = (source: string) => {
    if (previewUrlRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = source;
    setImagePreview(source);
  };

  const clearImage = () => {
    if (previewUrlRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = null;
    setImagePreview("");
    setimageurl("");
    setImageUploadProgress(0);
  };

  useEffect(() => {
    if (audioPreviewUrlRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(audioPreviewUrlRef.current);
    }
    if (!audioFile) {
      audioPreviewUrlRef.current = null;
      setAudioPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(audioFile);
    audioPreviewUrlRef.current = url;
    setAudioPreviewUrl(url);
  }, [audioFile]);

  useEffect(() => {
    const mentionMatch = content.match(/(?:^|\s)@([a-zA-Z0-9_.]{1,32})$/);
    const query = mentionMatch ? mentionMatch[1] : "";
    setMentionQuery(query);

    if (!query || !user?._id) {
      setMentionSuggestions([]);
      setIsMentionLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsMentionLoading(true);
      try {
        const res = await axiosInstance.get("/api/v2/users/mentions/suggest", {
          params: { q: query, limit: 6 },
        });
        setMentionSuggestions(Array.isArray(res.data) ? res.data : []);
      } catch {
        setMentionSuggestions([]);
      } finally {
        setIsMentionLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [content, user?._id]);

  const showToast = (message: string, tone: "success" | "error") => {
    setToast({ message, tone });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const translateAudioError = (message: string) => {
    switch (message) {
      case "Unable to validate audio duration.":
        return t("tweet.audio.durationReadError");
      case "Unable to read selected audio file.":
        return t("tweet.audio.readError");
      default:
        return message;
    }
  };

  const handleMentionSelect = (username: string) => {
    setContent((prev) => {
      if (/(^|\s)@([a-zA-Z0-9_.]{1,32})$/.test(prev)) {
        return prev.replace(/(^|\s)@([a-zA-Z0-9_.]{1,32})$/, `$1@${username} `);
      }
      return `${prev} @${username} `;
    });
    setMentionSuggestions([]);
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((option, idx) => (idx === index ? value : option)));
  };

  const addPollOption = () => {
    setPollOptions((prev) => (prev.length >= 4 ? prev : [...prev, ""]));
  };

  const removePollOption = (index: number) => {
    setPollOptions((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const trimmedContent = content.trim();
    const trimmedGifUrl = gifUrl.trim();
    const normalizedPollOptions = pollOptions
      .map((option) => option.trim())
      .filter(Boolean);

    if (pollEnabled) {
      if (!pollQuestion.trim()) {
        showToast("Poll question is required.", "error");
        return;
      }
      if (normalizedPollOptions.length < 2) {
        showToast("Poll requires at least 2 options.", "error");
        return;
      }
    }

    const hasPostContent = Boolean(
      trimmedContent ||
        imageurl ||
        trimmedGifUrl ||
        (pollEnabled && pollQuestion.trim() && normalizedPollOptions.length >= 2),
    );

    if (trimmedContent.length > maxLength) {
      showToast("Tweet exceeds 280 characters.", "error");
      return;
    }
    if (!hasPostContent) {
      showToast("Add text or media before posting.", "error");
      return;
    }
    if (!user || isLoading) return;
    setIsLoading(true);
    try {
      const tweetdata: any = {
        content: trimmedContent,
      };
      if (imageurl) {
        tweetdata.image = imageurl;
      }
      if (trimmedGifUrl) {
        tweetdata.gifUrl = trimmedGifUrl;
      }
      if (replyToTweetId) {
        tweetdata.parentTweetId = replyToTweetId;
      }
      if (pollEnabled) {
        tweetdata.poll = {
          question: pollQuestion.trim(),
          options: normalizedPollOptions,
        };
      }

      const isLegacyCompatible =
        !tweetdata.gifUrl && !tweetdata.poll && !tweetdata.parentTweetId;

      let res;
      if (isLegacyCompatible) {
        try {
          res = await axiosInstance.post("/post", {
            content: tweetdata.content,
            image: tweetdata.image || "",
          });
        } catch {
          res = await axiosInstance.post("/api/v2/posts", tweetdata);
        }
      } else {
        res = await axiosInstance.post("/api/v2/posts", tweetdata);
      }

      onTweetPosted(res.data?.post || res.data);
      setContent("");
      clearImage();
      setGifUrl("");
      setShowGifInput(false);
      setPollEnabled(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setMentionSuggestions([]);
      onClearReply?.();
      showToast("Tweet posted.", "success");
    } catch (error) {
      showToast(getErrorMessage(error, "Unable to post right now. Please try again."), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const validateAndSetAudioFile = async (file: File) => {
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      throw new Error("Audio file size must be 10MB or less.");
    }

    const duration = await readAudioDuration(file);
    if (duration > MAX_AUDIO_DURATION_SECONDS) {
      throw new Error(t("tweet.audio.durationError"));
    }

    setAudioFile(file);
    setAudioDuration(Math.ceil(duration));
    setAudioError("");
    setOtpSent(false);
    setOtpVerified(false);
    setOtp("");
    setAudioMessage(
      t("tweet.audio.ready", {
        name: file.name,
        seconds: Math.ceil(duration),
      }),
    );
  };

  const handleAudioFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!isWithinAudioWindow) {
      setAudioError(t("tweet.audio.windowError"));
      e.target.value = "";
      return;
    }
    if (isAudioProcessing || isAudioPosting || isOtpSending || isOtpVerifying) {
      e.target.value = "";
      return;
    }

    setIsAudioProcessing(true);
    try {
      await validateAndSetAudioFile(selected);
    } catch (error: any) {
      setAudioFile(null);
      setAudioDuration(null);
      setAudioMessage("");
      setAudioError(
        error?.message
          ? translateAudioError(error.message)
          : t("tweet.audio.invalidFile"),
      );
    } finally {
      e.target.value = "";
      setIsAudioProcessing(false);
    }
  };

  const handleStartRecording = async () => {
    if (isRecording) return;
    if (!isWithinAudioWindow) {
      setAudioError(t("tweet.audio.windowError"));
      return;
    }
    if (isAudioProcessing || isAudioPosting || isOtpSending || isOtpVerifying) {
      return;
    }
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setAudioError(t("tweet.audio.recordingNotSupported"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsAudioProcessing(true);
        try {
          const blob = new Blob(recordedChunksRef.current, {
            type: "audio/webm",
          });
          const file = new File([blob], `recording-${Date.now()}.webm`, {
            type: "audio/webm",
          });
          await validateAndSetAudioFile(file);
        } catch (error: any) {
          setAudioFile(null);
          setAudioDuration(null);
          setAudioMessage("");
          setAudioError(
            error?.message
              ? translateAudioError(error.message)
              : t("tweet.audio.useRecordedError"),
          );
        } finally {
          stream.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          setIsAudioProcessing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setAudioMessage(t("tweet.audio.recordingStarted"));
      setAudioError("");
    } catch {
      setAudioError(t("tweet.audio.permissionRequired"));
    }
  };

  const handleStopRecording = () => {
    if (!isRecording) return;
    mediaRecorderRef.current?.stop();
  };

  const handleSendOtp = async () => {
    if (isOtpSending || isOtpVerifying) return;
    if (!audioFile) {
      setAudioError(t("tweet.audio.selectFirst"));
      return;
    }

    if (!isWithinAudioWindow) {
      setAudioError(t("tweet.audio.windowError"));
      return;
    }

    setIsOtpSending(true);
    setAudioError("");
    try {
      const res = await axiosInstance.post("/audio/send-otp");
      setOtpSent(true);
      setOtpVerified(false);
      setAudioMessage(
        res.data?.message || t("tweet.audio.otpSent"),
      );
    } catch (error: any) {
      setAudioError(getErrorMessage(error, t("tweet.audio.otpFailed")));
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (isOtpSending || isOtpVerifying) return;
    if (otp.trim().length !== 6) {
      setAudioError(t("tweet.audio.otpInvalid"));
      return;
    }

    setIsOtpVerifying(true);
    setAudioError("");
    try {
      const res = await axiosInstance.post("/audio/verify-otp", {
        otp: otp.trim(),
      });
      setOtpVerified(true);
      setAudioMessage(res.data?.message || t("tweet.audio.otpVerified"));
    } catch (error: any) {
      setAudioError(getErrorMessage(error, t("tweet.audio.otpVerifyFailed")));
    } finally {
      setIsOtpVerifying(false);
    }
  };

  const handlePostAudioTweet = async () => {
    if (!audioFile || !otpVerified || !isWithinAudioWindow || isAudioPosting) {
      return;
    }

    setIsAudioPosting(true);
    setAudioUploadProgress(0);
    setAudioError("");
    try {
      const audioForm = new FormData();
      audioForm.set("audio", audioFile);
      audioForm.set("content", content.trim() || t("tweet.audio.fallbackContent"));
      if (audioDuration) {
        audioForm.set("audioDuration", String(audioDuration));
      }

      const res = await axiosInstance.post("/audio/tweet", audioForm, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          setAudioUploadProgress(
            Math.round((progressEvent.loaded / progressEvent.total) * 100),
          );
        },
      });

      onTweetPosted(res.data);
      setContent("");
      setAudioFile(null);
      setAudioDuration(null);
      setAudioMessage("");
      setAudioError("");
      setOtp("");
      setOtpSent(false);
      setOtpVerified(false);
      setAudioUploadProgress(0);
      showToast("Audio tweet posted.", "success");
    } catch (error: any) {
      const message = getErrorMessage(error, t("tweet.audio.postFailed"));
      setAudioError(message);
      showToast(message, "error");
    } finally {
      setIsAudioPosting(false);
      setAudioUploadProgress(0);
    }
  };

  const characterCount = content.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount > maxLength * 0.8;
  const validPollOptionsCount = pollOptions
    .map((option) => option.trim())
    .filter(Boolean).length;
  const hasValidPoll =
    pollEnabled && Boolean(pollQuestion.trim()) && validPollOptionsCount >= 2;
  const hasTweetContent = Boolean(content.trim() || imageurl || gifUrl.trim() || hasValidPoll);
  const isOtpBusy = isOtpSending || isOtpVerifying;
  const isAudioWindowClosed = !isWithinAudioWindow;
  const isAudioActionDisabled =
    isAudioProcessing || isAudioPosting || isOtpBusy;
  const disableAudioInput = isAudioWindowClosed || isAudioActionDisabled;
  if (!user) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const image = e.target.files[0];
    if (!image.type.startsWith("image/")) {
      showToast("Only image files are supported.", "error");
      e.target.value = "";
      return;
    }
    if (image.size > MAX_IMAGE_SIZE_BYTES) {
      showToast("Image size must be 5MB or less.", "error");
      e.target.value = "";
      return;
    }

    setIsLoading(true);
    setImageUploadProgress(0);
    const previewUrl = URL.createObjectURL(image);
    setPreviewSource(previewUrl);
    const formdataimg = new FormData();
    formdataimg.set("image", image);
    try {
      const res = await axiosInstance.post("/upload", formdataimg, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          setImageUploadProgress(
            Math.round((progressEvent.loaded / progressEvent.total) * 100),
          );
        },
      });
      const url = res.data.url;
      if (url) {
        setimageurl(url);
        showToast("Image uploaded.", "success");
      }
    } catch (error: any) {
      clearImage();
      showToast(
        getErrorMessage(error, "Image upload failed. Please try again."),
        "error",
      );
    } finally {
      e.target.value = "";
      setImageUploadProgress(0);
      setIsLoading(false);
    }
  };

  return (
    <Card className="my-3 w-full max-w-[620px] overflow-hidden rounded-2xl border border-gray-800 bg-[#0f1419] py-0 shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition-colors duration-150">
      <CardContent className="relative max-w-full overflow-x-hidden p-4">
        {toast && (
          <div
            aria-live="polite"
            className={`absolute right-4 top-4 z-10 rounded-full px-4 py-2 text-xs font-semibold shadow-lg ${
              toast.tone === "success"
                ? "bg-emerald-500/90 text-white"
                : "bg-red-500/90 text-white"
            }`}
          >
            {toast.message}
          </div>
        )}
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage
              src={
                user.avatar ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                  user.username || user.email || user.displayName || "user",
                )}`
              }
              alt={user.displayName}
            />
            <AvatarFallback>{user.displayName[0]}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <form onSubmit={handleSubmit} className="min-w-0 overflow-x-hidden">
              {replyToTweetId && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2">
                  <p className="text-xs text-blue-300">
                    Replying to {replyToDisplayName || "thread"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 rounded-full p-0 text-blue-300 hover:bg-blue-900/40 hover:text-blue-100"
                    onClick={() => onClearReply?.()}
                    aria-label="Clear reply target"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Textarea
                data-qa="composer-input"
                placeholder={t("tweet.placeholder")}
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, maxLength))}
                ref={composerInputRef}
                className="min-w-0 max-w-full break-words border-none bg-transparent text-[17px] leading-7 text-white placeholder:text-gray-500 resize-none min-h-[120px] focus-visible:ring-0 focus-visible:ring-offset-0"
                maxLength={maxLength}
              />

              {(isMentionLoading || mentionSuggestions.length > 0) && mentionQuery && (
                <div className="mt-2 overflow-hidden rounded-xl border border-gray-800 bg-black/95">
                  {isMentionLoading ? (
                    <div className="px-3 py-2 text-xs text-gray-400">
                      Searching users...
                    </div>
                  ) : (
                    mentionSuggestions.map((suggestion) => (
                      <button
                        key={suggestion._id || suggestion.username}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-900"
                        onClick={() => handleMentionSelect(suggestion.username)}
                      >
                        <span className="text-sm text-white">
                          {suggestion.displayName || suggestion.username}
                        </span>
                        <span className="text-xs text-gray-500">
                          @{suggestion.username}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {showGifInput && (
                <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                  <Input
                    placeholder="Paste GIF URL"
                    value={gifUrl}
                    onChange={(e) => setGifUrl(e.target.value)}
                    className="border-gray-700 bg-black text-white"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    GIFs are URL-based and render in tweet cards.
                  </p>
                </div>
              )}

              {pollEnabled && (
                <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                  <p className="text-sm font-semibold text-white">Poll</p>
                  <Input
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Ask a question"
                    className="mt-2 border-gray-700 bg-black text-white"
                    maxLength={280}
                  />
                  <div className="mt-3 space-y-2">
                    {pollOptions.map((option, index) => (
                      <div key={`poll-option-${index}`} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => updatePollOption(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                          className="border-gray-700 bg-black text-white"
                          maxLength={80}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePollOption(index)}
                          disabled={pollOptions.length <= 2}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addPollOption}
                      disabled={pollOptions.length >= 4}
                      className="border-gray-700 bg-black text-white hover:bg-gray-900"
                    >
                      Add option
                    </Button>
                    <span className="text-xs text-gray-500">
                      {validPollOptionsCount}/4 ready
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-4 max-w-full overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {t("tweet.audio.label")}
                    </p>
                    <p className="break-words text-xs text-gray-400">
                      Max 5 minutes | 10MB
                    </p>
                  </div>
                  <div
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                      isWithinAudioWindow
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {isWithinAudioWindow
                      ? t("tweet.audio.windowOpen")
                      : t("tweet.audio.windowClosed")}
                  </div>
                </div>

                {!isWithinAudioWindow && (
                  <div className="mt-3 break-words rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {t("tweet.audio.windowError")}
                  </div>
                )}

                <div className="mt-4 grid w-full grid-cols-3 gap-2 sm:gap-3">
                  <Button
                    type="button"
                    className={`h-11 w-full min-w-0 rounded-full px-2 text-xs sm:text-sm ${
                      isRecording
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-blue-500 hover:bg-blue-600"
                    } text-white disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed`}
                    onClick={() => {
                      if (isRecording) {
                        handleStopRecording();
                      } else {
                        void handleStartRecording();
                      }
                    }}
                    disabled={!isRecording && disableAudioInput}
                  >
                    {isAudioProcessing && !isRecording ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : isRecording ? (
                      <Square className="mr-2 h-4 w-4" />
                    ) : (
                      <Mic className="mr-2 h-4 w-4" />
                    )}
                    <span className="truncate">
                      {isRecording
                        ? t("tweet.audio.stopRecording")
                        : t("tweet.audio.record")}
                    </span>
                  </Button>

                  <label
                    data-qa="composer-audio-upload"
                    className={`inline-flex h-11 w-full min-w-0 items-center justify-center rounded-full border px-2 text-xs sm:text-sm ${
                      disableAudioInput || isRecording
                        ? "cursor-not-allowed border-gray-800 bg-gray-900 text-gray-500"
                        : "cursor-pointer border-gray-700 bg-black text-white hover:bg-gray-900"
                    }`}
                  >
                    {isAudioProcessing && !isRecording ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    <span className="truncate">{t("tweet.audio.upload")}</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        void handleAudioFileUpload(e);
                      }}
                      disabled={disableAudioInput || isRecording}
                    />
                  </label>

                  <Button
                    type="button"
                    data-qa="composer-audio-otp"
                    className="h-11 w-full min-w-0 rounded-full border border-gray-700 bg-black px-2 text-xs text-white hover:bg-gray-900 sm:text-sm disabled:cursor-not-allowed disabled:border-gray-800 disabled:bg-gray-900 disabled:text-gray-500"
                    onClick={() => void handleSendOtp()}
                    disabled={
                      !audioFile ||
                      otpVerified ||
                      isOtpBusy ||
                      disableAudioInput
                    }
                  >
                    {isOtpSending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        <span className="truncate">{t("tweet.audio.sendingOtp")}</span>
                      </>
                    ) : (
                      <span className="truncate">{t("tweet.audio.sendOtp")}</span>
                    )}
                  </Button>
                </div>

                {isAudioPosting && (
                  <p className="mt-2 text-xs text-blue-300">
                    Uploading audio... {audioUploadProgress}%
                  </p>
                )}

                {audioPreviewUrl && (
                  <div className="mt-4">
                    <audio
                      controls
                      preload="metadata"
                      className="w-full"
                      src={audioPreviewUrl}
                    >
                      {t("tweet.audio.noSupport")}
                    </audio>
                  </div>
                )}

                {otpSent && !otpVerified && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      placeholder={t("tweet.audio.enterOtp")}
                      className="max-w-[220px] border-gray-700 bg-black text-white"
                    />
                    <Button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 text-white disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                      onClick={() => void handleVerifyOtp()}
                      disabled={isOtpBusy || otp.trim().length !== 6}
                    >
                      {isOtpVerifying ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          {t("tweet.audio.verifyingOtp")}
                        </>
                      ) : (
                        t("tweet.audio.verifyOtp")
                      )}
                    </Button>
                  </div>
                )}

                {audioFile && (
                  <p className="mt-3 break-all text-xs text-gray-400">
                    {audioFile.name}
                    {audioDuration ? ` (${audioDuration}s)` : ""}
                  </p>
                )}

                {audioMessage && (
                  <p className="mt-2 break-words text-xs text-emerald-300">
                    {audioMessage}
                  </p>
                )}
                {audioError && (
                  <p className="mt-2 break-words text-xs text-red-400">{audioError}</p>
                )}
              </div>

              {(imagePreview || imageurl) && (
                <div className="relative mt-4 overflow-hidden rounded-2xl border border-gray-800">
                  <img
                    src={imagePreview || imageurl}
                    alt={t("tweet.imageAlt")}
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-white hover:bg-black/90"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {gifUrl && (
                <div className="relative mt-4 overflow-hidden rounded-2xl border border-gray-800">
                  <img
                    src={gifUrl}
                    alt="GIF preview"
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setGifUrl("")}
                    className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-white hover:bg-black/90"
                    aria-label="Remove gif"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {isLoading && imageUploadProgress > 0 && imageUploadProgress < 100 && (
                <p className="mt-2 text-xs text-blue-300">
                  Uploading image... {imageUploadProgress}%
                </p>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-blue-400">
                  <label
                    htmlFor="tweetImage"
                    data-qa="composer-image-upload"
                    className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-blue-900/20"
                  >
                    <Image className="h-5 w-5" />
                    <input
                      type="file"
                      accept="image/*"
                      id="tweetImage"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={isLoading}
                    />
                  </label>
                  <Button
                    type="button"
                    data-qa="composer-poll-toggle"
                    variant="ghost"
                    size="sm"
                    className={`h-11 w-11 rounded-full transition-colors duration-150 hover:bg-blue-900/20 ${
                      pollEnabled ? "text-blue-300" : ""
                    }`}
                    onClick={() => setPollEnabled((prev) => !prev)}
                  >
                    <BarChart3 className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    data-qa="composer-gif-toggle"
                    variant="ghost"
                    size="sm"
                    className="h-11 w-11 rounded-full transition-colors duration-150 hover:bg-blue-900/20"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-11 w-11 rounded-full transition-colors duration-150 hover:bg-blue-900/20 ${
                      showGifInput ? "text-blue-300" : ""
                    }`}
                    onClick={() => setShowGifInput((prev) => !prev)}
                  >
                    <span className="text-xs font-bold">GIF</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-11 w-11 rounded-full transition-colors duration-150 hover:bg-blue-900/20"
                  >
                    <Calendar className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-11 w-11 rounded-full transition-colors duration-150 hover:bg-blue-900/20"
                  >
                    <MapPin className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-semibold text-blue-400">
                      {t("tweet.everyoneCanReply")}
                    </span>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                    <div className="flex min-w-[90px] items-center justify-end gap-2">
                      <div className="relative h-8 w-8">
                        <svg className="h-8 w-8 -rotate-90">
                          <circle
                            cx="16"
                            cy="16"
                            r="14"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            className="text-gray-700"
                          />
                          <circle
                            cx="16"
                            cy="16"
                            r="14"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 14}`}
                            strokeDashoffset={`${
                              2 *
                              Math.PI *
                              14 *
                              (1 - characterCount / maxLength)
                            }`}
                            className={
                              isOverLimit
                                ? "text-red-500"
                                : isNearLimit
                                  ? "text-yellow-500"
                                  : "text-blue-500"
                            }
                          />
                        </svg>
                      </div>
                      <span
                        data-qa="composer-counter"
                        className={`text-xs font-medium ${
                          isOverLimit ? "text-red-500" : "text-gray-400"
                        }`}
                      >
                        {characterCount}/{maxLength}
                      </span>
                    </div>
                    <Separator
                      orientation="vertical"
                      className="hidden h-6 bg-gray-700 sm:block"
                    />

                    <Button
                      type="button"
                      data-qa="composer-audio-post-button"
                      onClick={() => void handlePostAudioTweet()}
                      disabled={
                        !audioFile ||
                        !otpVerified ||
                        !isWithinAudioWindow ||
                        isAudioPosting
                      }
                      className="h-11 rounded-full bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500"
                    >
                      {isAudioPosting
                        ? t("tweet.audio.posting")
                        : t("tweet.audio.postButton")}
                    </Button>

                    <Button
                      type="submit"
                      data-qa="composer-post-button"
                      disabled={!hasTweetContent || isOverLimit || isLoading}
                      className="h-11 min-w-[108px] rounded-full bg-sky-500 px-6 font-semibold text-white shadow-sm transition-all duration-150 hover:bg-sky-600 hover:shadow-md disabled:bg-gray-700 disabled:text-gray-400"
                    >
                      {isLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <LoadingSpinner size="sm" />
                          {t("common.posting")}
                        </span>
                      ) : (
                        t("common.post")
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TweetComposer;
