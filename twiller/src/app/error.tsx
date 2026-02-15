"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-gray-400">
            An unexpected error occurred. Please try again.
          </p>
          {error?.message && (
            <p className="text-xs text-gray-500 break-words">{error.message}</p>
          )}
          <Button
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-full px-6"
            onClick={() => reset()}
          >
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
