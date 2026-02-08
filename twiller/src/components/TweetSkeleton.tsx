"use client";

import React from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";

export default function TweetSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonTheme baseColor="#111111" highlightColor="#1f1f1f">
      <div className="space-y-6">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="px-4 py-4 border-b border-gray-900">
            <div className="flex space-x-3">
              <Skeleton circle height={48} width={48} />
              <div className="flex-1">
                <Skeleton height={14} width="40%" />
                <Skeleton height={12} width="60%" className="mt-2" />
                <Skeleton height={12} width="80%" className="mt-3" />
                <Skeleton height={12} width="70%" className="mt-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}
