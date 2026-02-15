"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StatusState = {
  tone: "success" | "error";
  message: string;
};

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (!token) {
      setStatus({
        tone: "error",
        message: "Reset token is missing or invalid.",
      });
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setStatus({
        tone: "error",
        message: "Please enter and confirm your new password.",
      });
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setStatus({
        tone: "error",
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({
        tone: "error",
        message: "Passwords do not match.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosInstance.post("/forgot-password/reset", {
        token,
        newPassword,
      });
      setStatus({
        tone: "success",
        message: "Your password has been reset. You can sign in now.",
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setStatus({
        tone: "error",
        message:
          error?.response?.data?.message ||
          "Unable to reset password. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-neutral-950/70 p-8 shadow-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Reset password</h1>
          <p className="mt-2 text-sm text-gray-400">
            Enter a new password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="bg-black text-white border-gray-700 placeholder:text-gray-500"
              autoComplete="new-password"
            />
          </div>

          <div>
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="bg-black text-white border-gray-700 placeholder:text-gray-500"
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Resetting..." : "Reset password"}
          </Button>

          {status ? (
            <div
              className={`text-sm ${
                status.tone === "error" ? "text-red-400" : "text-green-400"
              }`}
            >
              {status.message}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
