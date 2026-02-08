import type { NextConfig } from "next";

interface MyNextConfig extends NextConfig {
  eslint?: { ignoreDuringBuilds?: boolean };
}

const nextConfig: MyNextConfig = {
  /* config options here */
  env: {
    BACKEND_URL: process.env.BACKEND_URL,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
